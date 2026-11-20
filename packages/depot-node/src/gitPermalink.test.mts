import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { type Result } from "@repo/depot/result";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { makeGitPermalink } from "./gitPermalink.mjs";


const githubUrl = "https://github.com/acme/tools.git";


/**
 * Runs `git` synchronously and returns its trimmed stdout.
 *
 * @param cwd - The directory to run in
 * @param args - The `git` arguments
 * @returns The trimmed stdout
 */
function runGit(cwd: string, ...args: Array<string>): string {
    return execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" }).trim();
}


/**
 * Writes a file, creating its directories.
 *
 * @param root - The directory the file is relative to
 * @param relPath - The file's path relative to _root_
 * @param content - The file's content
 */
function writeFile(root: string, relPath: string, content: string): void {
    const full = path.join(root, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
}


/**
 * Gets the problems from a failed result.
 *
 * @param res - The result
 * @returns The problems, or an empty array when _res_ succeeded
 */
function errorsOf(res: Result<string, Array<string>>): Array<string> {
    return res.succeeded ? [] : res.error;
}


describe("makeGitPermalink()", () => {

    // A committed and pushed repo is built once, and each test works on a copy.
    let template: string;
    let base:     string;
    let repoDir:  string;
    let hash:     string;


    beforeAll(() => {
        template = fs.mkdtempSync(path.join(os.tmpdir(), "permalink-template-"));
        const originDir = path.join(template, "origin.git");
        const templateRepo = path.join(template, "repo");
        fs.mkdirSync(templateRepo);

        runGit(template, "init", "--bare", "-b", "main", originDir);
        runGit(templateRepo, "init", "-b", "main");
        runGit(templateRepo, "config", "user.name", "Test");
        runGit(templateRepo, "config", "user.email", "test@example.com");
        runGit(templateRepo, "remote", "add", "origin", githubUrl);

        writeFile(templateRepo, "src/a.ts", "a");
        writeFile(templateRepo, "my dir/b c.txt", "b");
        runGit(templateRepo, "add", ".");
        runGit(templateRepo, "commit", "-m", "first");
        // The push goes to the local bare repo, while the remote URL that the
        // permalink is built from stays a GitHub URL.
        runGit(
            templateRepo,
            "-c", `url.${originDir.replaceAll("\\", "/")}.pushInsteadOf=${githubUrl}`,
            "push", "origin", "main"
        );
    });


    afterAll(() => {
        fs.rmSync(template, { recursive: true, force: true, maxRetries: 5 });
    });


    beforeEach(() => {
        base = fs.mkdtempSync(path.join(os.tmpdir(), "permalink-test-"));
        fs.cpSync(template, base, { recursive: true });
        repoDir = path.join(base, "repo");
        hash = runGit(repoDir, "rev-parse", "HEAD");
    });


    afterEach(() => {
        fs.rmSync(base, { recursive: true, force: true, maxRetries: 5 });
    });


    describe("success", () => {

        it("links a file with /blob/", async () => {
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"));
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual(`https://github.com/acme/tools/blob/${hash}/src/a.ts`);
        });


        it("links a directory with /tree/", async () => {
            const res = await makeGitPermalink(new Directory(repoDir, "src"));
            expect(res.value).toEqual(`https://github.com/acme/tools/tree/${hash}/src`);
        });


        it("links the repository root directory without a trailing slash", async () => {
            const res = await makeGitPermalink(new Directory(repoDir));
            expect(res.value).toEqual(`https://github.com/acme/tools/tree/${hash}`);
        });


        it("percent-encodes path segments", async () => {
            const res = await makeGitPermalink(new File(repoDir, "my dir", "b c.txt"));
            expect(res.value).toEqual(`https://github.com/acme/tools/blob/${hash}/my%20dir/b%20c.txt`);
        });


        it("links a line of a file", async () => {
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"), { lines: { start: 7, end: 7 } });
            expect(res.value).toEqual(`https://github.com/acme/tools/blob/${hash}/src/a.ts#L7`);
        });


        it("links a range of lines of a file", async () => {
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"), { lines: { start: 7, end: 12 } });
            expect(res.value).toEqual(`https://github.com/acme/tools/blob/${hash}/src/a.ts#L7-L12`);
        });


        it("adds ?plain=1 for a line of a rendered file", async () => {
            writeFile(repoDir, "README.md", "# Title");
            runGit(repoDir, "add", ".");
            runGit(repoDir, "commit", "-m", "readme");
            runGit(repoDir, "-c", `url.${path.join(base, "origin.git").replaceAll("\\", "/")}.pushInsteadOf=${githubUrl}`, "push", "origin", "main");
            const newHash = runGit(repoDir, "rev-parse", "HEAD");
            const res = await makeGitPermalink(new File(repoDir, "README.md"), { lines: { start: 1, end: 3 } });
            expect(res.value).toEqual(`https://github.com/acme/tools/blob/${newHash}/README.md?plain=1#L1-L3`);
        });


        it("ignores lines for a directory", async () => {
            const res = await makeGitPermalink(new Directory(repoDir, "src"), { lines: { start: 7, end: 12 } });
            expect(res.value).toEqual(`https://github.com/acme/tools/tree/${hash}/src`);
        });


        it("uses /-/ for a GitLab remote", async () => {
            runGit(repoDir, "remote", "set-url", "origin", "git@gitlab.example.com:group/sub/project.git");
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"));
            expect(res.value).toEqual(`https://gitlab.example.com/group/sub/project/-/blob/${hash}/src/a.ts`);
        });

    });


    describe("failure", () => {

        it("reports a file that is not in a repository", async () => {
            const outside = fs.mkdtempSync(path.join(os.tmpdir(), "permalink-outside-"));
            try {
                writeFile(outside, "x.txt", "x");
                const res = await makeGitPermalink(new File(outside, "x.txt"));
                expect(res.succeeded).toBeFalse();
                expect(errorsOf(res).length).toEqual(1);
                expect(errorsOf(res)[0]).toContain("not in a Git repository");
            }
            finally {
                fs.rmSync(outside, { recursive: true, force: true, maxRetries: 5 });
            }
        });


        it("reports a directory that does not exist", async () => {
            const res = await makeGitPermalink(new Directory(repoDir, "nope"));
            expect(res.succeeded).toBeFalse();
            expect(errorsOf(res)[0]).toContain("does not exist");
        });


        it("reports an untracked file, and not also as uncommitted", async () => {
            writeFile(repoDir, "new.txt", "new");
            const res = await makeGitPermalink(new File(repoDir, "new.txt"));
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("not tracked");
        });


        it("reports a directory with no tracked files", async () => {
            writeFile(repoDir, "untracked/x.txt", "x");
            const res = await makeGitPermalink(new Directory(repoDir, "untracked"));
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("no files tracked");
        });


        it("reports a missing origin remote, and not also as unpushed", async () => {
            runGit(repoDir, "remote", "remove", "origin");
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"));
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("no remote named origin");
        });


        it("reports a host that is neither GitHub nor GitLab", async () => {
            runGit(repoDir, "remote", "set-url", "origin", "https://example.com/acme/tools.git");
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"));
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("neither GitHub nor GitLab");
        });


        it("reports an SSH host alias", async () => {
            runGit(repoDir, "remote", "set-url", "origin", "git@github-work:acme/tools.git");
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"));
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("github-work");
        });


        it("reports a commit that is not pushed", async () => {
            writeFile(repoDir, "src/c.ts", "c");
            runGit(repoDir, "add", ".");
            runGit(repoDir, "commit", "-m", "second");
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"), { fetchOrigin: false });
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("not on any origin branch");
        });


        it("reports uncommitted changes to a file", async () => {
            writeFile(repoDir, "src/a.ts", "changed");
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"));
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("uncommitted changes");
        });


        it("reports uncommitted changes under a directory", async () => {
            writeFile(repoDir, "src/a.ts", "changed");
            const res = await makeGitPermalink(new Directory(repoDir, "src"));
            expect(errorsOf(res).length).toEqual(1);
            expect(errorsOf(res)[0]).toContain("uncommitted changes");
        });


        it("reports every problem found together", async () => {
            writeFile(repoDir, "src/a.ts", "changed");
            runGit(repoDir, "commit", "-am", "second");
            writeFile(repoDir, "src/a.ts", "changed again");
            const res = await makeGitPermalink(new File(repoDir, "src", "a.ts"), { fetchOrigin: false });
            const errors = errorsOf(res);
            expect(errors.length).toEqual(2);
            expect(errors.some((e) => e.includes("not on any origin branch"))).toBeTrue();
            expect(errors.some((e) => e.includes("uncommitted changes"))).toBeTrue();
        });

    });

});
