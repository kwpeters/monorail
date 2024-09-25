import { buildIndex } from "./iterableHelpers.mjs";


describe("iterableHelpers", () => {

    describe("buildIndex()", () => {

        const people = [
            {first: "Fred", last: "Flintstone"},
            {first: "Wilma", last: "Flintstone"},
            {first: "Betty", last: "Rubble"},
            {first: "Barney", last: "Rubble"}
        ];

        it("builds the expected Map", () => {

            const personMap = buildIndex(people, (p) => p.first);
            expect(Array.from(personMap.entries())).toEqual([
                ["Fred", { first: "Fred", last: "Flintstone" }],
                ["Wilma", { first: "Wilma", last: "Flintstone" }],
                ["Betty", { first: "Betty", last: "Rubble" }],
                ["Barney", { first: "Barney", last: "Rubble" }]
            ]);

        });


    });

});
