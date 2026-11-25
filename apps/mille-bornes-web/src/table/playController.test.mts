import { Card } from "@repo/mille-bornes-core/card";
import { type PlayerCommand } from "@repo/mille-bornes-core/commands";
import { newZone } from "@repo/mille-bornes-core/drivingZone";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { commandKey, playGame, seededRandom } from "@repo/mille-bornes-core/simulation";
import { legalPlays, viewFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { describe, expect, it } from "vitest";
import { arrange, play, viewOf, type Hands } from "../testing/engineBatches.mjs";
import { gameForSeats, team, type SeatCount } from "../testing/viewFixtures.mjs";
import { rollingZone, withSafety } from "../testing/zoneFixtures.mjs";
import {
    reduceSelection, targetsFor, type Selection, type SelectionAction, type Targets
} from "./playController.mjs";


// Every command a card's targets offer, the discard included.
function offered(targets: Targets): ReadonlyArray<PlayerCommand> {
    const discard = targets.discard.match((d): ReadonlyArray<PlayerCommand> => [d], () => []);
    switch (targets.kind) {
        case "None":
            return discard;
        case "Immediate":
            return [targets.command, ...discard];
        case "Choose":
            return [...targets.teams.map((t) => t.command), ...discard];
    }
}


function keys(commands: ReadonlyArray<PlayerCommand>): ReadonlyArray<string> {
    return commands.map(commandKey).sort();
}


// Views of every seat at every step of seeded games of each size.
function sampleViews(): ReadonlyArray<PlayerView> {
    const views: Array<PlayerView> = [];
    const games: ReadonlyArray<[SeatCount, number]> = [[2, 11], [3, 12], [4, 13], [6, 14]];
    for (const [seats, seed] of games) {
        let step = 0;
        playGame(gameForSeats(seats).config, seededRandom(seed), undefined, {
            onStep: (g) => {
                // Every third step keeps the run short and still spans races.
                if (step++ % 3 === 0 || g.phase.kind !== "Turn") {
                    views.push(...g.players.map((p) => viewFor(g, p.seat.id).throwIfFailed()));
                }
            },
        }).throwIfFailed();
    }
    return views;
}


describe("playController", () => {

    describe("targetsFor", () => {

        it("offers a Roll as an immediate play while the team needs one", () => {
            const game = arrange(2, [["Ann", [Card.roll, Card.dist25]]], [newZone(), newZone()]);
            const { targets, reason } = targetsFor(viewOf(game, "Ann"), Card.roll);
            expect(targets.kind).toBe("Immediate");
            expect(targets.kind === "Immediate" && targets.command)
            .toEqual({ type: "Remedy", card: Card.roll });
            expect(targets.discard.isSome).toBe(true);
            expect(reason.isNone).toBe(true);
        });


        it("refuses a distance card that would overshoot, with the overshoot message", () => {
            const zone = rollingZone(["200", "200", "100", "100", "50"]);
            const game = arrange(2, [["Ann", [Card.dist100]]], [zone, rollingZone()]);
            const { targets, reason } = targetsFor(viewOf(game, "Ann"), Card.dist100);
            expect(targets.kind).toBe("None");
            expect(reason.isSome && reason.value)
            .toMatch(/^That would take you past 700 miles\. You have 50 miles to go/u);
        });


        it("lets the player still discard a card that has no play", () => {
            const zone = rollingZone(["200", "200", "100", "100", "50"]);
            const game = arrange(2, [["Ann", [Card.dist100]]], [zone, rollingZone()]);
            const { targets } = targetsFor(viewOf(game, "Ann"), Card.dist100);
            expect(targets.discard.isSome && targets.discard.value)
            .toEqual({ type: "Discard", card: Card.dist100 });
        });


        it("offers an attack on exactly the enemy teams it is legal on, and a discard", () => {
            // Team 2 has not rolled yet, so a Stop cannot land there.
            const game = arrange(
                3,
                [["Ann", [Card.stop]]],
                [rollingZone(), rollingZone(), newZone()]
            );
            const { targets, reason } = targetsFor(viewOf(game, "Ann"), Card.stop);
            expect(targets.kind).toBe("Choose");
            expect(targets.kind === "Choose" && targets.teams).toEqual([{
                team:    team(1),
                command: { type: "Attack", card: Card.stop, targetTeam: team(1) },
            }]);
            expect(targets.discard.isSome).toBe(true);
            expect(reason.isNone).toBe(true);
        });


        it("gives a hazard with no legal target only the discard, with the reason", () => {
            const bob = withSafety(rollingZone(), "Right of Way");
            const game = arrange(2, [["Ann", [Card.stop]]], [rollingZone(), bob]);
            const { targets, reason } = targetsFor(viewOf(game, "Ann"), Card.stop);
            expect(targets.kind).toBe("None");
            expect(targets.discard.isSome).toBe(true);
            expect(reason.isSome && reason.value)
            .toBe(describeRejection({ reason: "TargetProtected", safety: "Right of Way" }));
        });


        it("offers nothing when it is not the viewer's turn, and says whose turn it is", () => {
            const game = arrange(2, [], [rollingZone(), rollingZone()]);
            const bob = viewOf(game, "Bob");
            const { targets, reason } = targetsFor(bob, bob.me.hand[0]!);
            expect(targets.kind).toBe("None");
            expect(targets.discard.isNone).toBe(true);
            expect(reason.isSome && reason.value).toMatch(/It's Ann's turn/u);
        });


        describe("in a hazard window", () => {

            // Ann hits Bob's team (Bob and Di) with a Flat Tire; Di holds the
            // counter.
            const hands: Hands = [
                ["Ann", [Card.flatTire, Card.dist50]],
                ["Bob", [Card.dist75, Card.drivingAce]],
                ["Cy", [Card.roll, Card.stop]],
                ["Di", [Card.punctureProof, Card.dist25]],
            ];
            const game = play(
                arrange(4, hands, [rollingZone(), rollingZone()]),
                "Ann",
                { type: "Attack", card: Card.flatTire, targetTeam: team(1) }
            );


            it("offers the holder of the counter a Coup Fourre and nothing else", () => {
                const di = viewOf(game, "Di");
                expect(di.phase.kind).toBe("HazardIncoming");
                const { targets } = targetsFor(di, Card.punctureProof);
                expect(targets.kind === "Immediate" && targets.command)
                .toEqual({ type: "CoupFourre", card: Card.punctureProof });
                expect(targets.discard.isNone).toBe(true);
            });


            it("refuses every other card with the same message for every player", () => {
                const di = targetsFor(viewOf(game, "Di"), Card.dist25);
                expect(di.targets.kind).toBe("None");
                expect(di.reason.isSome && di.reason.value)
                .toBe(describeRejection({ reason: "WindowOpen" }));
                for (const name of ["Ann", "Bob", "Cy"]) {
                    const view = viewOf(game, name);
                    for (const card of view.me.hand) {
                        const result = targetsFor(view, card);
                        expect(result.targets.kind).toBe("None");
                        expect(result.reason.isSome && result.reason.value)
                        .toBe(describeRejection({ reason: "WindowOpen" }));
                    }
                }
            });

        });


        it("agrees with legalPlays for every card of every hand in seeded games", () => {
            const views = sampleViews();
            expect(views.length).toBeGreaterThanOrEqual(200);
            let coupFourres = 0;
            let extensionOffers = 0;
            for (const view of views) {
                const legal = legalPlays(view);
                extensionOffers += view.phase.kind === "ExtensionOffer" ? 1 : 0;
                for (const card of new Set(view.me.hand)) {
                    const { targets, reason } = targetsFor(view, card);
                    const forCard = legal.filter((c) => "card" in c && c.card === card);
                    expect(keys(offered(targets))).toEqual(keys(forCard));
                    if (targets.kind === "None") {
                        expect(forCard.every((c) => c.type === "Discard")).toBe(true);
                        expect(reason.isSome && reason.value.length > 0).toBe(true);
                    }
                    else {
                        expect(reason.isNone).toBe(true);
                    }
                    coupFourres += targets.kind === "Immediate" &&
                        targets.command.type === "CoupFourre" ? 1 : 0;
                }
            }
            // The hard cases are in the sample.
            expect(coupFourres).toBeGreaterThan(0);
            expect(extensionOffers).toBeGreaterThan(0);
        });

    });


    describe("reduceSelection", () => {

        const nothing: Selection = { kind: "Nothing" };
        const roll: Selection = { kind: "Card", card: Card.roll, index: 0 };
        const stop: Selection = { kind: "Card", card: Card.stop, index: 1 };
        const tapRoll: SelectionAction = { type: "TapCard", card: Card.roll, index: 0 };
        const tapStop: SelectionAction = { type: "TapCard", card: Card.stop, index: 1 };
        const tapRollAt3: SelectionAction = { type: "TapCard", card: Card.roll, index: 3 };


        it.each<[string, Selection, SelectionAction, Selection]>([
            ["tapping a card selects it", nothing, tapRoll, roll],
            ["tapping the same card cancels", roll, tapRoll, nothing],
            ["tapping a second card replaces the first", roll, tapStop, stop],
            [
                "tapping a duplicate elsewhere in the hand selects that one",
                roll,
                tapRollAt3,
                { kind: "Card", card: Card.roll, index: 3 },
            ],
            ["tapping a target clears", stop, { type: "TapTarget" }, nothing],
            ["cancelling clears", stop, { type: "Cancel" }, nothing],
            ["a changed screen clears", stop, { type: "ScreenChanged" }, nothing],
            ["cancelling nothing is nothing", nothing, { type: "Cancel" }, nothing],
        ])("%s", (_, before, action, after) => {
            expect(reduceSelection(before, action)).toEqual(after);
        });

    });

});
