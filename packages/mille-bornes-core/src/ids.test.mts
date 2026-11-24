import { GameId, PlayerId, TeamIndex } from "./ids.mjs";


const canonical = "9f7bc8b7-a483-43a7-8c3a-df36fe59e9b4";
const nonCanonical = [
    canonical.toUpperCase(),
    canonical.replace(/-/g, ""),
    "9f7bc8b7a-483-43a7-8c3a-df36fe59e9b4",
    ` ${canonical} `,
    `${canonical}
`
];


describe("ids", () => {

    describe("PlayerId", () => {

        it("create() returns distinct values that tryCreate() accepts back", () => {
            const a = PlayerId.create();
            const b = PlayerId.create();
            expect(a).not.toEqual(b);
            expect(PlayerId.tryCreate(a).throwIfFailed()).toEqual(a);
        });


        it("tryCreate() rejects an empty or malformed string", () => {
            expect(PlayerId.tryCreate("").failed).toBeTrue();
            expect(PlayerId.tryCreate("not-a-uuid").failed).toBeTrue();
        });


        it("tryCreate() accepts only the canonical lowercase dashed form", () => {
            expect(PlayerId.tryCreate(canonical).succeeded).toBeTrue();
            for (const bad of nonCanonical) {
                expect(PlayerId.tryCreate(bad).failed).toBeTrue();
            }
        });

    });


    describe("GameId", () => {

        it("create() returns distinct values that tryCreate() accepts back", () => {
            const a = GameId.create();
            const b = GameId.create();
            expect(a).not.toEqual(b);
            expect(GameId.tryCreate(a).throwIfFailed()).toEqual(a);
        });


        it("tryCreate() rejects an empty or malformed string", () => {
            expect(GameId.tryCreate("").failed).toBeTrue();
            expect(GameId.tryCreate("not-a-uuid").failed).toBeTrue();
        });


        it("tryCreate() accepts only the canonical lowercase dashed form", () => {
            expect(GameId.tryCreate(canonical).succeeded).toBeTrue();
            for (const bad of nonCanonical) {
                expect(GameId.tryCreate(bad).failed).toBeTrue();
            }
        });

    });


    describe("TeamIndex.tryCreate()", () => {

        it("accepts 0, 1 and 2", () => {
            for (const n of [0, 1, 2]) {
                expect(TeamIndex.tryCreate(n).succeeded).toBeTrue();
            }
        });


        it("rejects values outside 0..2 and non-integers", () => {
            for (const bad of [3, -1, 1.5, NaN]) {
                expect(TeamIndex.tryCreate(bad).failed).toBeTrue();
            }
        });

    });

});
