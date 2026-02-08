import * as z from "zod";
import { zodErrorToString, zodResultToResult, safeParse, safeParseAsync } from "./zodHelpers.mjs";
import { SucceededResult, FailedResult } from "./result.mjs";
import { pipe } from "./pipe2.mjs";
import { pipeAsync } from "./pipeAsync2.mjs";


describe("zodErrorToString()", () => {

    it("should format a single error with a path", () => {
        const schema = z.object({ name: z.string() });
        const result = schema.safeParse({ name: 123 });

        if (result.success) {
            fail("Expected validation to fail");
            return;
        }

        const errorString = zodErrorToString(result.error);
        expect(errorString).toContain("name");
        expect(errorString).toContain("string");
    });


    it("should format a single error without a path", () => {
        const schema = z.string();
        const result = schema.safeParse(123);

        if (result.success) {
            fail("Expected validation to fail");
            return;
        }

        const errorString = zodErrorToString(result.error);
        // Top-level errors have no path, should just contain the message
        expect(errorString).toContain("string");
    });


    it("should format multiple errors with paths", () => {
        const schema = z.object({
            name: z.string(),
            age:  z.number()
        });
        const result = schema.safeParse({ name: 123, age: "not a number" });

        if (result.success) {
            fail("Expected validation to fail");
            return;
        }

        const errorString = zodErrorToString(result.error);
        expect(errorString).toContain("name");
        expect(errorString).toContain("age");
        expect(errorString).toContain(";");
    });


    it("should format nested path errors", () => {
        const schema = z.object({
            user: z.object({
                profile: z.object({
                    email: z.string().email()
                })
            })
        });
        const result = schema.safeParse({
            user: { profile: { email: "not-an-email" } }
        });

        if (result.success) {
            fail("Expected validation to fail");
            return;
        }

        const errorString = zodErrorToString(result.error);
        expect(errorString).toContain("user.profile.email");
    });


    it("should join multiple errors with semicolons", () => {
        const schema = z.object({
            name:  z.string(),
            age:   z.number(),
            email: z.string().email()
        });
        const result = schema.safeParse({
            name:  123,
            age:   "not a number",
            email: "invalid"
        });

        if (result.success) {
            fail("Expected validation to fail");
            return;
        }

        const errorString = zodErrorToString(result.error);
        const parts = errorString.split("; ");
        expect(parts.length).toBeGreaterThan(1);
    });

});


describe("zodResultToResult()", () => {

    it("should return SucceededResult when zodResult is successful", () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const val = pipe(
            schema.safeParse({ name: "John", age: 30 }),
            zodResultToResult,
            (res) => res.throwIfFailed()
        );
        expect(val).toEqual({ name: "John", age: 30 });
    });


    it("should return FailedResult when zodResult fails", () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const err = pipe(
            schema.safeParse({ name: 123, age: "not a number" }),
            zodResultToResult,
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("name");
        expect(err).toContain("age");
    });


    it("should preserve data types in SucceededResult", () => {
        const schema = z.object({
            count:  z.number(),
            active: z.boolean(),
            tags:   z.array(z.string())
        });
        const data = { count: 42, active: true, tags: ["a", "b", "c"] };
        const val = pipe(
            schema.safeParse(data),
            zodResultToResult,
            (res) => res.throwIfFailed()
        );

        expect(val).toEqual(data);
        expect(typeof val.count).toBe("number");
        expect(typeof val.active).toBe("boolean");
        expect(Array.isArray(val.tags)).toBe(true);
    });


    it("should convert error messages to human-readable format", () => {
        const schema = z.object({
            user: z.object({
                email: z.email()
            })
        });
        const err = pipe(
            schema.safeParse({
                user: { email: "not-an-email" }
            }),
            zodResultToResult,
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("user.email");
    });

});


