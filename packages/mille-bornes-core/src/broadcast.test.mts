import { Card } from "./card.mjs";
import { broadcast } from "./broadcast.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { applyPlayerCommand } from "./engine.mjs";
import { type Game, type GameConfig } from "./game.mjs";
import { type PlayerId } from "./ids.mjs";
import { buildGame, oneOnOne, seatFor, twoByTwo } from "./testHelpers.mjs";


const ann = seatFor("Ann");
const bob = seatFor("Bob");
const cy = seatFor("Cy");
const di = seatFor("Di");


/** A 4-seat game with a robot (Di) and Cy holding a distinctive Driving Ace. */
function mixedGame(): Game {
    const config: GameConfig = { ...twoByTwo(), teams: [[ann, cy], [bob, seatFor("Di", "Robot")]] };
    return buildGame({
        config,
        hands: [[Card.roll], [Card.dist25], [Card.drivingAce, Card.dist50], [Card.dist75]],
    });
}


/** A one-on-one Quick game against a robot that ends when Ann declines Extension. */
function finishedGame(): Game {
    const rolling: DrivingZone = {
        ...newZone(),
        status:   { kind: "Rolling" },
        distance: [Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50],
    };
    const g = buildGame({
        config: { ...oneOnOne(), length: "Quick", teams: [[ann], [seatFor("Bob", "Robot")]] },
        hands:  [[Card.dist50, Card.roll], [Card.roll]],
        zones:  [rolling, newZone()],
    });
    const offer = applyPlayerCommand(g, ann.id, { type: "Drive", card: Card.dist50 }).throwIfFailed().game;
    return applyPlayerCommand(offer, ann.id, { type: "DeclineExtension" }).throwIfFailed().game;
}


function jsonFor(updates: ReadonlyArray<{ player: PlayerId }>, id: PlayerId): string {
    return JSON.stringify(updates.find((u) => u.player === id));
}


describe("broadcast", () => {

    describe("broadcast()", () => {

        it("gives one update per seat, in turn order, each with its own view", () => {
            const updates = broadcast(mixedGame(), []).throwIfFailed();
            expect(updates.map((u) => u.player)).toEqual([ann.id, bob.id, cy.id, di.id]);
            expect(updates.map((u) => u.view.me.id)).toEqual([ann.id, bob.id, cy.id, di.id]);
        });


        it("shows a CardDrawn card only to the drawer", () => {
            const g = buildGame({
                config:   oneOnOne(),
                hands:    [[Card.roll], [Card.dist25]],
                drawPile: [Card.drivingAce],
            });
            const { game, events } = applyPlayerCommand(g, ann.id, { type: "Remedy", card: Card.roll })
            .throwIfFailed();
            const updates = broadcast(game, events).throwIfFailed();
            const drawn = (id: PlayerId): Array<unknown> => updates
            .find((u) => u.player === id)!
            .events.flatMap((e) => e.type === "CardDrawn" ? [e.card] : []);
            expect(drawn(bob.id)).toEqual([Card.drivingAce]);
            expect(drawn(ann.id)).toEqual([null]);
            expect(jsonFor(updates, ann.id)).not.toContain(Card.drivingAce);
        });


        it("never shows one seat's hand in another seat's update", () => {
            const updates = broadcast(mixedGame(), []).throwIfFailed();
            expect(jsonFor(updates, cy.id)).toContain(Card.drivingAce);
            for (const other of [ann, bob, di]) {
                expect(jsonFor(updates, other.id)).withContext(other.name).not.toContain(Card.drivingAce);
            }
        });


        it("hides which seats are robots until GameOver, then reveals them", () => {
            expect(JSON.stringify(broadcast(mixedGame(), []).throwIfFailed())).not.toContain("Robot");
            const over = finishedGame();
            expect(over.phase.kind).toBe("GameOver");
            expect(JSON.stringify(broadcast(over, []).throwIfFailed())).toContain("Robot");
        });

    });

});
