import * as path from "node:path";
import {
    composeStylesheet,
    createRendererForTests,
    dedupePaths,
    isAbsoluteUrlOrFragment
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


    describe("composeStylesheet()", () => {

        it("includes inline-code and code-block fallback rules", () => {
            const css = composeStylesheet("/* markdown */", "/* highlight */");

            expect(css).toContain(".markdown-body :not(pre) > code");
            expect(css).toContain(".markdown-body pre {");
        });


        it("includes VS Code fallback tokens used by code styles", () => {
            const css = composeStylesheet("/* markdown */", "/* highlight */");

            expect(css).toContain("--vscode-textPreformat-foreground");
            expect(css).toContain("--vscode-textCodeBlock-background");
        });
    });
});
