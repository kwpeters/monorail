//
// At least a portion of the code below was created using AI tool GitHub Copilot.
//
import { z } from "zod";
import { NoneOption, SomeOption } from "./option.mjs";
import {
    fileSystemPathSchema,
    normalizePathSeparators,
    optionSchema,
    regexpSchema
} from "./schemaUtility.mjs";


describe("optionSchema()", () => {

    it("can validate and transform a some option", () => {
        const schema = optionSchema(z.string());
        const result = schema.safeParse({ isSome: true, value: "test" });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(new SomeOption("test"));
    });


    it("can validate and transform a none option", () => {
        const schema = optionSchema(z.string());
        const result = schema.safeParse({ isSome: false });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(NoneOption.get());
    });


    it("will fail to parse a some option that has no value", () => {
        const schema = optionSchema(z.string());
        const result = schema.safeParse({ isSome: true });
        expect(result.success).toBe(false);
    });


    it("will fail to parse a none option that has a value", () => {
        const schema = optionSchema(z.string());
        const result = schema.safeParse({ isSome: false, value: "test" });
        expect(result.success).toBe(false);
    });
});


describe("regexpSchema()", () => {

    it("can validate and transform a valid regular expression string", () => {
        const schema = regexpSchema();
        const result = schema.safeParse("test");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeInstanceOf(RegExp);
            expect(result.data.source).toBe("test");
        }
    });


    it("can validate and transform a complex regular expression with flags", () => {
        const schema = regexpSchema();
        const result = schema.safeParse("\\d+");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeInstanceOf(RegExp);
            expect(result.data.source).toBe("\\d+");
        }
    });


    it("can validate and transform an empty regular expression", () => {
        const schema = regexpSchema();
        const result = schema.safeParse("");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeInstanceOf(RegExp);
            expect(result.data.source).toBe("(?:)");
        }
    });


    it("will fail to parse an invalid regular expression", () => {
        const schema = regexpSchema();
        const result = schema.safeParse("[unclosed");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.length).toBe(1);
            expect(result.error.issues[0]?.code).toBe("custom");
            expect(result.error.issues[0]?.message).toContain("Invalid regular expression");
        }
    });


    it("will fail to parse a regular expression with invalid named group syntax", () => {
        const schema = regexpSchema();
        const result = schema.safeParse("(?P<test>)");  // Invalid named group syntax in JavaScript
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.length).toBe(1);
            expect(result.error.issues[0]?.code).toBe("custom");
            expect(result.error.issues[0]?.message).toContain("Invalid regular expression");
        }
    });


    it("can validate and transform special regex characters ^ and $", () => {
        const schema = regexpSchema();
        const result = schema.safeParse("^test$");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeInstanceOf(RegExp);
            expect(result.data.source).toBe("^test$");
        }
    });

});


describe("fileSystemPathSchema()", () => {

    it("normalizes path separators to backslashes", () => {
        const schema = fileSystemPathSchema(() => "\\");
        const result = schema.safeParse("C:/temp\\my/file.txt");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe("C:\\temp\\my\\file.txt");
        }
    });


    it("normalizes path separators to forward slashes", () => {
        const schema = fileSystemPathSchema(() => "/");
        const result = schema.safeParse("/tmp\\my/path\\file.txt");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe("/tmp/my/path/file.txt");
        }
    });


    it("fails to parse non-string input", () => {
        const schema = fileSystemPathSchema(() => "/");
        const result = schema.safeParse(42);
        expect(result.success).toBe(false);
    });
});


describe("normalizePathSeparators()", () => {

    it("normalizes mixed separators to backslashes", () => {
        const result = normalizePathSeparators("a\\b/c\\d/e", "\\");
        expect(result).toBe("a\\b\\c\\d\\e");
    });


    it("normalizes mixed separators to forward slashes", () => {
        const result = normalizePathSeparators("a\\b/c\\d/e", "/");
        expect(result).toBe("a/b/c/d/e");
    });
});
