import { describe, expect, it } from "vitest";
import { voidWire } from "./outcomes.mjs";


describe("outcomes", () => {

    describe("voidWire", () => {

        it("accepts undefined", () => {
            expect(voidWire.safeParse(undefined).success).toBe(true);
        });


        it("rejects a value", () => {
            expect(voidWire.safeParse("x").success).toBe(false);
        });

    });

});
