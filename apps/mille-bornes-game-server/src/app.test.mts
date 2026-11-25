import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { type Request, type Response } from "express";
import { Option, SomeOption } from "@repo/depot/option";
import { type GameId } from "@repo/mille-bornes-core/ids";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import {
    createApp, createHostHandlers, isLocalHostHeader, isLoopbackAddress, isSameOriginRequest
} from "./app.mjs";
import { defaultTimings, type ServerConfig } from "./config.mjs";
import { FakeClock } from "./fakeClock.mjs";
import { Hub } from "./hub.mjs";
import { collectingLogger } from "./logger.mjs";
import { SessionRegistry } from "./sessions.mjs";
import { MemorySnapshotStore } from "./snapshotStore.mjs";


const placeholder = "Mille Bornes server is running. The web app has not been built yet.";
const lanUrl = "http://192.168.1.5:3000/";


interface Harness {
    hub:      Hub;
    sessions: SessionRegistry;
    logger:   ReturnType<typeof collectingLogger>;
    config:   ServerConfig;
    server:   http.Server;
    base:     string;
}


const open: Array<http.Server> = [];
const tempDirs: Array<string> = [];


async function startApp(webRoot?: string): Promise<Harness> {
    const store = new MemorySnapshotStore();
    const rand = seededRandom(7);
    const sessions = await SessionRegistry.load(store, rand);
    const logger = collectingLogger();
    const hub = await Hub.open({
        store, sessions, clock: new FakeClock(), rand, timings: defaultTimings, logger
    });
    const config: ServerConfig = {
        port:    3000,
        dataDir: "unused",
        webRoot: Option.fromNullable(webRoot),
        timings: defaultTimings
    };
    const app = createApp({ hub, sessions, config, logger, addresses: () => [lanUrl], port: 3000 });
    const server = await new Promise<http.Server>((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => { resolve(s); });
    });
    open.push(server);
    const { port } = server.address() as { port: number };
    return { hub, sessions, logger, config, server, base: `http://127.0.0.1:${port.toString()}` };
}


function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mb-app-test-"));
    tempDirs.push(dir);
    return dir;
}


async function newPendingGame(h: Harness, name: string): Promise<GameId> {
    const created = (await h.sessions.create(new SomeOption(name))).throwIfFailed();
    (await h.hub.createGame(created.playerId)).throwIfFailed();
    return h.hub.adminList()[0]!.id;
}


interface FakeRes {
    statusCode: number | undefined;
    body:       string | undefined;
    location:   string | undefined;
}


function fakeResponse(): { res: Response; out: FakeRes } {
    const out: FakeRes = { statusCode: undefined, body: undefined, location: undefined };
    const res = {
        status(code: number) { out.statusCode = code; return res; },
        type() { return res; },
        set() { return res; },
        send(body: string) { out.body = body; return res; },
        redirect(code: number, location: string) { out.statusCode = code; out.location = location; }
    };
    return { res: res as unknown as Response, out };
}


function fakeRequest(
    remoteAddress: string,
    gameId?:       string,
    headers:       Array<[string, string]> = [["host", "localhost:3000"]]
): Request {
    return {
        socket:  { remoteAddress },
        headers: Object.fromEntries([["x-forwarded-for", "127.0.0.1"], ...headers]),
        params:  { gameId }
    } as unknown as Request;
}


// fetch() sets and normalises things a hostile client would not, so this sends
// the request line and headers exactly as given.
async function rawRequest(
    base:    string,
    method:  string,
    rawPath: string,
    headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
    const { hostname, port } = new URL(base);
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname, port, method, path: rawPath, headers }, (res) => {
            const chunks: Array<Buffer> = [];
            res.on("data", (c: Buffer) => { chunks.push(c); });
            res.on("end", () => {
                resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() });
            });
        });
        req.on("error", reject);
        req.end();
    });
}


afterEach(async () => {
    await Promise.all(open.splice(0).map(async (s) => new Promise<void>((resolve) => {
        s.close(() => { resolve(); });
        s.closeAllConnections();
    })));
    tempDirs.splice(0).forEach((d) => { fs.rmSync(d, { recursive: true, force: true }); });
});


