import { hr } from "./ttyHelpers.mjs";


describe("hr()", () => {
    it("returns a horizontal rule string", () => {
        expect(hr("-").length).toBeGreaterThan(0);
    });
});
