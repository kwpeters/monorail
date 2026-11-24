import { seatOrder, validateGameConfig, type GameConfig, type Seat } from "./game.mjs";
import { oneOnOne, seatFor, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";


function withTeams(teams: ReadonlyArray<ReadonlyArray<string>>): GameConfig {
    return { ...twoByTwo(), teams: teams.map((team) => team.map((name) => seatFor(name))) };
}


describe("game", () => {

    describe("validateGameConfig()", () => {

        it("accepts every test config", () => {
            for (const config of [oneOnOne(), threeSolo(), twoByTwo(), threeByTwo()]) {
                expect(validateGameConfig(config).throwIfFailed()).toEqual(config);
            }
        });


        it("rejects unsupported seat counts", () => {
            expect(validateGameConfig(withTeams([["Ann"]])).throwIfSucceeded())
            .toContain("You have 1, so add a robot.");
            expect(validateGameConfig(withTeams([["Ann", "Cy", "Ed"], ["Bob", "Di"]])).throwIfSucceeded())
            .toContain("You have 5, so add a robot.");
            expect(validateGameConfig(withTeams([["Ann", "Cy", "Ed", "Gus"], ["Bob", "Di", "Flo"]])).throwIfSucceeded())
            .toContain("You have 7, so remove someone.");
        });


        it("rejects a team layout that does not match the seat count", () => {
            expect(validateGameConfig(withTeams([["Ann"], ["Bob"], ["Cy"], ["Di"]])).throwIfSucceeded())
            .toContain("2 teams of 2");
            expect(validateGameConfig(withTeams([["Ann", "Cy", "Ed"], ["Bob", "Di", "Flo"]])).throwIfSucceeded())
            .toContain("3 teams of 2");
        });


        it("rejects names that differ only by case", () => {
            expect(validateGameConfig(withTeams([["Ann", "Cy"], ["Bob", "ann"]])).throwIfSucceeded())
            .toContain("ann");
        });


        it("rejects duplicate player ids", () => {
            const config = twoByTwo();
            const [[ann, cy], [bob, di]] = config.teams as [[Seat, Seat], [Seat, Seat]];
            const bad = { ...config, teams: [[ann, cy], [{ ...bob, id: ann.id }, di]] };
            expect(validateGameConfig(bad).throwIfSucceeded()).toContain("id");
        });


        it("rejects a game with no human", () => {
            const config = oneOnOne();
            const robots = { ...config, teams: config.teams.map((team) => team.map((s) => ({ ...s, kind: "Robot" as const }))) };
            expect(validateGameConfig(robots).throwIfSucceeded()).toContain("human");
        });

    });


    describe("seatOrder()", () => {

        it("interleaves the teams", () => {
            expect(seatOrder(threeByTwo().teams).map((s): [string, number] => [s.seat.name, s.team]))
            .toEqual([["Ann", 0], ["Bob", 1], ["Cy", 2], ["Di", 0], ["Ed", 1], ["Flo", 2]]);
            expect(seatOrder(twoByTwo().teams).map((s): [string, number] => [s.seat.name, s.team]))
            .toEqual([["Ann", 0], ["Bob", 1], ["Cy", 0], ["Di", 1]]);
        });

    });

});
