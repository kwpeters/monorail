import { getTimerPromise } from "@repo/depot/promiseHelpers";
import { NoneOption, SomeOption } from "@repo/depot/option";
import { File } from "./file.mjs";
import { tmpDir } from "./specHelpers.test.mjs";
import { updateTimes } from "./fsItem.mjs";


describe("updateTimes()", () => {

    const tmpFile = new File(tmpDir, "tmpFile.txt");
    const delayMs = 200;

    beforeEach(async () => {
        await tmpDir.empty();
        await tmpFile.write("hello world");

        // Wait 200 ms.  All tests can assume this file was last created and
        // accessed 200 ms in the past.
        await getTimerPromise(delayMs, 0);
    });


    it("succeeds when neither time is specified", async () => {
        const res = await updateTimes(tmpFile, NoneOption.get(), NoneOption.get());
        expect(res.succeeded).toBeTrue();
    });


    it("does not update either time when neither is specified", async () => {
        const res = await updateTimes(tmpFile, NoneOption.get(), NoneOption.get());
        expect(res.succeeded).toBeTrue();
        const stats = await tmpFile.exists();
        if (!stats) {
            fail("We should have been able to stat the file.");
            return;
        }

        const now = Date.now();
        expect(now - stats.atime.valueOf()).toBeGreaterThanOrEqual(delayMs);
        expect(now - stats.mtime.valueOf()).toBeGreaterThanOrEqual(delayMs);
    });


    it("updates only the access time when only it is specified", async () => {
        const res = await updateTimes(tmpFile, new SomeOption(new Date()), NoneOption.get());
        expect(res.succeeded).toBeTrue();
        const stats = await tmpFile.exists();
        if (!stats) {
            fail("We should have been able to stat the file.");
            return;
        }

        const now = Date.now();
        expect(now - stats.atime.valueOf()).toBeLessThan(100);
        expect(now - stats.mtime.valueOf()).toBeGreaterThanOrEqual(delayMs);
    });


    it("updates only the modified time when only it is specified", async () => {
        const res = await updateTimes(tmpFile, NoneOption.get(), new SomeOption(new Date()));
        expect(res.succeeded).toBeTrue();
        const stats = await tmpFile.exists();
        if (!stats) {
            fail("We should have been able to stat the file.");
            return;
        }

        const now = Date.now();
        expect(now - stats.atime.valueOf()).toBeGreaterThanOrEqual(delayMs);
        expect(now - stats.mtime.valueOf()).toBeLessThan(100);
    });


    it("updates both times when both are specified", async () => {
        const res = await updateTimes(tmpFile, new SomeOption(new Date()), new SomeOption(new Date()));
        expect(res.succeeded).toBeTrue();
        const stats = await tmpFile.exists();
        if (!stats) {
            fail("We should have been able to stat the file.");
            return;
        }

        const now = Date.now();
        expect(now - stats.atime.valueOf()).toBeLessThan(100);
        expect(now - stats.mtime.valueOf()).toBeLessThan(100);
    });


});
