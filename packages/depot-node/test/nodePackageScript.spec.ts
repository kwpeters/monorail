import { NodePackageScript } from "../src/nodePackageScript.js";
import { NodePackage } from "../src/nodePackage.js";
import { sampleRepoDir } from "./specHelpers.js";


let sampleNodePackage: NodePackage;


describe("NodePackageScript", () => {

    beforeEach(async () => {
        sampleNodePackage = await NodePackage.fromDirectory(sampleRepoDir);
    });


    describe("static", () => {

        describe("create()", () => {

            it("fails if the name is empty", () => {
                const res = NodePackageScript.create(sampleNodePackage, "", "echo hello");
                expect(res.failed).toBeTrue();
            });


            it("fails if the command line is empty", () => {
                const res = NodePackageScript.create(sampleNodePackage, "sample name", "");
                expect(res.failed).toBeTrue();
            });


            it("succeeds if all inputs are valid", () => {
                const res = NodePackageScript.create(sampleNodePackage, "sample name", "echo hello");
                expect(res.succeeded).toBeTrue();
            });

        });

    });


    describe("instance", () => {

        describe("run()", () => {

            it("executes the script", async () => {
                const script = NodePackageScript.create(sampleNodePackage, "hello", "echo hello").value!;

                const res = await script.run().closePromise;
                expect(res.succeeded).toBeTrue();
                expect(res.value!).toContain("hello world");
            });

        });

    });

});
