// import { Directory } from "./directory.mjs";
import { getOs, OperatingSystem } from "./os.mjs";
import { getUserProfileDir } from "./windowsHelpers.mjs";


describe("getUncPath()", () => {

    // it("replaces the drive letter with the server and share names", async () => {
    //     const dir = new Directory("H:\\dev\\rok\\lemans\\LogixVM");
    //     const uncRes = await getUncPath(dir);
    //     expect(uncRes.succeeded).toBeTrue();
    //     expect(uncRes.value!).toContain("floyd");
    // });

    it("dummy", () => {
        expect(true).toBeTrue();
    });

});


describe("getUserProfileDir()", () => {

    it("gets the user profile directory", async () => {
        // This test is only for Windows.
        if (getOs() !== OperatingSystem.windows) {
            return;
        }

        const resDir = await getUserProfileDir();
        expect(resDir.succeeded).toBeTrue();
        expect(resDir.value!.toString().length).toBeGreaterThan(0);
    });

});
