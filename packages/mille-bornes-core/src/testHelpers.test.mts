import { Card } from "./card.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { type TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { buildGame, oneOnOne, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";


const rolling: DrivingZone = { ...newZone(), status: { kind: "Rolling" } };


describe("testHelpers", () => {

    describe("buildGame()", () => {

        it("always builds a game that passes checkInvariants", () => {
            const annHand = [
                Card.roll, Card.dist100, Card.dist100, Card.stop, Card.drivingAce, Card.dist25, Card.dist50,
            ];
            const games = [
                buildGame({ config: oneOnOne() }),
                buildGame({ config: threeSolo(), hands: [annHand], drawPile: [Card.roll, Card.roll] }),
                buildGame({
                    config: twoByTwo(),
                    hands:  [annHand, [Card.extraTank]],
                    zones:  [
                        { ...rolling, distance: [Card.dist200, Card.dist200, Card.dist75], speedLimit: true },
                        { ...newZone(), status: { kind: "Hazard", hazard: Card.accident } },
                    ],
                    points:     [300, 4500],
                    raceNumber: 3,
                }),
                buildGame({
                    config: threeByTwo(),
                    zones:  [
                        rolling,
                        {
                            ...rolling,
                            safeties: [
                                { card: Card.rightOfWay, coupFourre: true },
                                { card: Card.punctureProof, coupFourre: false },
                            ],
                        },
                        newZone(),
                    ],
                }),
                buildGame({
                    config: oneOnOne(),
                    hands:  [[Card.dist25], [Card.punctureProof]],
                    phase:  {
                        kind:     "HazardIncoming",
                        attacker: oneOnOne().teams[0]![0]!.id,
                        hazard:   Card.flatTire,
                        target:   1 as TeamIndex,
                    },
                }),
                buildGame({
                    config:    oneOnOne(),
                    zones:     [{ ...rolling, distance: Array.from({ length: 8 }, () => Card.dist100) }, newZone()],
                    extension: { kind: "Called", caller: 0 as TeamIndex },
                }),
            ];
            for (const game of games) {
                expect(checkInvariants(game).throwIfFailed()).toBeUndefined();
            }
        });


        it("places every unplaced card on the discard pile", () => {
            const game = buildGame({ config: twoByTwo(), drawPile: [Card.roll] });
            expect(game.drawPile).toEqual([Card.roll]);
            expect(game.discardPile.length).toBe(104);
            // The player on turn must hold a card; nobody else holds any.
            expect(game.players.map((p) => p.hand)).toEqual([[Card.roll], [], [], []]);
        });


        it("uses the given parts and sensible defaults", () => {
            const config = oneOnOne();
            const game = buildGame({ config, points: [100] });
            expect(game.config).toBe(config);
            expect(game.phase).toEqual({ kind: "Turn", player: config.teams[0]![0]!.id });
            expect(game.raceNumber).toBe(1);
            expect(game.extension).toEqual({ kind: "Available" });
            expect(game.teams.map((t) => Number(t.points))).toEqual([100, 0]);
            expect(game.teams.map((t) => t.zone)).toEqual([newZone(), newZone()]);
        });


        it("throws when the requested cards exceed the deck", () => {
            const fiveStops = Array.from({ length: 5 }, () => Card.stop);
            expect(() => buildGame({ config: oneOnOne(), drawPile: fiveStops }))
            .toThrowError(/Stop/u);
        });


        it("throws when the parts break an invariant", () => {
            const sevenRolls = Array.from({ length: 7 }, () => Card.roll);
            expect(() => buildGame({ config: twoByTwo(), hands: [[Card.roll], sevenRolls] }))
            .toThrowError(/Bob/u);
        });

    });

});
