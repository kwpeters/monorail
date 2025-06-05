import * as url from "url";
import { getLegacyPowerShellExecutable, getModernPowerShellExecutable, getPowerShellExecutable, runPowerShell } from "./powershell.mjs";
import { getOs } from "./os.mjs";


const __filename = url.fileURLToPath(import.meta.url);
// const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


describe("getLegacyPowerShellExecutable()", () => {

    it("can find powershell.exe", async () => {
        // This test is only relevant on Windows.
        if (getOs() !== "windows") {
            return;
        }

        const resExec = await getLegacyPowerShellExecutable();
        expect(resExec.succeeded).toBeTrue();
        expect(resExec.value!.toString()).toContain("powershell.exe");
    });

});


describe("getModernPowerShellExecutable()", () => {

    it("can find pwsh.exe", async () => {
        // This test is only relevant on Windows.
        if (getOs() !== "windows") {
            return;
        }

        const resExec = await getModernPowerShellExecutable();
        expect(resExec.succeeded).toBeTrue();
        expect(resExec.value!.toString()).toContain("pwsh.exe");
    });

});


describe("getPowerShellExecutable()", () => {

    it("prefers modern powershell", async () => {
        // This test is only relevant on Windows.
        if (getOs() !== "windows") {
            return;
        }

        const resExec = await getPowerShellExecutable();
        expect(resExec.succeeded).toBeTrue();
        expect(resExec.value!.toString()).toContain("pwsh.exe");
    });

});


describe("runPowerShell()", () => {

    it("can run a PowerShell command with no arguments", async () => {
        // This test is only relevant on Windows.
        if (getOs() !== "windows") {
            return;
        }

        const resOutput = await runPowerShell("Get-Process");
        expect(resOutput.succeeded).toBeTrue();
        expect(resOutput.value!).toContain("svchost");
    });


    it("can run a PowerShell command with arguments", async () => {
        // This test is only relevant on Windows.
        if (getOs() !== "windows") {
            return;
        }

        // (Get-Item ".\README.md").CreationTime
        const resOutput = await runPowerShell(`(Get-Item "${__filename}").CreationTime`);
        expect(resOutput.succeeded).toBeTrue();
        expect(resOutput.value!).toContain("20");
    });
});
