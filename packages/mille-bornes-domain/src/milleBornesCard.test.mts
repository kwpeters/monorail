import { schMilleBornesCard, standardCardCountFn } from "./milleBornesCard.mjs";


describe("standardCardCountFn()", () => {

    it("returns the expected total number of cards", () => {
        const total = schMilleBornesCard.options.reduce((acc, card) => acc + standardCardCountFn(card), 0);
        expect(total).toEqual(106);
    });

});
