import { getLegacyPowerShellExecutable, getModernPowerShellExecutable, getPowerShellExecutable } from "../src/powershell.js";


describe("getLegacyPowerShellExecutable()", () => {

    it("can find powershell.exe", async () => {
        const resExec = await getLegacyPowerShellExecutable();
        expect(resExec.succeeded).toBeTrue();
        expect(resExec.value!.toString()).toContain("powershell.exe");
    });

});


describe("getModernPowerShellExecutable()", () => {

    it("can find pwsh.exe", async () => {
        const resExec = await getModernPowerShellExecutable();
        expect(resExec.succeeded).toBeTrue();
        expect(resExec.value!.toString()).toContain("pwsh.exe");
    });

});


describe("getPowerShellExecutable()", () => {

    it("prefers modern powershell", async () => {
        const resExec = await getPowerShellExecutable();
        expect(resExec.succeeded).toBeTrue();
        expect(resExec.value!.toString()).toContain("pwsh.exe");
    });

});