describe("safeParse()", () => {

    it("should return SucceededResult when parsing valid data", () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const val = pipe(
            safeParse(schema, { name: "Alice", age: 25 }),
            (res) => res.throwIfFailed()
        );

        expect(val).toEqual({ name: "Alice", age: 25 });
    });


    it("should return FailedResult when parsing invalid data", () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const err = pipe(
            safeParse(schema, { name: 123, age: "not a number" }),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("name");
        expect(err).toContain("age");
    });


    it("should handle primitive type validation", () => {
        const schema = z.string();
        const val = pipe(
            safeParse(schema, "hello"),
            (res) => res.throwIfFailed()
        );

        expect(val).toBe("hello");
    });


    it("should handle primitive type validation failure", () => {
        const schema = z.string();
        const err = pipe(
            safeParse(schema, 123),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("string");
    });


    it("should handle array validation", () => {
        const schema = z.array(z.number());
        const val = pipe(
            safeParse(schema, [1, 2, 3]),
            (res) => res.throwIfFailed()
        );

        expect(val).toEqual([1, 2, 3]);
    });


    it("should handle array validation failure", () => {
        const schema = z.array(z.number());
        const err = pipe(
            safeParse(schema, [1, "two", 3]),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("1");
    });


    it("should handle nested object validation", () => {
        const schema = z.object({
            user: z.object({
                email:   z.email(),
                profile: z.object({
                    age: z.number()
                })
            })
        });
        const val = pipe(
            safeParse(schema, {
                user: { email: "test@example.com", profile: { age: 30 } }
            }),
            (res) => res.throwIfFailed()
        );

        expect(val.user.email).toBe("test@example.com");
        expect(val.user.profile.age).toBe(30);
    });


    it("should handle nested object validation failure", () => {
        const schema = z.object({
            user: z.object({
                email: z.string().email()
            })
        });
        const err = pipe(
            safeParse(schema, {
                user: { email: "invalid-email" }
            }),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("user.email");
    });

});


describe("safeParseAsync()", () => {

    it("should return SucceededResult when parsing valid data", async () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const val = await pipeAsync(
            safeParseAsync(schema, { name: "Bob", age: 35 }),
            (res) => res.throwIfFailed()
        );

        expect(val).toEqual({ name: "Bob", age: 35 });
    });


    it("should return FailedResult when parsing invalid data", async () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const err = await pipeAsync(
            safeParseAsync(schema, { name: 123, age: "not a number" }),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("name");
        expect(err).toContain("age");
    });


    it("should handle primitive type validation", async () => {
        const schema = z.string();
        const val = await pipeAsync(
            safeParseAsync(schema, "world"),
            (res) => res.throwIfFailed()
        );

        expect(val).toBe("world");
    });


    it("should handle primitive type validation failure", async () => {
        const schema = z.string();
        const err = await pipeAsync(
            safeParseAsync(schema, 456),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("string");
    });


    it("should handle array validation", async () => {
        const schema = z.array(z.number());
        const val = await pipeAsync(
            safeParseAsync(schema, [4, 5, 6]),
            (res) => res.throwIfFailed()
        );

        expect(val).toEqual([4, 5, 6]);
    });


    it("should handle array validation failure", async () => {
        const schema = z.array(z.number());
        const err = await pipeAsync(
            safeParseAsync(schema, [4, "five", 6]),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("1");
    });


    it("should handle nested object validation", async () => {
        const schema = z.object({
            user: z.object({
                email:   z.string().email(),
                profile: z.object({
                    age: z.number()
                })
            })
        });
        const val = await pipeAsync(
            safeParseAsync(schema, {
                user: { email: "async@example.com", profile: { age: 40 } }
            }),
            (res) => res.throwIfFailed()
        );

        expect(val.user.email).toBe("async@example.com");
        expect(val.user.profile.age).toBe(40);
    });


    it("should handle nested object validation failure", async () => {
        const schema = z.object({
            user: z.object({
                email: z.string().email()
            })
        });
        const err = await pipeAsync(
            safeParseAsync(schema, {
                user: { email: "bad-email" }
            }),
            (res) => res.throwIfSucceeded()
        );

        expect(err).toContain("user.email");
    });

});
