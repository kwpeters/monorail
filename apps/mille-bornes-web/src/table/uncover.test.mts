import { describe, expect, it } from "vitest";
import { scrollToUncover } from "./uncover.mjs";


describe("scrollToUncover()", () => {

    const hand = { top: 330, bottom: 552 };


    it("scrolls nothing when every target is above the hand with room to spare", () => {
        expect(scrollToUncover([{ top: 100, bottom: 144 }, { top: 200, bottom: 322 }], hand))
        .toBe(0);
    });


    it("scrolls nothing with no target", () => {
        expect(scrollToUncover([], hand)).toBe(0);
    });


    it("scrolls a target that is under the hand to 8 px above it", () => {
        expect(scrollToUncover([{ top: 480, bottom: 524 }], hand)).toBe(524 + 8 - 330);
    });


    it("keeps a gap for a target just touching the hand", () => {
        expect(scrollToUncover([{ top: 286, bottom: 330 }], hand)).toBe(8);
    });


    it("counts nothing as covered by a hand of no height", () => {
        expect(scrollToUncover([{ top: 0, bottom: 0 }], { top: 0, bottom: 0 })).toBe(0);
    });


    it("uncovers the lowest target, which brings the others up with it", () => {
        const lanes = [{ top: 250, bottom: 294 }, { top: 380, bottom: 424 }];
        const discard = { top: 500, bottom: 544 };
        expect(scrollToUncover([...lanes, discard], hand)).toBe(544 + 8 - 330);
    });

});
