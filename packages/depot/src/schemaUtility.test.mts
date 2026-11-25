//
// At least a portion of the code below was created using AI tool GitHub Copilot.
//
import { z } from "zod";
import { NoneOption, SomeOption } from "./option.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import {
    discriminatedOptionSchema,
    discriminatedResultSchema,
    fileSystemPathSchema,
    normalizePathSeparators,
    optionalValueToOptionSchema,
    regexpSchema,
    resultToWire
} from "./schemaUtility.mjs";


describe("discriminatedOptionSchema()", () => {

    it("can validate and transform a some option", () => {
        const schema = discriminatedOptionSchema(z.string());
        const result = schema.safeParse({ isSome: true, value: "test" });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(new SomeOption("test"));
    });


    it("can validate and transform a none option", () => {
        const schema = discriminatedOptionSchema(z.string());
        const result = schema.safeParse({ isSome: false });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(NoneOption.get());
    });


    it("will fail to parse a some option that has no value", () => {
        const schema = discriminatedOptionSchema(z.string());
        const result = schema.safeParse({ isSome: true });
        expect(result.success).toBe(false);
    });


    it("will fail to parse a none option that has a value", () => {
        const schema = discriminatedOptionSchema(z.string());
        const result = schema.safeParse({ isSome: false, value: "test" });
        expect(result.success).toBe(false);
    });
});


describe("resultToWire()", () => {

    it("encodes a succeeded result as exactly succeeded and value", () => {
        const wire = resultToWire(new SucceededResult(5));
        expect(wire).toEqual({ succeeded: true, value: 5 });
        expect(Object.keys(wire).sort()).toEqual(["succeeded", "value"]);
    });


    it("encodes a failed result as exactly succeeded and error", () => {
        const wire = resultToWire(new FailedResult("no"));
        expect(wire).toEqual({ succeeded: false, error: "no" });
        expect(Object.keys(wire).sort()).toEqual(["error", "succeeded"]);
    });

});


describe("discriminatedResultSchema()", () => {

    function roundTrip<TValue, TError>(r: Result<TValue, TError>): unknown {
        return JSON.parse(JSON.stringify(resultToWire(r)));
    }


    it("round trips a succeeded result through JSON", () => {
        const schema = discriminatedResultSchema(z.number(), z.string());
        const parsed = schema.safeParse(roundTrip(new SucceededResult(5)));
        expect(parsed.success).toBe(true);
        const r = parsed.data!;
        expect(r.succeeded).toBe(true);
        expect(r.failed).toBe(false);
        expect(r.value).toBe(5);
        expect(r.match((v) => `ok ${v}`, (e) => `bad ${e}`)).toBe("ok 5");
    });


    it("round trips a failed result through JSON", () => {
        const schema = discriminatedResultSchema(z.number(), z.string());
        const parsed = schema.safeParse(roundTrip(new FailedResult("no")));
        expect(parsed.success).toBe(true);
        const r = parsed.data!;
        expect(r.succeeded).toBe(false);
        expect(r.failed).toBe(true);
        expect(r.error).toBe("no");
        expect(r.match((v) => `ok ${v}`, (e) => `bad ${e}`)).toBe("bad no");
    });


    it("round trips a void success when the value schema is z.void()", () => {
        const r: Result<void, string> = new SucceededResult(undefined);
        const json = JSON.stringify(resultToWire(r));
        expect(json).toBe("{\"succeeded\":true}");
        const schema = discriminatedResultSchema(z.void(), z.string());
        const parsed = schema.safeParse(JSON.parse(json));
        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual(new SucceededResult(undefined));
    });


    it("round trips a void success when the value schema is z.undefined()", () => {
        const schema = discriminatedResultSchema(z.undefined(), z.string());
        const parsed = schema.safeParse({ succeeded: true });
        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual(new SucceededResult(undefined));
    });


    it("rejects a success with no value when the value schema requires one", () => {
        const schema = discriminatedResultSchema(z.number(), z.string());
        expect(schema.safeParse({ succeeded: true }).success).toBe(false);
    });


    it("accepts a failure with no error when the error schema accepts undefined", () => {
        const schema = discriminatedResultSchema(z.number(), z.undefined());
        const parsed = schema.safeParse({ succeeded: false });
        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual(new FailedResult(undefined));
    });


    it("rejects a failure with no error when the error schema requires one", () => {
        const schema = discriminatedResultSchema(z.number(), z.string());
        expect(schema.safeParse({ succeeded: false }).success).toBe(false);
    });


    it("rejects malformed input", () => {
        const schema = discriminatedResultSchema(z.number(), z.string());
        const bad: Array<unknown> = [
            { succeeded: true, value: 5, extra: 1 },
            { succeeded: false, error: "no", extra: 1 },
            {},
            null,
            { succeeded: "yes" },
            { succeeded: true, value: "five" },
            { succeeded: false, error: 7 },
            { succeeded: true, error: "x" }
        ];
        for (const input of bad) {
            expect(schema.safeParse(input).success).toBe(false);
        }
    });


    it("round trips a result whose value is an object with a nested array", () => {
        const valueSchema = z.object({ name: z.string(), items: z.array(z.object({ n: z.number() })) });
        const schema = discriminatedResultSchema(valueSchema, z.string());
        const value = { name: "x", items: [{ n: 1 }, { n: 2 }] };
        const parsed = schema.safeParse(roundTrip(new SucceededResult(value)));
        expect(parsed.success).toBe(true);
        expect(parsed.data!.value).toEqual(value);
    });

});


describe("optionalValueToOptionSchema()", () => {

    it("transforms undefined into NoneOption", () => {
        const schema = optionalValueToOptionSchema(z.string());
        const result = schema.safeParse(undefined);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(NoneOption.get());
    });


    it("transforms a defined value into SomeOption", () => {
        const schema = optionalValueToOptionSchema(z.string());
        const result = schema.safeParse("test");
        expect(result.success).toBe(true);
        expect(result.data).toEqual(new SomeOption("test"));
    });


    it("maps an omitted object property to NoneOption", () => {
        const schema = z.object({
            required:      z.string(),
            optionalValue: optionalValueToOptionSchema(z.number())
        });
        const result = schema.safeParse({ required: "test" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.optionalValue).toEqual(NoneOption.get());
        }
    });


    it("maps a present object property to SomeOption", () => {
        const schema = z.object({
            required:      z.string(),
            optionalValue: optionalValueToOptionSchema(z.number())
        });
        const result = schema.safeParse({ required: "test", optionalValue: 42 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.optionalValue).toEqual(new SomeOption(42));
        }
    });


    it("fails when a present value does not match the wrapped schema", () => {
        const schema = optionalValueToOptionSchema(z.number());
        const result = schema.safeParse("not a number");
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
