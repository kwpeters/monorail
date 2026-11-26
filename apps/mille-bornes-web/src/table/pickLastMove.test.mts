import { NoneOption } from "@repo/depot/option";
import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { applyPlayerCommand, applySystemCommand } from "@repo/mille-bornes-core/engine";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Game } from "@repo/mille-bornes-core/game";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { variantForSeatCount } from "@repo/mille-bornes-core/variant";
import { viewFor } from "@repo/mille-bornes-core/view";
import { describe, expect, it } from "vitest";
import { describeEvent } from "../text/describeEvent.mjs";
import { annId, bobId, midRace, setUp, stopAlreadyAnswered } from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import { rollingZone } from "../testing/zoneFixtures.mjs";
import { pickLastMove } from "./pickLastMove.mjs";


function typesOf(events: ReadonlyArray<GameEvent>): string[] {
    return events.map((e) => e.type);
}


function pickedType(events: ReadonlyArray<GameEvent>): string | undefined {
    return pickLastMove(events).match((e) => e.type, () => undefined);
}


function textOf(game: Game, events: ReadonlyArray<GameEvent>): string {
    const view = viewFor(game, annId).throwIfFailed();
    return pickLastMove(events).match((e) => describeEvent(e, view), () => "");
}


// Every batch here comes from the real engine, applied to a real seeded game
// whose hands and zones are set to the state under test.
describe("pickLastMove", () => {

    it("is none for an empty batch", () => {
        expect(pickLastMove([])).toEqual(NoneOption.get());
    });


    it("describes the hazard's play when it landed at once in the same batch", () => {
        const { events, game } = applyPlayerCommand(
            stopAlreadyAnswered, annId, { type: "Attack", card: "Stop", targetTeam: team(1) }
        ).throwIfFailed();
        expect(typesOf(events).slice(0, 2)).toEqual(["HazardPlayed", "HazardLanded"]);
        expect(pickedType(events)).toBe("HazardPlayed");
        expect(textOf(game, events)).toBe("You played Stop on Team 2.");
    });


    it("picks the drive of a normal play, not the next turn and draw", () => {
        const { events, game } = applyPlayerCommand(midRace, annId, { type: "Drive", card: "50" })
        .throwIfFailed();
        expect(typesOf(events)).toEqual(["DistancePlayed", "TurnStarted", "CardDrawn"]);
        expect(pickedType(events)).toBe("DistancePlayed");
        expect(textOf(game, events)).toBe("You drove 50 miles.");
    });


    it("picks the discard", () => {
        const { events } = applyPlayerCommand(midRace, annId, { type: "Discard", card: "25" })
        .throwIfFailed();
        expect(typesOf(events)).toEqual(["CardDiscarded", "TurnStarted", "CardDrawn"]);
        expect(pickedType(events)).toBe("CardDiscarded");
    });


    describe("a hazard", () => {

        const attacked = applyPlayerCommand(
            midRace, annId, { type: "Attack", card: "Stop", targetTeam: team(1) }
        ).throwIfFailed();


        it("picks the hazard played, in the batch that opens the window", () => {
            expect(typesOf(attacked.events)).toEqual(["HazardPlayed"]);
            expect(pickedType(attacked.events)).toBe("HazardPlayed");
        });


        it("picks the hazard that landed, not the turn after it", () => {
            const { events } = applySystemCommand(attacked.game, { type: "CloseHazardWindow" })
            .throwIfFailed();
            expect(typesOf(events)).toEqual(["HazardLanded", "TurnStarted", "CardDrawn"]);
            expect(pickedType(events)).toBe("HazardLanded");
        });


        it("picks the Coup Fourre, not the two draws and the extra turn after it", () => {
            const { events } = applyPlayerCommand(
                attacked.game, bobId, { type: "CoupFourre", card: "Right of Way" }
            ).throwIfFailed();
            expect(typesOf(events))
            .toEqual(["CoupFourrePlayed", "CardDrawn", "TurnStarted", "CardDrawn"]);
            expect(pickedType(events)).toBe("CoupFourrePlayed");
        });

    });


    it("picks a safety, not its extra turn and draw", () => {
        const { events } = applyPlayerCommand(
            midRace, annId, { type: "PlaySafety", card: "Driving Ace" }
        ).throwIfFailed();
        expect(typesOf(events)).toEqual(["SafetyPlayed", "TurnStarted", "CardDrawn"]);
        expect(pickedType(events)).toBe("SafetyPlayed");
    });


    it("picks the drive when the draw pile is empty and nothing is drawn", () => {
        const empty: Game = { ...midRace, drawPile: [] };
        const { events } = applyPlayerCommand(empty, annId, { type: "Drive", card: "50" })
        .throwIfFailed();
        expect(typesOf(events)).toEqual(["DistancePlayed", "TurnStarted"]);
        expect(pickedType(events)).toBe("DistancePlayed");
    });


    describe("the end of a race and of the game", () => {

        // 675 miles, so a 25 reaches the 700 that opens the Extension offer.
        const nearlyThere = setUp(
            ["25", "50", "Stop"],
            ["Right of Way", "75", "50", "25", "25", "100"],
            [rollingZone(["200", "200", "100", "100", "50", "25"]), rollingZone()]
        );
        const offered = applyPlayerCommand(nearlyThere, annId, { type: "Drive", card: "25" })
        .throwIfFailed();


        it("picks the Extension offer", () => {
            expect(typesOf(offered.events)).toEqual(["DistancePlayed", "ExtensionOffered"]);
            expect(pickedType(offered.events)).toBe("ExtensionOffered");
        });


        it("picks the end of the race", () => {
            const { events } = applyPlayerCommand(offered.game, annId, { type: "DeclineExtension" })
            .throwIfFailed();
            expect(typesOf(events)).toEqual(["ExtensionDeclined", "RaceEnded"]);
            expect(pickedType(events)).toBe("RaceEnded");
        });


        it("picks the end of the game", () => {
            const quick: Game = {
                ...offered.game,
                config: { ...offered.game.config, length: "Quick" },
            };
            const { events } = applyPlayerCommand(quick, annId, { type: "DeclineExtension" })
            .throwIfFailed();
            expect(typesOf(events)).toEqual(["ExtensionDeclined", "RaceEnded", "GameEnded"]);
            expect(pickedType(events)).toBe("GameEnded");
        });


        it("picks the deal of the next race", () => {
            const over = applyPlayerCommand(offered.game, annId, { type: "DeclineExtension" })
            .throwIfFailed();
            const deck = shuffleDeck(variantForSeatCount(2).throwIfFailed().deck, seededRandom(2));
            const { events } = applySystemCommand(over.game, { type: "StartNextRace", deck })
            .throwIfFailed();
            expect(typesOf(events)).toEqual(["RaceDealt", "TurnStarted", "CardDrawn"]);
            expect(pickedType(events)).toBe("RaceDealt");
        });

    });

});
