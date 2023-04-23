import { hr } from "../src/ttyHelpers.js";


describe("hr()", () => {
    it("returns a horizontal rule string", () => {
        expect(hr("-").length).toBeGreaterThan(0);
    });
});
