import * as url from "node:url";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { NodePackage } from "./nodePackage.mjs";
import { tmpDir } from "./specHelpers.test.mjs";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const pkgDir = new Directory(__dirname, "..", "..", "..");


describe("NodePackage", () => {

    describe("static", () => {

        describe("fromDirectory", () => {

            it("will reject when given a non-existent directory", (done) => {
                NodePackage.fromDirectory(new Directory(__dirname, "xyzzy"))
                .catch(() => {
                    done();
                });
            });


            it("will reject when given a directory that does not have a package.json file", (done) => {
                NodePackage.fromDirectory(new Directory(__dirname))
                .catch(() => {
                    done();
                });
            });


            it("will create a new instance when given a valid directory", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NodePackage.fromDirectory(pkgDir)
                .then((pkg: NodePackage) => {
                    expect(pkg).toBeTruthy();
                    done();
                });
            });


        });


    });


    describe("instance", () => {

        describe("config", () => {

            it("will return properties read from package.json", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NodePackage.fromDirectory(pkgDir)
                .then((pkg) => {
                    expect(pkg.config.name).toEqual("monorail");
                    expect(pkg.config.version).toBeTruthy();
                    expect(pkg.config.description).toBeTruthy();
                    expect(pkg.config.repository).toBeTruthy();
                    done();
                });

            });
        });


        describe("pack()", () => {

            it("will produce a .tgz file", (done) => {
                const pkgDir = new Directory(__dirname, "..");
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NodePackage.fromDirectory(pkgDir)
                .then((pkg) => {
                    return pkg.pack();
                })
                .then((packedFile: File) => {
                    expect(packedFile).toBeTruthy();
                    expect(packedFile.fileName).toMatch(/depot-node-\d+\.\d+\.\d+\.tgz/);
                    expect(packedFile.existsSync()).toBeTruthy();
                    done();
                });
            }, 10 * 1000);


            it("will place the .tgz in the package directory when an output directory is not specified", (done) => {
                const pkgDir = new Directory(__dirname, "..");
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NodePackage.fromDirectory(pkgDir)
                .then((pkg) => {
                    return pkg.pack();
                })
                .then((packedFile: File) => {
                    expect(packedFile).toBeTruthy();
                    expect(packedFile.existsSync()).toBeTruthy();
                    expect(packedFile.directory.toString()).toEqual(pkgDir.toString());
                    done();
                });
            }, 10 * 1000);


            it("will place the .tgz in the specified output directory", (done) => {
                const pkgDir = new Directory(__dirname, "..");
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NodePackage.fromDirectory(pkgDir)
                .then((pkg) => {
                    return pkg.pack(tmpDir);
                })
                .then((packedFile: File) => {
                    expect(packedFile).toBeTruthy();
                    expect(packedFile.existsSync()).toBeTruthy();
                    expect(packedFile.directory.toString()).toEqual(tmpDir.toString());
                    done();
                });
            }, 10 * 1000);


        });


        describe("publish()", () => {

            beforeEach(() => {
                tmpDir.emptySync();
            });


            it("will publish to a directory", (done) => {
                const pkgDir = new Directory(__dirname, "..");
                const pubDir = new Directory(tmpDir, "publish");
                const pubTmpDir = new Directory(tmpDir, "tmp");

                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NodePackage.fromDirectory(pkgDir)
                .then((pkg) => {
                    return pkg.publish(pubDir, true, pubTmpDir);
                })
                .then((publishDir: Directory) => {
                    // Note: Because these unit tests are run before building,
                    // we should not expect to see any transpiled output files.

                    expect(publishDir.absPath()).toEqual(pubDir.absPath());

                    // Make sure that a file that should be present is present.
                    expect(new File(pubDir, "package.json").existsSync()).toBeTruthy();

                    // Make sure that a file being npm ignored does not exist.
                    expect(new File(pubDir, "publishtogit.json").existsSync()).toBeFalsy();

                    done();
                });

            }, 10 * 1000);


        });


    });

});
