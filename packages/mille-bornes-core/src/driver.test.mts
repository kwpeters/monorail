import { Card, type DistanceCard } from "./card.mjs";
import { deciders, robotMoves } from "./driver.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { applyPlayerCommand } from "./engine.mjs";
import { type Game, type GameConfig } from "./game.mjs";
import { type TeamIndex } from "./ids.mjs";
import { buildGame, oneOnOne, seatFor, twoByTwo } from "./testHelpers.mjs";
import { commandKey } from "./simulation.mjs";
import { legalPlays, viewFor } from "./view.mjs";


const ann = seatFor("Ann");
const bob = seatFor("Bob");
const cy = seatFor("Cy");
const di = seatFor("Di");
const team1 = 1 as TeamIndex;


function six(card: Card): Array<Card> {
    return Array.from({ length: 6 }, () => card);
}


function rollingAt(...distance: Array<DistanceCard>): DrivingZone {
    return { ...newZone(), status: { kind: "Rolling" }, distance };
}


function ids(seats: ReadonlyArray<{ seat: { id: string } }>): Array<string> {
    return seats.map((p) => p.seat.id);
}


/** Ann and Cy are humans; the second team (Bob, Di) is as given. */
function twoByTwoWith(bobKind: "Human" | "Robot", diKind: "Human" | "Robot"): GameConfig {
    return {
        ...twoByTwo(),
        teams: [[ann, cy], [seatFor("Bob", bobKind), seatFor("Di", diKind)]],
    };
}


/** Ann (a robot when `annKind` says so) drives from 650 to 700 and is offered Extension. */
function extensionOffer(annKind: "Human" | "Robot", length: GameConfig["length"] = "Full"): Game {
    const g = buildGame({
        config: { ...oneOnOne(), length, teams: [[seatFor("Ann", annKind)], [bob]] },
        hands:  [
            [Card.dist50, Card.roll, Card.dist25, Card.dist75, Card.repairs, Card.stop, Card.gasoline],
            six(Card.roll),
        ],
        zones:    [rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50), newZone()],
        drawPile: [Card.spareTire],
    });
    return applyPlayerCommand(g, ann.id, { type: "Drive", card: Card.dist50 }).throwIfFailed().game;
}


/** A Stop in flight at team 1 (Bob, Di); Bob holds `bobHand` and Di `diHand`. */
function stopIncoming(
    config: GameConfig,
    bobHand: ReadonlyArray<Card>,
    diHand: ReadonlyArray<Card>
): Game {
    return buildGame({
        config,
        hands: [[Card.roll], bobHand, [Card.roll], diHand],
        zones: [rollingAt(), rollingAt()],
        phase: { kind: "HazardIncoming", attacker: ann.id, hazard: Card.stop, target: team1 },
    });
}


describe("driver", () => {

    describe("deciders()", () => {

        it("is the one seat on turn during a Turn", () => {
            expect(ids(deciders(buildGame({ config: twoByTwo() })))).toEqual([ann.id]);
        });


        it("is every seat of the target team during HazardIncoming", () => {
            const g = stopIncoming(twoByTwo(), [Card.roll], [Card.roll]);
            expect(ids(deciders(g))).toEqual([bob.id, di.id]);
        });


        it("is the decider during an ExtensionOffer", () => {
            expect(ids(deciders(extensionOffer("Human")))).toEqual([ann.id]);
        });


        it("is nobody during RaceOver and GameOver", () => {
            const raceOver = applyPlayerCommand(extensionOffer("Human"), ann.id, { type: "DeclineExtension" })
            .throwIfFailed()
            .game;
            const gameOver = applyPlayerCommand(extensionOffer("Human", "Quick"), ann.id, {
                type: "DeclineExtension",
            }).throwIfFailed().game;
            expect(raceOver.phase.kind).toBe("RaceOver");
            expect(gameOver.phase.kind).toBe("GameOver");
            expect(deciders(raceOver)).toEqual([]);
            expect(deciders(gameOver)).toEqual([]);
        });

    });


    describe("robotMoves()", () => {

        it("returns the robot's command on its turn, and it is a legal play", () => {
            const robotAnn = buildGame({
                config: { ...twoByTwo(), teams: [[seatFor("Ann", "Robot"), cy], [bob, di]] },
            });
            const moves = robotMoves(robotAnn, () => 0);
            expect(moves.length).toBe(1);
            expect(moves[0]!.by).toBe(ann.id);
            const view = viewFor(robotAnn, ann.id).throwIfFailed();
            expect(legalPlays(view).map(commandKey)).toContain(commandKey(moves[0]!.cmd));
        });


        it("returns nothing on a human's turn", () => {
            expect(robotMoves(buildGame({ config: twoByTwoWith("Robot", "Robot") }), () => 0)).toEqual([]);
        });


        it("returns a Coup Fourre only for robot target-team seats that hold the counter", () => {
            const config = twoByTwoWith("Robot", "Human");
            const counter = [Card.rightOfWay];
            const moves = robotMoves(stopIncoming(config, counter, [Card.roll]), () => 0);
            expect(moves).toEqual([{ by: bob.id, cmd: { type: "CoupFourre", card: Card.rightOfWay } }]);
            // The counter is held by a human, or by nobody.
            expect(robotMoves(stopIncoming(config, [Card.roll], counter), () => 0)).toEqual([]);
            expect(robotMoves(stopIncoming(config, [Card.roll], [Card.roll]), () => 0)).toEqual([]);
            expect(robotMoves(stopIncoming(twoByTwoWith("Human", "Robot"), counter, [Card.roll]), () => 0))
            .toEqual([]);
        });


        it("calls or declines Extension for a robot decider", () => {
            const moves = robotMoves(extensionOffer("Robot"), () => 0);
            expect(moves.length).toBe(1);
            expect(moves[0]!.by).toBe(ann.id);
            expect(["CallExtension", "DeclineExtension"]).toContain(moves[0]!.cmd.type);
            expect(robotMoves(extensionOffer("Human"), () => 0)).toEqual([]);
        });

    });

});
