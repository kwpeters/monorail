import path from "node:path";
import { fileURLToPath } from "node:url";
import { NoneOption, SomeOption } from "@repo/depot/option";
import { defaultTimings, loadConfig, packageDataDir, packageWebRoot } from "./config.mjs";


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
        const noWebApp = (): boolean => false;


        it("uses defaults for an empty environment", () => {
            const result = loadConfig({}, cwd, pkgData, noWebApp);
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
            const result = loadConfig(env, cwd, pkgData, () => true);
            expect(result.succeeded).toBeTrue();
            expect(result.value?.port).toBe(8080);
            expect(result.value?.dataDir).toBe(path.resolve("/x/data"));
            expect(result.value?.webRoot).toEqual(new SomeOption("/x/web"));
        });


        it("defaults the web root to the built web app when it exists", () => {
            const expected = fileURLToPath(new URL("../../mille-bornes-web/dist", import.meta.url));
            expect(packageWebRoot).toBe(expected);
            const checked: Array<string> = [];
            const exists = (p: string): boolean => {
                checked.push(p);
                return true;
            };
            const result = loadConfig({}, cwd, pkgData, exists);
            expect(result.value?.webRoot).toEqual(new SomeOption(expected));
            expect(checked).toEqual([expected]);
        });


        it("leaves the web root unset when the built web app is missing", () => {
            expect(loadConfig({}, cwd, pkgData, noWebApp).value?.webRoot).toEqual(NoneOption.get());
        });


        it("treats an empty MB_WEB_ROOT as unset", () => {
            const result = loadConfig({ MB_WEB_ROOT: "" }, cwd, pkgData, () => true);
            expect(result.value?.webRoot).toEqual(new SomeOption(packageWebRoot));
        });


        it("reads the timing variables", () => {
            const env = {
                MB_HAZARD_WINDOW_MS:    "400",
                MB_EXTENSION_OFFER_MS:  "1500",
                MB_RACE_OVER_PAUSE_MS:  "800",
                MB_ROBOT_DELAY_MIN_MS:  "0",
                MB_ROBOT_DELAY_MAX_MS:  "60",
                MB_DISCONNECT_GRACE_MS: "0"
            };
            expect(loadConfig(env, cwd, pkgData, noWebApp).value?.timings).toEqual({
                hazardWindowMs:    400,
                extensionOfferMs:  1500,
                raceOverPauseMs:   800,
                robotDelayMinMs:   0,
                robotDelayMaxMs:   60,
                disconnectGraceMs: 0
            });
        });


        it("keeps the default for an empty timing variable", () => {
            const result = loadConfig({ MB_HAZARD_WINDOW_MS: "" }, cwd, pkgData, noWebApp);
            expect(result.value?.timings).toEqual(defaultTimings);
        });


        it("fails with a message naming a timing variable that is not a whole number", () => {
            for (const bad of ["abc", "-5", "1.5", " 7"]) {
                const result = loadConfig({ MB_RACE_OVER_PAUSE_MS: bad }, cwd, pkgData, noWebApp);
                expect(result.failed).withContext(bad).toBeTrue();
                expect(result.error).toContain("MB_RACE_OVER_PAUSE_MS");
            }
        });


        it("fails for a zero window, offer or pause but allows zero delays and grace", () => {
            for (const name of
                ["MB_HAZARD_WINDOW_MS", "MB_EXTENSION_OFFER_MS", "MB_RACE_OVER_PAUSE_MS"]) {
                const result = loadConfig({ [name]: "0" }, cwd, pkgData, noWebApp);
                expect(result.failed).withContext(name).toBeTrue();
                expect(result.error).toContain(name);
            }
            const env = {
                MB_ROBOT_DELAY_MIN_MS:  "0",
                MB_ROBOT_DELAY_MAX_MS:  "0",
                MB_DISCONNECT_GRACE_MS: "0"
            };
            expect(loadConfig(env, cwd, pkgData, noWebApp).succeeded).toBeTrue();
        });


        it("fails when the robot delay minimum is more than the maximum", () => {
            const env = { MB_ROBOT_DELAY_MIN_MS: "500", MB_ROBOT_DELAY_MAX_MS: "100" };
            const result = loadConfig(env, cwd, pkgData, noWebApp);
            expect(result.failed).toBeTrue();
            expect(result.error).toContain("MB_ROBOT_DELAY_MIN_MS");
            expect(result.error).toContain("MB_ROBOT_DELAY_MAX_MS");
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
