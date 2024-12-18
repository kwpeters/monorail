import * as path from "node:path";
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as _ from "lodash-es";
import {spawn, type SpawnCloseError} from "./spawn.mjs";
import { getOs, OperatingSystem } from "./os.mjs";
import { tmpDir } from "./specHelpers.test.mjs";


describe("spawn", () => {

    beforeEach(() => {
        tmpDir.emptySync();
    });


    it("will run the specified command", (done) => {
        const os = getOs();
        const options: cp.SpawnOptions = { cwd: tmpDir.absPath() };
        let cmd = "ls";
        if (os === OperatingSystem.Windows) {
            options.shell = true;
            cmd = "dir";
        }
        const testFilePath = path.join(tmpDir.absPath(), "foo.txt");
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        spawn(cmd, [">", "foo.txt"], options).closePromise
        .then(() => {
            const stats = fs.statSync(testFilePath);
            expect(stats.isFile()).toBeTruthy();
            done();
        });
    });


    it("will resolve with the stdout text", (done) => {
        const os = getOs();
        const options: cp.SpawnOptions = { cwd: tmpDir.absPath() };
        let lsCmd = "ls";
        if (os === OperatingSystem.Windows) {
            options.shell = true;
            lsCmd = "dir";
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        spawn(lsCmd, [">", "foo.txt"], options).closePromise
        .then(() => {
            return spawn(lsCmd, [], options).closePromise;
        })
        .then((output) => {
            expect(output).toContain("foo.txt");
            done();
        });
    });


    it("provides access to the underlying child process", (done) => {
        let cmd: string;
        let args: Array<string>;

        if (getOs() === OperatingSystem.Windows) {
            cmd = "c:\\Program Files\\Git\\bin\\sh.exe";
            args = ["-c ", "sleep 10"];
        }
        else {
            cmd = "sleep";
            args = ["10"];
        }

        const spawnResult = spawn(cmd, args, {cwd: tmpDir.absPath()});
        spawnResult.childProcess.kill();
        spawnResult.closePromise
        .then(() => {
            fail("closePromise should reject when the child process is killed.");
        })
        .catch((reason: SpawnCloseError) => {
            if (reason.type === "ISpawnExitError") {
                expect(reason.exitCode).toEqual(null);
                expect(reason.stderr).toEqual("");
                done();
            }
            else {
                fail("spawn() did not return the exepected ISpawnExitError.");
            }
        });
    });


    // it("will run multiple child processes at once", (done) => {
    //
    //     // The following examples demonstrate how to use the description string
    //     // and streams to achieve different output scenarios.
    //
    //     // The following example:
    //     // - shows header and footer
    //     // - pipes output through a PrefixStream and then to this process's steams
    //     //
    //     // Promise.all([
    //     //     spawn("ls", ["-a", "."    ], ".", "ls .    ",
    //     //         new CombinedStream(new PrefixStream(".    "), process.stdout),
    //     //         new CombinedStream(new PrefixStream(".    "), process.stderr)),
    //     //     spawn("ls", ["-a", ".."   ], ".", "ls ..   ",
    //     //         new CombinedStream(new PrefixStream("..   "), process.stdout),
    //     //         new CombinedStream(new PrefixStream("..   "), process.stderr)),
    //     //     spawn("ls", ["-a", "../.."], ".", "ls ../..",
    //     //         new CombinedStream(new PrefixStream("../.."), process.stdout),
    //     //         new CombinedStream(new PrefixStream("../.."), process.stdout))
    //     // ])
    //
    //     // The following example:
    //     // - shows header and footer
    //     // - pipes output to this process's streams
    //     //
    //     // Promise.all([
    //     //     spawn("ls", ["-a", "."    ], ".", "ls .    ",
    //     //         process.stdout,
    //     //         process.stderr),
    //     //     spawn("ls", ["-a", ".."   ], ".", "ls ..   ",
    //     //         process.stdout,
    //     //         process.stderr),
    //     //     spawn("ls", ["-a", "../.."], ".", "ls ../..",
    //     //         process.stdout,
    //     //         process.stdout)
    //     // ])
    //
    //     // The following example:
    //     // - shows header and footer
    //     // - does not show command output
    //     //
    //     // Promise.all([
    //     //     spawn("ls", ["-a", "."    ], ".", "ls .    "),
    //     //     spawn("ls", ["-a", ".."   ], ".", "ls ..   "),
    //     //     spawn("ls", ["-a", "../.."], ".", )
    //     // ])
    //
    //     // The following example:
    //     // - does not show a header or footer
    //     // - does not show command output
    //     //
    //     // Promise.all([
    //     //     spawn("ls", ["-a", "."    ], "."),
    //     //     spawn("ls", ["-a", ".."   ], "."),
    //     //     spawn("ls", ["-a", "../.."], ".")
    //     // ])
    //
    //     .then(done);
    // });


    it("provides the exit code and stderr when the command fails", (done) => {
        const nonExistantFilePath = path.join(tmpDir.absPath(), "xyzzy.txt");
        const os = getOs();
        const lsCmd = os === OperatingSystem.Windows ? "dir" : "ls";
        const options = os === OperatingSystem.Windows ? {shell: true} : undefined;
        spawn(lsCmd, [nonExistantFilePath], options).closePromise
        .catch((err: SpawnCloseError) => {
            expect(err).toBeTruthy();

            if (err.type === "ISpawnExitError") {
                expect(err.exitCode).not.toEqual(0);
                expect(err.stderr.includes("File Not Found") ||
                       err.stderr.includes("No such file or directory")).toBeTruthy();
                done();
            }
            else {
                fail("spawn() did not return the expected ISpawnExitError");
            }
        });
    });


    it("provides the expected system error information when the process fails to start", (done) => {
        spawn("notarealcommand.exe", []).closePromise
        .catch((err: SpawnCloseError) => {
            if (err.type !== "ISpawnSystemError") {
                fail("Should have gotten an ISpawnSystemError.");
                return;
            }

            expect(err.code).toEqual("ENOENT");
            done();
        });
    });


    it("will set the specified environment variables", (done) => {
        const env = _.assign({}, process.env, {xyzzy: "xyzzy-xyzzy"});
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        spawn("node", ["-e", "console.log(process.env.xyzzy);"], {env: env})
        .closePromise
        .then((output) => {
            expect(output).toEqual("xyzzy-xyzzy");
            done();
        });

    });


});
