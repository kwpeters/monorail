import { NoneOption } from "@repo/depot/option";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { GameId } from "@repo/mille-bornes-core/ids";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { defaultTimings } from "./config.mjs";
import { FakeClock } from "./fakeClock.mjs";
import { collectingLogger } from "./logger.mjs";
import { startServer } from "./startServer.mjs";


describe("startServer()", () => {

    it("serves tRPC on an ephemeral port, saves to the data dir and closes", async () => {
        const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mb-start-test-"));
        try {
            const running = await startServer({
                config:    { port: 0, dataDir, webRoot: NoneOption.get(), timings: defaultTimings },
                clock:     new FakeClock(),
                rand:      seededRandom(7),
                logger:    collectingLogger(),
                addresses: () => new Map([["Wi-Fi", "192.168.1.5"], ["VPN", "8.8.8.8"]])
            });
            expect(running.port).toBeGreaterThan(0);
            expect(running.urls).toEqual([`http://192.168.1.5:${running.port.toString()}/`]);

            const res = await fetch(`http://127.0.0.1:${running.port.toString()}/trpc/session.create`, {
                method:  "POST",
                headers: [["content-type", "application/json"]],
                body:    JSON.stringify({ name: "Ann" })
            });
            expect(res.status).toBe(200);

            await running.close();
            expect(fs.existsSync(path.join(dataDir, "sessions.json"))).toBeTrue();
            await expectAsync(fetch(`http://127.0.0.1:${running.port.toString()}/`)).toBeRejected();
        }
        finally {
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    });


    it("reads the data dir once, so a damaged game file is reported once", async () => {
        const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mb-start-test-"));
        const bad = `${GameId.create()}.json`;
        fs.mkdirSync(path.join(dataDir, "games"));
        fs.writeFileSync(path.join(dataDir, "games", bad), "{");
        const logger = collectingLogger();
        const running = await startServer({
            config:    { port: 0, dataDir, webRoot: NoneOption.get(), timings: defaultTimings },
            clock:     new FakeClock(),
            rand:      seededRandom(7),
            logger,
            addresses: () => new Map<string, string>()
        });
        try {
            expect(logger.lines.filter((l) => l.includes(bad))).toEqual([
                jasmine.stringMatching(/^WARN Skipping/u)
            ]);
        }
        finally {
            await running.close();
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    });


    it("rejects when the port is already in use", async () => {
        const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mb-start-test-"));
        const deps = {
            clock:     new FakeClock(),
            rand:      seededRandom(7),
            logger:    collectingLogger(),
            addresses: () => new Map<string, string>()
        };
        const first = await startServer({
            ...deps,
            config: { port: 0, dataDir, webRoot: NoneOption.get(), timings: defaultTimings }
        });
        try {
            await expectAsync(startServer({
                ...deps,
                config: {
                    port: first.port, dataDir, webRoot: NoneOption.get(), timings: defaultTimings
                }
            })).toBeRejectedWith(jasmine.objectContaining({ code: "EADDRINUSE" }));
        }
        finally {
            await first.close();
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    });

});
