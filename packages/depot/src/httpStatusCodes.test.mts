import {
    HttpSuccess,
    httpSuccessSchema,
    successHttpStatusCodeKey,
    HttpError,
    httpErrorSchema,
    errorHttpStatusCodeKey
} from "./httpStatusCodes.mjs";


describe("httpSuccessSchema", () => {

    it("accepts all valid 2xx status codes", () => {
        for (const statusCode of Object.values(HttpSuccess)) {
            const result = httpSuccessSchema.safeParse(statusCode);
            expect(result.success).toBeTrue();
            if (result.success) {
                expect(result.data).toBe(statusCode);
            }
        }
    });


    it("rejects status codes outside the 2xx range", () => {
        const invalidCodes = [100, 199, 300, 400, 500, 600];
        for (const code of invalidCodes) {
            const result = httpSuccessSchema.safeParse(code);
            expect(result.success).toBeFalse();
        }
    });


    it("rejects non-numeric values", () => {
        const invalidValues = ["200", null, undefined, {}, [], true];
        for (const value of invalidValues) {
            const result = httpSuccessSchema.safeParse(value);
            expect(result.success).toBeFalse();
        }
    });

});


describe("httpErrorSchema", () => {

    it("accepts all valid 4xx and 5xx status codes", () => {
        for (const statusCode of Object.values(HttpError)) {
            const result = httpErrorSchema.safeParse(statusCode);
            expect(result.success).toBeTrue();
            if (result.success) {
                expect(result.data).toBe(statusCode);
            }
        }
    });


    it("rejects status codes outside the 4xx and 5xx ranges", () => {
        const invalidCodes = [100, 200, 300, 399, 600];
        for (const code of invalidCodes) {
            const result = httpErrorSchema.safeParse(code);
            expect(result.success).toBeFalse();
        }
    });


    it("rejects non-numeric values", () => {
        const invalidValues = ["400", null, undefined, {}, [], true];
        for (const value of invalidValues) {
            const result = httpErrorSchema.safeParse(value);
            expect(result.success).toBeFalse();
        }
    });

});


describe("successHttpStatusCodeKey()", () => {

    it("returns keys for all valid status codes", () => {
        for (const [expectedKey, statusCode] of Object.entries(HttpSuccess)) {
            const actualKey = successHttpStatusCodeKey(statusCode);
            expect(actualKey).toBe(expectedKey);
        }
    });

});


describe("errorHttpStatusCodeKey()", () => {

    it("returns keys for all valid status codes", () => {
        for (const [expectedKey, statusCode] of Object.entries(HttpError)) {
            const actualKey = errorHttpStatusCodeKey(statusCode);
            expect(actualKey).toBe(expectedKey);
        }
    });

});
