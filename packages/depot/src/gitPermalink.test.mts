import { buildPermalinkUrl, gitHostKind, remoteUrlToWebInfo, selectionToLineRange } from "./gitPermalink.mjs";


describe("remoteUrlToWebInfo()", () => {

    it("converts the SCP-like SSH form", () => {
        const res = remoteUrlToWebInfo("git@github.com:acme/tools.git");
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual({ host: "github.com", webAddress: "https://github.com/acme/tools" });
    });


    it("keeps every segment of a nested GitLab project path", () => {
        const res = remoteUrlToWebInfo("git@gitlab.example.com:group/subgroup/project.git");
        expect(res.value).toEqual({
            host:       "gitlab.example.com",
            webAddress: "https://gitlab.example.com/group/subgroup/project"
        });
    });


    it("drops the user and port of an ssh:// URL", () => {
        const res = remoteUrlToWebInfo("ssh://git@gitlab.example.com:2222/group/project.git");
        expect(res.value).toEqual({
            host:       "gitlab.example.com",
            webAddress: "https://gitlab.example.com/group/project"
        });
    });


    it("drops the user and token of an https URL, and keeps the port", () => {
        const res = remoteUrlToWebInfo("https://me:s3cret-token@git.example.com:8443/acme/tools.git");
        expect(res.value).toEqual({
            host:       "git.example.com",
            webAddress: "https://git.example.com:8443/acme/tools"
        });
        expect(res.value!.webAddress).not.toContain("s3cret-token");
        expect(res.value!.webAddress).not.toContain("me@");
    });


    it("drops a trailing .git and a trailing slash", () => {
        expect(remoteUrlToWebInfo("https://github.com/acme/tools/").value!.webAddress)
        .toEqual("https://github.com/acme/tools");
        expect(remoteUrlToWebInfo("https://github.com/acme/tools.git/").value!.webAddress)
        .toEqual("https://github.com/acme/tools");
        expect(remoteUrlToWebInfo("https://github.com/acme/tools").value!.webAddress)
        .toEqual("https://github.com/acme/tools");
    });


    it("fails for an SSH host with no dot in its name", () => {
        const scp = remoteUrlToWebInfo("git@github-work:acme/tools.git");
        expect(scp.succeeded).toBeFalse();
        expect(scp.error).toContain("github-work");

        const ssh = remoteUrlToWebInfo("ssh://git@github-work/acme/tools.git");
        expect(ssh.succeeded).toBeFalse();
    });


    it("fails for an unsupported scheme or an unparseable URL", () => {
        expect(remoteUrlToWebInfo("file:///c:/repos/tools.git").succeeded).toBeFalse();
        expect(remoteUrlToWebInfo("C:\\repos\\tools.git").succeeded).toBeFalse();
        expect(remoteUrlToWebInfo("").succeeded).toBeFalse();
    });

});


describe("gitHostKind()", () => {

    it("recognizes GitHub and GitLab hosts by name", () => {
        expect(gitHostKind("github.com").value).toEqual("github");
        expect(gitHostKind("github.example.com").value).toEqual("github");
        expect(gitHostKind("gitlab.com").value).toEqual("gitlab");
        expect(gitHostKind("code.gitlab.example.com").value).toEqual("gitlab");
    });


    it("fails for any other host", () => {
        const res = gitHostKind("bitbucket.org");
        expect(res.succeeded).toBeFalse();
        expect(res.error).toContain("bitbucket.org");
    });

});