describe("app", () => {

    describe("isLoopbackAddress()", () => {

        it("accepts the loopback forms", () => {
            for (const a of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
                expect(isLoopbackAddress(Option.fromNullable(a))).withContext(a).toBeTrue();
            }
        });


        it("rejects everything else", () => {
            for (const a of [undefined, "", "192.168.1.5", "::ffff:192.168.1.5", "127.0.0.2"]) {
                expect(isLoopbackAddress(Option.fromNullable(a)))
                .withContext(String(a))
                .toBeFalse();
            }
        });

    });


    describe("isLocalHostHeader()", () => {

        it("accepts localhost, 127.0.0.1 and [::1], with or without a port", () => {
            for (const h of [
                "localhost", "localhost:3000", "LOCALHOST:3000", "127.0.0.1:3000", "[::1]", "[::1]:3000"
            ]) {
                expect(isLocalHostHeader(Option.fromNullable(h))).withContext(h).toBeTrue();
            }
        });


        it("rejects every other name", () => {
            for (const h of [
                undefined, "", "evil.example", "evil.example:3000", "localhost.evil.example",
                "evil.example#localhost", "192.168.1.5:3000", "::1", "[::1", "localhost:",
                "localhost:99999x", "127.0.0.1.evil.example", "localhost@evil.example"
            ]) {
                expect(isLocalHostHeader(Option.fromNullable(h)))
                .withContext(String(h))
                .toBeFalse();
            }
        });

    });


    describe("isSameOriginRequest()", () => {

        const host = "localhost:3000";


        /** Wraps optional header values the way `createHostHandlers()` does. */
        function isSameOrigin(parts: {
            host?:         string;
            origin?:       string;
            secFetchSite?: string;
        }): boolean {
            return isSameOriginRequest({
                host:         Option.fromNullable(parts.host),
                origin:       Option.fromNullable(parts.origin),
                secFetchSite: Option.fromNullable(parts.secFetchSite)
            });
        }


        it("allows a request with neither Origin nor Sec-Fetch-Site", () => {
            expect(isSameOrigin({ host })).toBeTrue();
        });


        it("allows same-origin and user-initiated requests", () => {
            expect(isSameOrigin({ host, origin: "http://localhost:3000" })).toBeTrue();
            expect(isSameOrigin({ host, secFetchSite: "same-origin" })).toBeTrue();
            expect(isSameOrigin({ host, secFetchSite: "none" })).toBeTrue();
        });


        it("rejects a cross-site or same-site request", () => {
            expect(isSameOrigin({ host, secFetchSite: "cross-site" })).toBeFalse();
            expect(isSameOrigin({ host, secFetchSite: "same-site" })).toBeFalse();
        });


        it("rejects an Origin that is not the Host", () => {
            expect(isSameOrigin({ host, origin: "http://evil.example" })).toBeFalse();
            expect(isSameOrigin({ host, origin: "http://localhost:4000" })).toBeFalse();
            expect(isSameOrigin({ host, origin: "null" })).toBeFalse();
            expect(isSameOrigin({ origin: "http://localhost:3000" })).toBeFalse();
        });

    });


    describe("createHostHandlers()", () => {

        it("refuses a non-loopback page request, whatever X-Forwarded-For says", async () => {
            const h = await startApp();
            const { res, out } = fakeResponse();
            await createHostHandlers({ hub: h.hub, addresses: () => [], port: 3000 })
            .showHost(fakeRequest("192.168.1.9"), res);
            expect(out.statusCode).toBe(403);
            expect(out.body).toContain("only");
        });


        it("refuses a spoofed Host on a loopback socket, for both handlers", async () => {
            const h = await startApp();
            const id = await newPendingGame(h, "Ann");
            const handlers = createHostHandlers({ hub: h.hub, addresses: () => [], port: 3000 });
            const spoofed: Array<[string, string]> = [["host", "evil.example"]];
            const page = fakeResponse();
            await handlers.showHost(fakeRequest("127.0.0.1", undefined, spoofed), page.res);
            const end = fakeResponse();
            await handlers.endGame(fakeRequest("127.0.0.1", id, spoofed), end.res);
            expect(page.out.statusCode).toBe(403);
            expect(end.out.statusCode).toBe(403);
            expect(h.hub.adminList().length).toBe(1);
        });


        it("refuses a cross-site end request and ends nothing", async () => {
            const h = await startApp();
            const id = await newPendingGame(h, "Ann");
            const handlers = createHostHandlers({ hub: h.hub, addresses: () => [], port: 3000 });
            const attempts: Array<Array<[string, string]>> = [
                [["host", "localhost:3000"], ["sec-fetch-site", "cross-site"]],
                [["host", "localhost:3000"], ["origin", "http://evil.example"]]
            ];
            for (const headers of attempts) {
                const { res, out } = fakeResponse();
                await handlers.endGame(fakeRequest("127.0.0.1", id, headers), res);
                expect(out.statusCode).toBe(403);
            }
            expect(h.hub.adminList().length).toBe(1);
        });


        it("ends a game for the own page form post and for a bare request", async () => {
            const h = await startApp();
            const handlers = createHostHandlers({ hub: h.hub, addresses: () => [], port: 3000 });
            const sameOrigin: Array<[string, string]> = [
                ["host", "localhost:3000"], ["origin", "http://localhost:3000"],
                ["sec-fetch-site", "same-origin"]
            ];
            const bare: Array<[string, string]> = [["host", "[::1]:3000"]];
            for (const [i, headers] of [sameOrigin, bare].entries()) {
                const id = await newPendingGame(h, `Ann${i.toString()}`);
                const { res, out } = fakeResponse();
                await handlers.endGame(fakeRequest("::1", id, headers), res);
                expect(out.statusCode).toBe(303);
                expect(h.hub.adminList().some((g) => g.id === id)).toBeFalse();
            }
        });


        it("refuses a non-loopback end request and ends nothing", async () => {
            const h = await startApp();
            const id = await newPendingGame(h, "Ann");
            const { res, out } = fakeResponse();
            await createHostHandlers({ hub: h.hub, addresses: () => [], port: 3000 })
            .endGame(fakeRequest("192.168.1.9", id), res);
            expect(out.statusCode).toBe(403);
            expect(h.hub.adminList().length).toBe(1);
        });

    });


    describe("/host", () => {

        it("shows every URL and an inline QR code to the host computer", async () => {
            const h = await startApp();
            await newPendingGame(h, "Ann");
            const res = await fetch(`${h.base}/host`);
            const html = await res.text();
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toContain("text/html");
            expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
            expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
            expect(html).toContain(lanUrl);
            expect(html).toContain("<svg");
            expect(html).toContain("Ann");
        });


        it("escapes a player name", async () => {
            const h = await startApp();
            await newPendingGame(h, "<i>\"x\"</i>");
            const html = await (await fetch(`${h.base}/host`)).text();
            expect(html).toContain("&lt;i&gt;&quot;x&quot;&lt;/i&gt;");
            expect(html).not.toContain("<i>");
        });


        it("ends a game on POST and goes back to the page", async () => {
            const h = await startApp();
            const id = await newPendingGame(h, "Ann");
            const res = await fetch(`${h.base}/host/end/${id}`, { method: "POST", redirect: "manual" });
            expect(res.status).toBe(303);
            expect(res.headers.get("location")).toBe("/host");
            expect(h.hub.adminList()).toEqual([]);
        });


        it("answers 403 to a rebound host name, even from a loopback socket", async () => {
            const h = await startApp();
            const id = await newPendingGame(h, "Ann");
            const page = await rawRequest(h.base, "GET", "/host", { host: "evil.example" });
            const end = await rawRequest(h.base, "POST", `/host/end/${id}`, { host: "evil.example" });
            expect(page.status).toBe(403);
            expect(page.body).not.toContain("Ann");
            expect(end.status).toBe(403);
            expect(h.hub.adminList().length).toBe(1);
        });


        it("answers 403 to a cross-site form post", async () => {
            const h = await startApp();
            const id = await newPendingGame(h, "Ann");
            const end = await rawRequest(h.base, "POST", `/host/end/${id}`, Object.fromEntries([
                ["sec-fetch-site", "cross-site"], ["origin", "http://evil.example"]
            ]));
            expect(end.status).toBe(403);
            expect(h.hub.adminList().length).toBe(1);
        });


        it("rejects a malformed game id with 400", async () => {
            const h = await startApp();
            const res = await fetch(`${h.base}/host/end/not%20an%20id`, { method: "POST" });
            expect(res.status).toBe(400);
        });

    });


    describe("/trpc", () => {

        it("answers 401 to session.me without credentials", async () => {
            const h = await startApp();
            const res = await fetch(`${h.base}/trpc/session.me`);
            expect(res.status).toBe(401);
        });


        it("creates a session over HTTP and accepts its credential", async () => {
            const h = await startApp();
            const created = await fetch(`${h.base}/trpc/session.create`, {
                method:  "POST",
                headers: [["content-type", "application/json"]],
                body:    JSON.stringify({ name: "Ann" })
            });
            expect(created.status).toBe(200);
            const { result } = await created.json() as {
                result: { data: { succeeded: true; value: { playerId: string; token: string } } };
            };
            const { playerId, token } = result.data.value;
            expect(token.length).toBeGreaterThan(10);

            const me = await fetch(`${h.base}/trpc/session.me`, {
                headers: { authorization: `Bearer ${playerId}.${token}` }
            });
            expect(me.status).toBe(200);
        });


        it("rejects a body over 16 KB", async () => {
            const h = await startApp();
            const res = await fetch(`${h.base}/trpc/session.create`, {
                method:  "POST",
                headers: [["content-type", "application/json"]],
                body:    JSON.stringify({ name: "a".repeat(20 * 1024) })
            });
            expect(res.status).toBe(413);
        });

    });


    describe("static files", () => {

        function webRootWithIndex(): string {
            const outside = tempDir();
            const root = path.join(outside, "web");
            fs.mkdirSync(root);
            fs.writeFileSync(path.join(root, "index.html"), "<html>INDEX</html>");
            fs.writeFileSync(path.join(root, "a.js"), "console.log('a');");
            fs.writeFileSync(path.join(root, ".secret"), "DOTFILE");
            fs.writeFileSync(path.join(outside, "outside.txt"), "OUTSIDE");
            return root;
        }


        it("serves files and the index, and falls back to the index", async () => {
            const h = await startApp(webRootWithIndex());
            expect(await (await fetch(`${h.base}/a.js`)).text()).toBe("console.log('a');");
            expect(await (await fetch(`${h.base}/`)).text()).toContain("INDEX");
            const unknown = await fetch(`${h.base}/some/client/route`);
            expect(unknown.status).toBe(200);
            expect(await unknown.text()).toContain("INDEX");
        });


        it("never serves a dotfile", async () => {
            const h = await startApp(webRootWithIndex());
            expect(await (await fetch(`${h.base}/.secret`)).text()).not.toContain("DOTFILE");
        });


        it("never leaves the web root", async () => {
            const h = await startApp(webRootWithIndex());
            // Raw paths: fetch() would normalise the dot segments away.
            const paths = [
                "/../outside.txt", "/..%2foutside.txt", "/..%2f..%2foutside.txt",
                "/%2e%2e/outside.txt", "/..%5coutside.txt", "/%2e%2e%2foutside.txt"
            ];
            for (const p of paths) {
                const { status, body } = await rawRequest(h.base, "GET", p);
                expect(body).withContext(p).not.toContain("OUTSIDE");
                expect(status).withContext(p).not.toBe(200);
            }
        });


        it("does not fall back to the index for /host/... or /trpc/...", async () => {
            const h = await startApp(webRootWithIndex());
            expect(await (await fetch(`${h.base}/host/nothing`)).text()).not.toContain("INDEX");
            expect(await (await fetch(`${h.base}/trpc/nothing`)).text()).not.toContain("INDEX");
        });


        it("shows a placeholder when there is no web root", async () => {
            const h = await startApp();
            const res = await fetch(`${h.base}/`);
            expect(res.status).toBe(200);
            expect(await res.text()).toBe(placeholder);
        });

    });


    describe("error handling", () => {

        it("answers 500 without a stack and keeps serving", async () => {
            const h = await startApp();
            const spy = spyOn(h.hub, "adminList").and.throwError("boom secret detail");
            const res = await fetch(`${h.base}/host`);
            const body = await res.text();
            expect(res.status).toBe(500);
            expect(JSON.parse(body)).toEqual({ error: "Something went wrong on the server." });
            expect(body).not.toContain("boom");
            expect(body).not.toContain(" at ");
            expect(h.logger.lines).toEqual(["ERROR boom secret detail"]);

            spy.and.callThrough();
            expect((await fetch(`${h.base}/host`)).status).toBe(200);
        });

    });

});
