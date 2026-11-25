import path from "node:path";
import { fileURLToPath } from "node:url";
import { NoneOption, SomeOption } from "@repo/depot/option";
import { defaultTimings, loadConfig, packageDataDir } from "./config.mjs";


describe("config", () => {

    describe("defaultTimings", () => {

        it("has the specified values", () => {
            expect(defaultTimings).toEqual({
                hazardWindowMs:    5000,
                extensionOfferMs:  30000,
                raceOverPauseMs:   20000,
                robotDelayMinMs:   1000,
                robotDelayMaxMs:   3000,
                disconnectGraceMs: 3000
            });
        });

    });


    describe("loadConfig()", () => {

        const cwd = path.resolve("some", "dir");
        const pkgData = path.resolve("pkg", "data");


        it("uses defaults for an empty environment", () => {
            const result = loadConfig({}, cwd, pkgData);
            expect(result.succeeded).toBeTrue();
            expect(result.value).toEqual({
                port:    3000,
                dataDir: pkgData,
                webRoot: NoneOption.get(),
                timings: defaultTimings
            });
        });


        it("defaults the data directory to the package's, wherever it runs", () => {
            const expected = fileURLToPath(new URL("../data", import.meta.url));
            expect(packageDataDir).toBe(expected);
            expect(path.basename(path.dirname(expected))).toBe("mille-bornes-game-server");
            expect(loadConfig({}, cwd).value?.dataDir).toBe(expected);
        });


        it("respects PORT, MB_DATA_DIR and MB_WEB_ROOT", () => {
            const env = { PORT: "8080", MB_DATA_DIR: "/x/data", MB_WEB_ROOT: "/x/web" };
            const result = loadConfig(env, cwd, pkgData);
            expect(result.succeeded).toBeTrue();
            expect(result.value?.port).toBe(8080);
            expect(result.value?.dataDir).toBe(path.resolve("/x/data"));
            expect(result.value?.webRoot).toEqual(new SomeOption("/x/web"));
        });


        it("resolves a relative MB_DATA_DIR against the working directory", () => {
            const result = loadConfig({ MB_DATA_DIR: "saves" }, cwd, pkgData);
            expect(result.value?.dataDir).toBe(path.join(cwd, "saves"));
        });


        it("fails with a plain message for a non-numeric PORT", () => {
            const result = loadConfig({ PORT: "abc" }, cwd);
            expect(result.failed).toBeTrue();
            expect(result.error).toContain("PORT");
        });


        it("fails for a PORT out of range or not an integer", () => {
            expect(loadConfig({ PORT: "70000" }, cwd).failed).toBeTrue();
            expect(loadConfig({ PORT: "0" }, cwd).failed).toBeTrue();
            expect(loadConfig({ PORT: "80.5" }, cwd).failed).toBeTrue();
        });

    });

});