describe("buildPermalinkUrl()", () => {

    const hash = "0123456789abcdef0123456789abcdef01234567";


    it("builds a GitHub file URL with /blob/", () => {
        expect(buildPermalinkUrl("https://github.com/acme/tools", "github", hash, "src/a.ts", "file"))
        .toEqual(`https://github.com/acme/tools/blob/${hash}/src/a.ts`);
    });


    it("builds a GitHub directory URL with /tree/", () => {
        expect(buildPermalinkUrl("https://github.com/acme/tools", "github", hash, "src", "directory"))
        .toEqual(`https://github.com/acme/tools/tree/${hash}/src`);
    });


    it("builds GitLab URLs with /-/blob/ and /-/tree/", () => {
        expect(buildPermalinkUrl("https://gitlab.com/g/s/p", "gitlab", hash, "src/a.ts", "file"))
        .toEqual(`https://gitlab.com/g/s/p/-/blob/${hash}/src/a.ts`);
        expect(buildPermalinkUrl("https://gitlab.com/g/s/p", "gitlab", hash, "src", "directory"))
        .toEqual(`https://gitlab.com/g/s/p/-/tree/${hash}/src`);
    });


    it("percent-encodes each segment but keeps the slashes", () => {
        expect(buildPermalinkUrl("https://github.com/a/b", "github", hash, "my dir/a#b?c%d.txt", "file"))
        .toEqual(`https://github.com/a/b/blob/${hash}/my%20dir/a%23b%3Fc%25d.txt`);
    });


    it("links the repository root directory without a trailing slash", () => {
        expect(buildPermalinkUrl("https://github.com/a/b", "github", hash, "", "directory"))
        .toEqual(`https://github.com/a/b/tree/${hash}`);
    });


    describe("with lines", () => {

        const github = "https://github.com/a/b";
        const gitlab = "https://gitlab.com/g/p";


        it("anchors a single line the same way on GitHub and GitLab", () => {
            expect(buildPermalinkUrl(github, "github", hash, "src/a.ts", "file", { start: 10, end: 10 }))
            .toEqual(`${github}/blob/${hash}/src/a.ts#L10`);
            expect(buildPermalinkUrl(gitlab, "gitlab", hash, "src/a.ts", "file", { start: 10, end: 10 }))
            .toEqual(`${gitlab}/-/blob/${hash}/src/a.ts#L10`);
        });


        it("anchors a range as #L10-L20 on GitHub and #L10-20 on GitLab", () => {
            expect(buildPermalinkUrl(github, "github", hash, "src/a.ts", "file", { start: 10, end: 20 }))
            .toEqual(`${github}/blob/${hash}/src/a.ts#L10-L20`);
            expect(buildPermalinkUrl(gitlab, "gitlab", hash, "src/a.ts", "file", { start: 10, end: 20 }))
            .toEqual(`${gitlab}/-/blob/${hash}/src/a.ts#L10-20`);
        });


        it("puts ?plain=1 before the anchor for rendered file types, in either case", () => {
            for (const name of ["a.md", "a.rst", "a.adoc", "A.MD", "docs/Readme.Adoc"]) {
                expect(buildPermalinkUrl(github, "github", hash, name, "file", { start: 3, end: 4 }))
                .toEqual(`${github}/blob/${hash}/${name.split("/").map(encodeURIComponent).join("/")}?plain=1#L3-L4`);
            }
        });


        it("does not add ?plain=1 for other file types or when there are no lines", () => {
            expect(buildPermalinkUrl(github, "github", hash, "a.ts", "file", { start: 3, end: 3 }))
            .not.toContain("plain");
            expect(buildPermalinkUrl(github, "github", hash, "a.md", "file"))
            .toEqual(`${github}/blob/${hash}/a.md`);
        });


        it("never anchors a directory", () => {
            expect(buildPermalinkUrl(github, "github", hash, "src", "directory", { start: 3, end: 9 }))
            .toEqual(`${github}/tree/${hash}/src`);
        });

    });

});


describe("selectionToLineRange()", () => {

    it("gives a cursor its own line", () => {
        expect(selectionToLineRange({ line: 11, character: 4 }, { line: 11, character: 4 }))
        .toEqual({ start: 12, end: 12 });
    });


    it("gives a selection within one line that line", () => {
        expect(selectionToLineRange({ line: 11, character: 2 }, { line: 11, character: 9 }))
        .toEqual({ start: 12, end: 12 });
    });


    it("covers the lines of a multi-line selection", () => {
        expect(selectionToLineRange({ line: 11, character: 2 }, { line: 17, character: 5 }))
        .toEqual({ start: 12, end: 18 });
    });


    it("leaves out the line after a selection of whole lines that ends at column 0", () => {
        expect(selectionToLineRange({ line: 11, character: 0 }, { line: 17, character: 0 }))
        .toEqual({ start: 12, end: 17 });
    });

});
