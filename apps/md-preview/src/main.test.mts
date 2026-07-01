import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
    buildPreviewUrls,
    composeStylesheet,
    createRendererForTests,
    dedupePaths,
    getOutputHtmlPath,
    isAbsoluteUrlOrFragment,
    renderFilesToTempForTests,
    rewriteAndCopyAssetsForTests,
    validateAndNormalizeInputs,
    validateRunMode
} from "./main.mjs";


describe("md-preview helpers", () => {

    describe("dedupePaths()", () => {

        it("deduplicates equivalent paths after normalization", () => {
            const input = [
                "./README.md",
                path.join(".", "README.md"),
                "./src/../README.md"
            ];

            const actual = dedupePaths(input);
            expect(actual.length).toBe(1);
            expect(actual[0]).toBe("./README.md");
        });
    });


    describe("isAbsoluteUrlOrFragment()", () => {

        it("returns true for absolute URLs and fragments", () => {
            expect(isAbsoluteUrlOrFragment("https://example.com"))
            .toBeTrue();
            expect(isAbsoluteUrlOrFragment("mailto:test@example.com"))
            .toBeTrue();
            expect(isAbsoluteUrlOrFragment("#section-1"))
            .toBeTrue();
        });


        it("returns false for relative paths", () => {
            expect(isAbsoluteUrlOrFragment("assets/img.png"))
            .toBeFalse();
            expect(isAbsoluteUrlOrFragment("../docs/file.md"))
            .toBeFalse();
        });
    });


    describe("validateAndNormalizeInputs()", () => {

        it("accepts and deduplicates valid markdown inputs", async () => {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-preview-test-"));

            try {
                const aPath = path.join(tempDir, "a.md");
                const bPath = path.join(tempDir, "b.markdown");
                await fs.writeFile(aPath, "# a", "utf8");
                await fs.writeFile(bPath, "# b", "utf8");

                const result = await validateAndNormalizeInputs([aPath, aPath], [bPath]);

                expect(result.succeeded).toBeTrue();
                if (result.succeeded) {
                    expect(result.inputs.length).toBe(2);
                }
            }
            finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });


        it("returns exit code 1 when an invalid input exists", async () => {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-preview-test-"));

            try {
                const badPath = path.join(tempDir, "bad.txt");
                await fs.writeFile(badPath, "x", "utf8");

                const result = await validateAndNormalizeInputs([badPath], []);

                expect(result.succeeded).toBeFalse();
                if (!result.succeeded) {
                    expect(result.exitCode).toBe(1);
                }
            }
            finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });


    describe("createRendererForTests()", () => {

        it("renders inline code spans", () => {
            const renderer = createRendererForTests();

            const html = renderer.render("Use `assertNever` in default cases.");

            expect(html).toContain("<code>assertNever</code>");
        });


        it("renders fenced code blocks with highlight classes", () => {
            const renderer = createRendererForTests();

            const html = renderer.render("```ts\nconst value = 1;\n```");

            expect(html).toContain("<pre><code class=\"hljs language-ts\">");
        });


        it("renders markdown emoji shortcodes", () => {
            const renderer = createRendererForTests();

            const html = renderer.render("Looks good :smile:");

            expect(html).toContain("😄");
        });
    });


    describe("renderFilesToTempForTests()", () => {

        it("writes output using foo.md -> foo.html mapping and later wins on basename collisions", async () => {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-preview-test-"));

            try {
                const firstDir = path.join(tempDir, "first");
                const secondDir = path.join(tempDir, "second");
                await fs.mkdir(firstDir, { recursive: true });
                await fs.mkdir(secondDir, { recursive: true });

                const firstPath = path.join(firstDir, "same.md");
                const secondPath = path.join(secondDir, "same.md");
                await fs.writeFile(firstPath, "first", "utf8");
                await fs.writeFile(secondPath, "second", "utf8");

                const renderedCount = await renderFilesToTempForTests(
                    [
                        { absolutePath: firstPath, baseName: "same" },
                        { absolutePath: secondPath, baseName: "same" }
                    ],
                    tempDir
                );

                expect(renderedCount).toBe(2);

                const outPath = getOutputHtmlPath(tempDir, "same");
                const outHtml = await fs.readFile(outPath, "utf8");
                expect(outHtml).toContain("<p>second</p>");
            }
            finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });


    describe("rewriteAndCopyAssetsForTests()", () => {

        it("copies relative assets and leaves absolute or fragment links unchanged", async () => {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-preview-test-"));

            try {
                const sourceDir = path.join(tempDir, "src");
                const outDir = path.join(tempDir, "out");
                await fs.mkdir(sourceDir, { recursive: true });
                await fs.mkdir(outDir, { recursive: true });

                const sourceFile = path.join(sourceDir, "doc.md");
                const imagePath = path.join(sourceDir, "img.png");
                await fs.writeFile(sourceFile, "# doc", "utf8");
                await fs.writeFile(imagePath, "png", "utf8");

                const sourceText = [
                    "![img](img.png)",
                    "[site](https://example.com)",
                    "[section](#local-anchor)",
                    "<img src=\"img.png\">"
                ].join("\n");

                const rewritten = await rewriteAndCopyAssetsForTests(sourceText, sourceFile, outDir);

                expect(rewritten).toContain("![img](img.png)");
                expect(rewritten).toContain("[site](https://example.com)");
                expect(rewritten).toContain("[section](#local-anchor)");
                expect(rewritten).toContain("<img src=\"img.png\">");

                const copiedImage = await fs.readFile(path.join(outDir, "img.png"), "utf8");
                expect(copiedImage).toBe("png");
            }
            finally {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });
    });


    describe("buildPreviewUrls()", () => {

        it("returns both local and LAN URLs when LAN host exists", () => {
            const urls = buildPreviewUrls(8080, "10.0.0.5");

            expect(urls.localUrl).toBe("http://localhost:8080/");
            expect(urls.lanUrl).toBe("http://10.0.0.5:8080/");
        });


        it("returns only local URL when LAN host is unavailable", () => {
            const urls = buildPreviewUrls(8080, undefined);

            expect(urls.localUrl).toBe("http://localhost:8080/");
            expect(urls.lanUrl).toBeUndefined();
        });
    });


    describe("validateRunMode()", () => {

        it("returns exit code 3 for non-interactive mode without timeout", () => {
            expect(validateRunMode(false, undefined)).toBe(3);
        });


        it("accepts non-interactive mode with timeout", () => {
            expect(validateRunMode(false, 1000)).toBeUndefined();
        });


        it("accepts interactive mode without timeout", () => {
            expect(validateRunMode(true, undefined)).toBeUndefined();
        });
    });


    describe("composeStylesheet()", () => {

        it("includes inline-code and code-block fallback rules", () => {
            const css = composeStylesheet("/* markdown */", "/* highlight */");

            expect(css).toContain(".markdown-body :not(pre) > code");
            expect(css).toContain(".markdown-body pre {");
            expect(css).toContain(".markdown-body blockquote {");
        });


        it("includes VS Code fallback tokens used by code styles", () => {
            const css = composeStylesheet("/* markdown */", "/* highlight */");

            expect(css).toContain("--vscode-textPreformat-foreground");
            expect(css).toContain("--vscode-textCodeBlock-background");
            expect(css).toContain("--vscode-textBlockQuote-border");
        });
    });
});
