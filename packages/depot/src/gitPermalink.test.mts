import { buildPermalinkUrl, gitHostKind, remoteUrlToWebInfo } from "./gitPermalink.mjs";


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

});
