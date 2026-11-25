import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { type Request, type Response } from "express";
import { type GameId } from "@repo/mille-bornes-core/ids";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { createApp, createHostHandlers, isLoopbackAddress } from "./app.mjs";
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


async function startApp(webRoot: string | null = null): Promise<Harness> {
    const store = new MemorySnapshotStore();
    const rand = seededRandom(7);
    const sessions = await SessionRegistry.load(store, rand);
    const logger = collectingLogger();
    const hub = await Hub.open({
        store, sessions, clock: new FakeClock(), rand, timings: defaultTimings, logger
    });
    const config: ServerConfig = { port: 3000, dataDir: "unused", webRoot, timings: defaultTimings };
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
    const created = (await h.sessions.create(name)).throwIfFailed();
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


function fakeRequest(remoteAddress: string, gameId?: string): Request {
    return {
        socket:  { remoteAddress },
        headers: Object.fromEntries([["x-forwarded-for", "127.0.0.1"]]),
        params:  { gameId }
    } as unknown as Request;
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
                expect(isLoopbackAddress(a)).withContext(a).toBeTrue();
            }
        });


        it("rejects everything else", () => {
            for (const a of [undefined, "", "192.168.1.5", "::ffff:192.168.1.5", "127.0.0.2"]) {
                expect(isLoopbackAddress(a)).withContext(String(a)).toBeFalse();
            }
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
            for (const p of ["/..%2foutside.txt", "/..%2f..%2fpackage.json", "/%2e%2e/outside.txt"]) {
                const body = await (await fetch(`${h.base}${p}`)).text();
                expect(body).withContext(p).not.toContain("OUTSIDE");
                expect(body).withContext(p).not.toContain("\"name\"");
            }
        });


        it("does not fall back to the index for /host/... or /trpc/...", async () => {
            const h = await startApp(webRootWithIndex());
            expect(await (await fetch(`${h.base}/host/nothing`)).text()).not.toContain("INDEX");
            expect(await (await fetch(`${h.base}/trpc/nothing`)).text()).not.toContain("INDEX");
        });


        it("shows a placeholder when there is no web root", async () => {
            const h = await startApp(null);
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
