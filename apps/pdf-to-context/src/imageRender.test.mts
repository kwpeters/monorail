import * as os from "node:os";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { normalizeImageNames } from "./imageRender.mjs";


describe("normalizeImageNames()", () => {

    it("re-pads pdftoppm output to a stable 4-digit page-NNNN.png form", async () => {
        const dir = new Directory(os.tmpdir(), `p2c-img-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
        await dir.ensureExists();
        try {
            await new File(dir, "page-7.png").write("x");
            await new File(dir, "page-1340.png").write("x");
            await new File(dir, "notes.txt").write("x");

            const res = await normalizeImageNames(dir);
            expect(res.succeeded).toBeTrue();

            const contents = await dir.contents(false);
            const names = contents.files.map((file) => file.fileName).sort();
            expect(names).toEqual(["notes.txt", "page-0007.png", "page-1340.png"]);
        }
        finally {
            await dir.delete();
        }
    });

});
