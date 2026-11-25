import { Card } from "@repo/mille-bornes-core/card";
import {
    applyPlayerCommand, applySystemCommand
} from "@repo/mille-bornes-core/engine";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Game } from "@repo/mille-bornes-core/game";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { eventsFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { describe, expect, it } from "vitest";
import {
    annId, arrange, bobId, extensionOffer, midRace, play, setUp, viewOf
} from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import { blockedZone, rollingZone } from "../testing/zoneFixtures.mjs";
import { newZone } from "@repo/mille-bornes-core/drivingZone";
import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { variantForSeatCount } from "@repo/mille-bornes-core/variant";
import {
    soundNameSchema, soundPack, soundsFor, vibrationFor, type SoundName
} from "./soundPack.mjs";


type Command = Parameters<typeof applyPlayerCommand>[2];


// The events one player's move makes, redacted for `viewer` as the server does.
function eventsOf(
    game: Game,
    mover: PlayerId,
    command: Command,
    viewer: PlayerId = annId
): ReadonlyArray<GameEvent> {
    return eventsFor(viewer, applyPlayerCommand(game, mover, command).throwIfFailed().events);
}


function eventOf(events: ReadonlyArray<GameEvent>, type: GameEvent["type"]): GameEvent {
    const found = events.find((e) => e.type === type);
    if (found === undefined) {
        throw new Error(`No ${type} in the batch.`);
    }
    return found;
}


const annView = viewOf(midRace, "Ann");
const bobView = viewOf(midRace, "Bob");

const annDrives = eventsOf(midRace, annId, { type: "Drive", card: "50" });
const bobDrives = eventsOf(
    play(midRace, "Ann", { type: "Drive", card: "50" }), bobId, { type: "Drive", card: "75" }
);
const attack = applyPlayerCommand(
    midRace, annId, { type: "Attack", card: "Stop", targetTeam: team(1) }
).throwIfFailed();
const attacked = eventsFor(annId, attack.events);
const landed = eventsFor(
    annId,
    applySystemCommand(attack.game, { type: "CloseHazardWindow" }).throwIfFailed().events
);
const coupFourre = eventsOf(attack.game, bobId, { type: "CoupFourre", card: "Right of Way" });
const needsRoll = setUp([Card.roll, Card.dist25], [Card.dist50], [newZone(), rollingZone()]);
const rolled = eventsOf(needsRoll, annId, { type: "Remedy", card: "Roll" });
const stopped = setUp(
    [Card.repairs, Card.dist25], [Card.dist50], [blockedZone("Accident"), rollingZone()]
);
const repaired = eventsOf(stopped, annId, { type: "Remedy", card: "Repairs" });
const safety = eventsOf(midRace, annId, { type: "PlaySafety", card: "Driving Ace" });
const discarded = eventsOf(midRace, annId, { type: "Discard", card: "25" });
const offered = eventsOf(
    setUp(
        ["25", "50", "Stop"],
        ["Right of Way", "75", "50", "25", "25", "100"],
        [rollingZone(["200", "200", "100", "100", "50", "25"]), rollingZone()]
    ),
    annId,
    { type: "Drive", card: "25" }
);
const called = eventsOf(extensionOffer, annId, { type: "CallExtension" });
const declined = applyPlayerCommand(extensionOffer, annId, { type: "DeclineExtension" })
.throwIfFailed();
const quick: Game = { ...extensionOffer, config: { ...extensionOffer.config, length: "Quick" } };
const gameEnded = eventsOf(quick, annId, { type: "DeclineExtension" });
const dealt = eventsFor(annId, applySystemCommand(
    declined.game,
    {
        type: "StartNextRace",
        deck: shuffleDeck(variantForSeatCount(2).throwIfFailed().deck, seededRandom(2))
    }
).throwIfFailed().events);


describe("soundPack", () => {

    it.each(soundNameSchema.options)("has a recipe for %s", (name) => {
        expect(soundPack[name].length).toBeGreaterThan(0);
    });


    it("has tones with finite positive durations, gains within [0, 1] and sane pitches", () => {
        for (const tones of Object.values(soundPack)) {
            for (const tone of tones) {
                expect(Number.isFinite(tone.ms) && tone.ms > 0).toBe(true);
                expect(Number.isFinite(tone.delayMs) && tone.delayMs >= 0).toBe(true);
                expect(tone.peak).toBeGreaterThan(0);
                expect(tone.peak).toBeLessThanOrEqual(1);
                expect(tone.hz).toBeGreaterThan(20);
                expect(tone.slideToHz === undefined || tone.slideToHz > 20).toBe(true);
            }
        }
    });


    it("keeps every sound short, so a batch of them cannot pile up", () => {
        for (const tones of Object.values(soundPack)) {
            expect(Math.max(...tones.map((t) => t.delayMs + t.ms))).toBeLessThanOrEqual(1500);
        }
    });


    it("makes the honk from two slightly detuned square waves", () => {
        const [a, b] = soundPack.honk.filter((t) => t.delayMs === 0);
        expect(a!.wave).toBe("square");
        expect(b!.wave).toBe("square");
        expect(Math.abs(a!.hz - b!.hz)).toBeGreaterThan(0);
        expect(Math.abs(a!.hz - b!.hz)).toBeLessThan(a!.hz * 0.05);
    });

});


describe("soundsFor", () => {

    // A Record over every event type, so a new event is a compile error here.
    // Each is the sounds Ann hears for an event as her screen receives it.
    /* eslint-disable @typescript-eslint/naming-convention */
    const table: Record<GameEvent["type"], readonly [GameEvent, ReadonlyArray<SoundName>]> = {
        RaceDealt:         [eventOf(dealt, "RaceDealt"), []],
        TurnStarted:       [eventOf(bobDrives, "TurnStarted"), ["yourTurn"]],
        CardDrawn:         [eventOf(bobDrives, "CardDrawn"), ["draw"]],
        DistancePlayed:    [eventOf(annDrives, "DistancePlayed"), ["drive"]],
        HazardPlayed:      [eventOf(attacked, "HazardPlayed"), ["hazard"]],
        HazardLanded:      [eventOf(landed, "HazardLanded"), ["hazard"]],
        RemedyPlayed:      [eventOf(repaired, "RemedyPlayed"), ["remedy"]],
        SafetyPlayed:      [eventOf(safety, "SafetyPlayed"), ["safety"]],
        CoupFourrePlayed:  [eventOf(coupFourre, "CoupFourrePlayed"), ["coupFourre"]],
        CardDiscarded:     [eventOf(discarded, "CardDiscarded"), ["discard"]],
        ExtensionOffered:  [eventOf(offered, "ExtensionOffered"), ["yourTurn"]],
        ExtensionCalled:   [eventOf(called, "ExtensionCalled"), []],
        ExtensionDeclined: [eventOf(declined.events, "ExtensionDeclined"), []],
        RaceEnded:         [eventOf(declined.events, "RaceEnded"), ["raceWon"]],
        GameEnded:         [eventOf(gameEnded, "GameEnded"), ["gameOver"]]
    };
    /* eslint-enable @typescript-eslint/naming-convention */


    it.each(Object.entries(table))("makes the sounds for %s", (type, [event, expected]) => {
        expect(event.type).toBe(type);
        expect(soundsFor(event, annView)).toEqual(expected);
    });


    it("adds a boing when the remedy is Roll", () => {
        expect(soundsFor(eventOf(rolled, "RemedyPlayed"), annView)).toEqual(["remedy", "roll"]);
    });


    describe("a draw", () => {

        it("is heard only by the player who drew", () => {
            // Bob draws after Ann's move: hidden from Ann, shown to Bob.
            const forAnn = eventOf(annDrives, "CardDrawn");
            expect(forAnn).toMatchObject({ player: bobId, card: null });
            expect(soundsFor(forAnn, annView)).toEqual([]);
            const forBob = eventOf(
                eventsOf(midRace, annId, { type: "Drive", card: "50" }, bobId), "CardDrawn"
            );
            expect(soundsFor(forBob, bobView)).toEqual(["draw"]);
        });

    });


    describe("your turn", () => {

        it("sounds only for the player named by TurnStarted", () => {
            const next = eventOf(annDrives, "TurnStarted");
            expect(next).toMatchObject({ player: bobId });
            expect(soundsFor(next, bobView)).toEqual(["yourTurn"]);
            // Ann's own move starts Bob's turn: nothing for her.
            expect(soundsFor(next, annView)).toEqual([]);
        });


        it("sounds for the decider of an Extension offer only", () => {
            const offer = eventOf(offered, "ExtensionOffered");
            expect(soundsFor(offer, annView)).toEqual(["yourTurn"]);
            expect(soundsFor(offer, bobView)).toEqual([]);
        });

    });


    describe("the end of a race", () => {

        it("fanfares the winning team and keeps quiet for the others", () => {
            const ended = eventOf(declined.events, "RaceEnded");
            expect(soundsFor(ended, annView)).toEqual(["raceWon"]);
            expect(soundsFor(ended, bobView)).toEqual([]);
        });


        it("keeps quiet for a tie", () => {
            const tie: GameEvent = {
                type:   "RaceEnded",
                result: {
                    outcome: { kind: "Exhausted", winner: "Tie", extensionCaller: null },
                    scores:  []
                }
            };
            expect(soundsFor(tie, annView)).toEqual([]);
            expect(soundsFor(tie, bobView)).toEqual([]);
        });


        it("sounds the game over for everyone", () => {
            const over = eventOf(gameEnded, "GameEnded");
            expect(soundsFor(over, annView)).toEqual(["gameOver"]);
            expect(soundsFor(over, bobView)).toEqual(["gameOver"]);
        });

    });


    describe("the hazard window", () => {

        // Ann and Cy (team 0) against Bob and Di (team 1), who hold the counter.
        const game = arrange(
            4,
            [
                ["Ann", [Card.flatTire, Card.dist50]],
                ["Bob", [Card.dist75, Card.drivingAce]],
                ["Cy", [Card.roll, Card.stop]],
                ["Di", [Card.punctureProof, Card.dist25]]
            ],
            [rollingZone(), rollingZone()]
        );
        const attackEvent = (viewer: string): GameEvent => eventOf(
            eventsOf(
                game, game.players[0]!.seat.id,
                { type: "Attack", card: Card.flatTire, targetTeam: team(1) },
                game.players.find((p) => p.seat.name === viewer)!.seat.id
            ),
            "HazardPlayed"
        );
        const di = viewOf(game, "Di");
        const bob = viewOf(game, "Bob");


        it("sounds the alert for every member of the hit team, holder or not", () => {
            expect(soundsFor(attackEvent("Di"), di)).toEqual(["hazard", "windowAlert"]);
            expect(soundsFor(attackEvent("Bob"), bob)).toEqual(["hazard", "windowAlert"]);
        });


        it("sounds the same for two views of one team that differ only in the hand", () => {
            const event = attackEvent("Bob");
            const emptyHanded: PlayerView = { ...bob, me: { ...bob.me, hand: [] } };
            const holder: PlayerView = {
                ...bob, me: { ...bob.me, hand: [Card.punctureProof, Card.punctureProof] }
            };
            expect(soundsFor(event, emptyHanded)).toEqual(soundsFor(event, holder));
            expect(soundsFor(event, bob)).toEqual(soundsFor(event, holder));
            expect(vibrationFor(event, emptyHanded)).toEqual(vibrationFor(event, holder));
            expect(soundsFor(event, bob)).toContain("windowAlert");
        });


        it("tells players off the hit team only that a hazard was played", () => {
            for (const name of ["Ann", "Cy"]) {
                const view = viewOf(game, name);
                expect(soundsFor(attackEvent(name), view)).toEqual(["hazard"]);
                expect(vibrationFor(attackEvent(name), view).isNone).toBe(true);
            }
        });

    });


    describe("Sir Honks-a-Lot", () => {

        const robot = PlayerName.tryCreate("Sir Honks-a-Lot").throwIfFailed();
        const renamed: Game = {
            ...midRace,
            players: midRace.players.map((p, i) => i === 1 ?
                { ...p, seat: { ...p.seat, name: robot } } :
                p)
        };
        const annSees = viewOf(renamed, "Ann");
        const botId = bobId;


        it("honks when the robot plays a card, whatever the card", () => {
            const events = [
                ...eventsOf(
                    play(renamed, "Ann", { type: "Drive", card: "50" }),
                    botId, { type: "Drive", card: "75" }
                ),
                ...eventsOf(
                    play(renamed, "Ann", { type: "Drive", card: "50" }),
                    botId, { type: "Discard", card: "25" }
                )
            ];
            const moves = events
            .filter((e) => e.type === "DistancePlayed" || e.type === "CardDiscarded");
            expect(moves).toHaveLength(2);
            for (const move of moves) {
                expect(soundsFor(move, annSees)).toContain("honk");
            }
        });


        it("matches the name without regard to case", () => {
            const lower: PlayerView = {
                ...annSees,
                seats: annSees.seats.map((s) => s.id === botId ?
                    { ...s, name: "SIR honks-A-lot" as typeof s.name } :
                    s)
            };
            const move = eventOf(
                eventsOf(
                    play(renamed, "Ann", { type: "Drive", card: "50" }),
                    botId, { type: "Drive", card: "75" }
                ),
                "DistancePlayed"
            );
            expect(soundsFor(move, lower)).toContain("honk");
        });


        it("does not honk for anyone else's play", () => {
            expect(soundsFor(eventOf(annDrives, "DistancePlayed"), annView)).not.toContain("honk");
            expect(soundsFor(eventOf(bobDrives, "DistancePlayed"), annView)).not.toContain("honk");
        });


        it("does not honk for events that are not plays", () => {
            const turn = eventOf(
                eventsOf(renamed, annId, { type: "Drive", card: "50" }, annId), "TurnStarted"
            );
            expect(soundsFor(turn, annSees)).not.toContain("honk");
        });

    });


    it("never throws, even for a player missing from the view", () => {
        const strangers: PlayerView = { ...annView, seats: [] };
        for (const [event] of Object.values(table)) {
            expect(() => soundsFor(event, strangers)).not.toThrow();
        }
    });

});


describe("vibrationFor", () => {

    it("buzzes briefly for your turn", () => {
        const next = eventOf(annDrives, "TurnStarted");
        const pattern = vibrationFor(next, bobView);
        expect(pattern.isSome && pattern.value).toEqual([60]);
        expect(vibrationFor(next, annView).isNone).toBe(true);
    });


    it("buzzes three times for a hazard against your team", () => {
        const event = eventOf(
            eventsOf(midRace, annId, { type: "Attack", card: "Stop", targetTeam: team(1) }, bobId),
            "HazardPlayed"
        );
        const pattern = vibrationFor(event, bobView);
        expect(pattern.isSome && pattern.value).toEqual([120, 80, 120]);
    });


    it("has no pattern for any other event", () => {
        const others = [
            eventOf(annDrives, "DistancePlayed"), eventOf(annDrives, "CardDrawn"),
            eventOf(safety, "SafetyPlayed"), eventOf(coupFourre, "CoupFourrePlayed"),
            eventOf(declined.events, "RaceEnded"), eventOf(gameEnded, "GameEnded"),
            eventOf(attacked, "HazardPlayed")
        ];
        for (const event of others) {
            expect(vibrationFor(event, annView).isNone).toBe(true);
        }
    });

});
