import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { getUniqueTmpDir } from "./specHelpers.test.mjs";
import {
    defaultIgnoredDirNames,
    enumerateDirectories,
    enumerateFiles,
    enumerateProjects,
    formatPath,
    nodeProjectName
} from "./repoEnumeration.mjs";


/**
 * Creates a file (and its directories) under _root_.
 *
 * @param root - The directory the file is created under
 * @param relPath - The file's path relative to _root_
 * @param content - The file's content
 */
function makeFile(root: Directory, relPath: string, content = ""): void {
    const file = new File(root, relPath);
    file.directory.ensureExistsSync();
    file.writeSync(content);
}


describe("repoEnumeration", () => {

    let root: Directory;

    beforeEach(() => {
        root = getUniqueTmpDir();
        makeFile(root, "readme.md");
        makeFile(root, "bin/app.exe");
        makeFile(root, ".github/workflows/ci.yml");
        makeFile(root, "src/index.ts");
        makeFile(root, "node_modules/dep/index.js");
        makeFile(root, "sub/node_modules/dep/index.js");
        makeFile(root, ".git/config");
        makeFile(root, "obj/Debug/x.dll");
    });


    afterEach(() => {
        root.deleteSync();
    });


    describe("defaultIgnoredDirNames", () => {

        it("ignores dependency and VCS directories but not build output", () => {
            expect(defaultIgnoredDirNames).toContain(".git");
            expect(defaultIgnoredDirNames).toContain("node_modules");
            expect(defaultIgnoredDirNames).not.toContain("bin");
            expect(defaultIgnoredDirNames).not.toContain("dist");
        });

    });


    describe("enumerateFiles()", () => {

        it("lists files, including bin and dot-directories, with forward slashes", async () => {
            expect(await enumerateFiles(root)).toEqual([
                ".github/workflows/ci.yml",
                "bin/app.exe",
                "readme.md",
                "src/index.ts"
            ]);
        });


        it("skips ignored directories at any depth", async () => {
            const files = await enumerateFiles(root);
            expect(files.some((f) => f.includes("node_modules"))).toBeFalse();
            expect(files.some((f) => f.startsWith(".git/"))).toBeFalse();
            expect(files.some((f) => f.startsWith("obj/"))).toBeFalse();
        });


        it("honors a custom ignore list", async () => {
            const files = await enumerateFiles(root, ["bin"]);
            expect(files).toContain("obj/Debug/x.dll");
            expect(files).not.toContain("bin/app.exe");
        });

    });


    describe("enumerateDirectories()", () => {

        it("lists directories without the root, skipping ignored ones", async () => {
            expect(await enumerateDirectories(root)).toEqual([
                ".github",
                ".github/workflows",
                "bin",
                "src",
                "sub"
            ]);
        });

    });


    describe("enumerateProjects()", () => {

        it("names node projects without their scope and dotnet projects without the extension", async () => {
            makeFile(root, "packages/lib/package.json", JSON.stringify({ name: "@repo/lib" }));
            makeFile(root, "apps/tool/package.json", JSON.stringify({ name: "tool" }));
            makeFile(root, "dotnet/Foo.csproj");

            expect(await enumerateProjects(root)).toEqual([
                { name: "Foo",  kind: "dotnet", relDir: "dotnet" },
                { name: "lib",  kind: "node",   relDir: "packages/lib" },
                { name: "tool", kind: "node",   relDir: "apps/tool" }
            ]);
        });


        it("uses the directory name when package.json has no name", async () => {
            makeFile(root, "apps/unnamed/package.json", "{}");
            expect(await enumerateProjects(root)).toEqual([
                { name: "unnamed", kind: "node", relDir: "apps/unnamed" }
            ]);
        });


        it("skips projects inside ignored directories", async () => {
            makeFile(root, "node_modules/dep/package.json", JSON.stringify({ name: "dep" }));
            expect(await enumerateProjects(root)).toEqual([]);
        });

    });


    describe("nodeProjectName()", () => {

        it("removes the scope only when asked to", async () => {
            makeFile(root, "pkg/package.json", JSON.stringify({ name: "@repo/lib" }));
            const packageJson = new File(root, "pkg/package.json");

            expect(await nodeProjectName(packageJson, true, "fallback")).toEqual("lib");
            expect(await nodeProjectName(packageJson, false, "fallback")).toEqual("@repo/lib");
        });


        it("returns the fallback when there is no usable name", async () => {
            makeFile(root, "pkg/package.json", "{}");
            expect(await nodeProjectName(new File(root, "pkg/package.json"), true, "fallback")).toEqual("fallback");
        });

    });


    describe("formatPath()", () => {

        const baseDir = "C:\\repo\\root";
        const relPath = "src/dir/file.ts";

        it("formats a relative path with forward slashes", () => {
            expect(formatPath(baseDir, relPath, "relative", "forward")).toEqual("src/dir/file.ts");
        });


        it("formats a relative path with backslashes", () => {
            expect(formatPath(baseDir, relPath, "relative", "backward")).toEqual("src\\dir\\file.ts");
        });


        it("formats an absolute path with forward slashes", () => {
            expect(formatPath(baseDir, relPath, "absolute", "forward")).toEqual("C:/repo/root/src/dir/file.ts");
        });


        it("formats an absolute path with backslashes", () => {
            expect(formatPath(baseDir, relPath, "absolute", "backward")).toEqual("C:\\repo\\root\\src\\dir\\file.ts");
        });


        it("handles a POSIX base directory with a trailing slash", () => {
            expect(formatPath("/home/me/repo/", "a/b", "absolute", "forward")).toEqual("/home/me/repo/a/b");
        });

    });

});
