import { NoneOption, SomeOption } from "@repo/depot/option";
import { Card } from "@repo/mille-bornes-core/card";
import { describe, expect, it } from "vitest";
import { idOf, team, viewForSeats, withPhase } from "../testing/viewFixtures.mjs";
import { playerOnTurn } from "./playerOnTurn.mjs";


describe("playerOnTurn", () => {

    const view = viewForSeats(2);
    const ann = idOf(view, "Ann");
    const bob = idOf(view, "Bob");


    it("is the player whose turn it is", () => {
        expect(playerOnTurn(view)).toEqual(new SomeOption(ann));
    });


    it("is the decider of an Extension offer", () => {
        const offer = withPhase(view, { kind: "ExtensionOffer", decider: bob, team: team(1) });
        expect(playerOnTurn(offer)).toEqual(new SomeOption(bob));
    });


    it("is nobody during a hazard window", () => {
        const window = withPhase(view, {
            kind: "HazardIncoming", attacker: ann, hazard: Card.stop, target: team(1)
        });
        expect(playerOnTurn(window)).toEqual(NoneOption.get());
    });

});
