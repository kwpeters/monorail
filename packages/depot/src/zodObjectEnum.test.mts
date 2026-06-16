import * as z from "zod";
import { defineObjectEnum, type ObjectEnumValue, type ObjectEnumKey } from "./zodObjectEnum.mjs";


const connectionStateDef = defineObjectEnum({
    closed:  0,
    opening: 1,
    open:    2,
    closing: 3
});
// eslint-disable-next-line @typescript-eslint/naming-convention
const ConnectionState = connectionStateDef.obj;
type ConnectionState = ObjectEnumValue<typeof connectionStateDef>;
type ConnectionStateName = ObjectEnumKey<typeof connectionStateDef>;


describe("defineObjectEnum()", () => {

    describe("input validation", () => {

        it("rejects an empty source object", () => {
            expect(() => defineObjectEnum({})).toThrowError("defineObjectEnum() requires at least one key/value pair.");
        });

    });


    describe("obj", () => {

        it("exposes the original source object", () => {
            expect(ConnectionState.closed).toEqual(0);
            expect(ConnectionState.closing).toEqual(3);
        });

    });


    describe("keys", () => {

        it("contains every string key", () => {
            expect(connectionStateDef.keys).toEqual(["closed", "opening", "open", "closing"]);
        });

    });


    describe("values", () => {

        it("contains every value", () => {
            expect(connectionStateDef.values).toEqual([0, 1, 2, 3]);
        });

    });


    describe("schemaValue", () => {

        it("accepts valid values", () => {
            expect(connectionStateDef.schemaValue.parse(0)).toEqual(0);
            expect(connectionStateDef.schemaValue.parse(3)).toEqual(3);
        });


        it("rejects invalid values", () => {
            expect(connectionStateDef.schemaValue.safeParse(99).success).toBeFalse();
        });


        it("can be composed into a larger schema", () => {
            const schema = z.object({ connectionState: connectionStateDef.schemaValue });
            const result = schema.safeParse({ connectionState: 2 });
            expect(result.success).toBeTrue();
        });

    });


    describe("schemaKey", () => {

        it("accepts valid keys", () => {
            expect(connectionStateDef.schemaKey.parse("closed")).toEqual("closed");
        });


        it("rejects invalid keys", () => {
            expect(connectionStateDef.schemaKey.safeParse("nope").success).toBeFalse();
        });

    });


    describe("isValue()", () => {

        it("returns true for valid enum values", () => {
            expect(connectionStateDef.isValue(0)).toBeTrue();
            expect(connectionStateDef.isValue(3)).toBeTrue();
        });


        it("returns false for invalid enum values", () => {
            expect(connectionStateDef.isValue(99)).toBeFalse();
            expect(connectionStateDef.isValue("closed")).toBeFalse();
        });

    });


    describe("assertValue()", () => {

        it("does not throw for valid enum values", () => {
            expect(() => connectionStateDef.assertValue(1)).not.toThrow();
        });


        it("throws for invalid enum values", () => {
            expect(() => connectionStateDef.assertValue(99)).toThrow();
        });

    });


    describe("isKey()", () => {

        it("returns true for valid enum keys", () => {
            expect(connectionStateDef.isKey("closed")).toBeTrue();
            expect(connectionStateDef.isKey("closing")).toBeTrue();
        });


        it("returns false for invalid enum keys", () => {
            expect(connectionStateDef.isKey("nope")).toBeFalse();
            expect(connectionStateDef.isKey(0)).toBeFalse();
        });

    });


    describe("assertKey()", () => {

        it("does not throw for valid enum keys", () => {
            expect(() => connectionStateDef.assertKey("open")).not.toThrow();
        });


        it("throws for invalid enum keys", () => {
            expect(() => connectionStateDef.assertKey("nope")).toThrow();
        });

    });


    describe("keyForValue()", () => {

        it("returns the string key for a value", () => {
            expect(connectionStateDef.keyForValue(connectionStateDef.obj.closed)).toEqual("closed");
            expect(connectionStateDef.keyForValue(connectionStateDef.obj.closing)).toEqual("closing");
        });


        it("returns the last key when multiple keys share the same value", () => {
            const duplicateValueDef = defineObjectEnum({
                first:  1,
                second: 1,
                third:  2
            });

            expect(duplicateValueDef.keyForValue(1)).toEqual("second");
        });

    });

});
