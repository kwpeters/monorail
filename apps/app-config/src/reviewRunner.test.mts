import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { File } from "@repo/depot-node/file";
import { determineFileComparison, FileComparisonResult } from "./reviewRunner.mjs";


describe("determineFileComparison", () => {

    it("returns identical when files have same content", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
        const leftPath = path.join(tempRoot, "left.txt");
        const rightPath = path.join(tempRoot, "right.txt");

        await fs.writeFile(leftPath, "same-content", "utf8");
        await fs.writeFile(rightPath, "same-content", "utf8");

        const result = await determineFileComparison(new File(leftPath), new File(rightPath));

        expect(result).toBe(FileComparisonResult.Identical);
    });


    it("returns different when deployed file is missing", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
        const leftPath = path.join(tempRoot, "left.txt");
        const rightPath = path.join(tempRoot, "missing.txt");

        await fs.writeFile(leftPath, "same-content", "utf8");

        const result = await determineFileComparison(new File(leftPath), new File(rightPath));

        expect(result).toBe(FileComparisonResult.Different);
    });
});
