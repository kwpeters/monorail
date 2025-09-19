import { buildIndex, findFirstDuplicateBy } from "./iterableHelpers.mjs";
import { NoneOption, SomeOption } from "./option.mjs";


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


describe("findFirstDuplicateBy()", () => {

    const people = [
        {first: "Fred", last: "Flintstone"},
        {first: "Wilma", last: "Flintstone"},
        {first: "Betty", last: "Rubble"},
        {first: "Barney", last: "Rubble"}
    ];


    it("returns NoneOption when there are no duplicates", () => {

        const result = findFirstDuplicateBy(people, (p) => p.first);
        expect(result).toEqual(NoneOption.get());

    });


    it("returns SomeOption when a duplicate is found", () => {

        const result = findFirstDuplicateBy(people, (p) => p.last);
        expect(result).toEqual(new SomeOption({ elem: people[1]!, criterion: "Flintstone" }));

    });

});
