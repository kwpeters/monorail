import { greet } from "./sampleModule.mjs";

describe("sample test", () => {

    it("runs successfully", () => {
        const str = greet("Fred");
        expect(str.length).toBeGreaterThan(4);
    });
});
