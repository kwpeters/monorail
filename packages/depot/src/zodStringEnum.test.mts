import * as z from "zod";
import { defineStringEnum, type StringEnumValue } from "./zodStringEnum.mjs";


const colorDef = defineStringEnum([
    "red",
    "green",
    "blue"
] as const);
// eslint-disable-next-line @typescript-eslint/naming-convention
const Color = colorDef.obj;
type Color = StringEnumValue<typeof colorDef>;


describe("defineStringEnum()", () => {

    describe("input validation", () => {

        it("rejects an empty values array", () => {
            expect(() => defineStringEnum([])).toThrowError("defineStringEnum() requires at least one value.");
        });

    });


    describe("obj", () => {

        it("maps each value to itself", () => {
            expect(Color.red).toEqual("red");
            expect(Color.blue).toEqual("blue");
        });

    });


    describe("values", () => {

        it("contains every literal", () => {
            expect(colorDef.values).toEqual(["red", "green", "blue"]);
        });

    });


    describe("schema", () => {

        it("accepts valid values", () => {
            expect(colorDef.schema.parse("red")).toEqual("red");
            expect(colorDef.schema.parse("blue")).toEqual("blue");
        });


        it("rejects invalid values", () => {
            expect(colorDef.schema.safeParse("purple").success).toBeFalse();
        });


        it("can be composed into a larger schema", () => {
            const schema = z.object({ color: colorDef.schema });
            const result = schema.safeParse({ color: "green" as Color });
            expect(result.success).toBeTrue();
        });

    });


    describe("isValue()", () => {

        it("returns true for valid enum values", () => {
            expect(colorDef.isValue("red")).toBeTrue();
            expect(colorDef.isValue("blue")).toBeTrue();
        });


        it("returns false for invalid enum values", () => {
            expect(colorDef.isValue("purple")).toBeFalse();
            expect(colorDef.isValue(1)).toBeFalse();
        });

    });


    describe("assertValue()", () => {

        it("does not throw for valid enum values", () => {
            expect(() => colorDef.assertValue("green")).not.toThrow();
        });


        it("throws for invalid enum values", () => {
            expect(() => colorDef.assertValue("purple")).toThrow();
        });

    });

});
