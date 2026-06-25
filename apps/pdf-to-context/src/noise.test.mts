import * as os from "node:os";
import { NoneOption, SomeOption } from "@repo/depot/option";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { defaultNoisePatterns, loadNoisePatterns } from "./noise.mjs";


describe("defaultNoisePatterns", () => {

    it("match the known CIP footer / header lines", () => {
        const lines = [
            "This subscription copy is enterprise-licensed to Someone",
            "SUBSCRIPTION TERMS AND CONDITIONS OUTLINED ON PAGE (iii)",
            "Edition 3.40",
            "Volume 1: Common Industrial Protocol Specification, Chapter 3: Foo"
        ];
        for (const line of lines) {
            expect(defaultNoisePatterns.some((rx) => rx.test(line))).toBeTrue();
        }
    });

});


describe("loadNoisePatterns()", () => {

    it("returns the defaults when no override file is given", async () => {
        const res = await loadNoisePatterns(NoneOption.get());
        expect(res.succeeded).toBeTrue();
        expect(res.value).toBe(defaultNoisePatterns);
    });

    it("loads and compiles patterns from an override file, ignoring comments and blanks", async () => {
        const dir = new Directory(os.tmpdir(), `p2c-noise-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
        await dir.ensureExists();
        try {
            const file = new File(dir, "noise.txt");
            await file.write("# a comment\n^FOO\n\n^BAR\\d+\n");
            const res = await loadNoisePatterns(new SomeOption(file));
            expect(res.succeeded).toBeTrue();
            const patterns = res.value!;
            expect(patterns.length).toEqual(2);
            expect(patterns[0]!.test("FOObar")).toBeTrue();
            expect(patterns[1]!.test("BAR123")).toBeTrue();
        }
        finally {
            await dir.delete();
        }
    });

});
