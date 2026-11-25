import { NoneOption, Option } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { PlayerCommand } from "@repo/mille-bornes-core/commands";
import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { checkCommand, contextFromView } from "@repo/mille-bornes-core/rules";
import { candidateCommands, legalPlays, type PlayerView } from "@repo/mille-bornes-core/view";


/** An attack on one team. */
export type AttackCommand = Extract<PlayerCommand, { type: "Attack" }>;


/**
 * What a card in the viewer's hand can do now.  `discard` is the Discard,
 * when the rules allow one (on the viewer's own turn, for any card), so a
 * card with no play can still be thrown away.
 * - None: the card has no play now.
 * - Immediate: one play that needs no target (a distance card, a remedy, a
 *   safety, a Coup Fourre).
 * - Choose: an attack; the viewer picks one of the teams it is legal on.
 */
export type Targets =
    | { readonly kind: "None"; readonly discard: Option<PlayerCommand> }
    | {
        readonly kind:    "Immediate";
        readonly command: PlayerCommand;
        readonly discard: Option<PlayerCommand>;
    }
    | {
        readonly kind:  "Choose";
        readonly teams:   ReadonlyArray<{
            readonly team:    TeamIndex;
            readonly command: AttackCommand;
        }>;
        readonly discard: Option<PlayerCommand>;
    };


/** A card's targets and, for a card with no play, why. */
export interface CardTargets {
    readonly targets: Targets;
    /** Set exactly when `targets.kind` is None. */
    readonly reason:  Option<string>;
}


/**
 * Works out what a card in the viewer's hand can do, exactly as the engine
 * would allow it: the plays are `legalPlays()`'s, and the reason a card has
 * no play is `checkCommand()`'s refusal of its first play (not of its
 * discard), in plain English.  The server stays the judge.
 * @param view - The viewer's view
 * @param card - A card in the viewer's hand
 * @returns The card's targets, and the reason when it has no play
 */
export function targetsFor(view: PlayerView, card: Card): CardTargets {
    const forCard = (c: PlayerCommand): boolean => "card" in c && c.card === card;
    const legal = legalPlays(view).filter(forCard);
    const discard = Option.fromNullable(legal.find((c) => c.type === "Discard"));
    const attacks = legal.filter((c): c is AttackCommand => c.type === "Attack");
    const immediate = Option.fromNullable(
        legal.find((c) => c.type !== "Discard" && c.type !== "Attack")
    );

    if (attacks.length > 0) {
        const teams = attacks.map((command) => ({ team: command.targetTeam, command }));
        return { targets: { kind: "Choose", teams, discard }, reason: NoneOption.get() };
    }
    if (immediate.isSome) {
        return {
            targets: { kind: "Immediate", command: immediate.value, discard },
            reason:  NoneOption.get(),
        };
    }

    // Every card in the hand has a play to refuse; the Discard explains a
    // card that is not in the hand at all.
    const ctx = contextFromView(view);
    const tried = [
        ...candidateCommands(view).filter((c) => forCard(c) && c.type !== "Discard"),
        { type: "Discard", card } as const,
    ];
    const reasons = tried.flatMap((c) => {
        const checked = checkCommand(ctx, c);
        return checked.failed ? [describeRejection(checked.error)] : [];
    });
    return { targets: { kind: "None", discard }, reason: Option.fromNullable(reasons[0]) };
}


/** The card the viewer has picked up, if any. */
export type Selection =
    | { readonly kind: "Nothing" }
    | { readonly kind: "Card"; readonly card: Card; readonly index: number };


/**
 * What can happen to the selection.  A card is identified by its position in
 * the hand too, because a hand can hold the same card twice.
 */
export type SelectionAction =
    | { readonly type: "TapCard"; readonly card: Card; readonly index: number }
    | { readonly type: "TapTarget" }
    | { readonly type: "Cancel" }
    | { readonly type: "ScreenChanged" };


const nothing: Selection = { kind: "Nothing" };


/**
 * Moves the selection on: tapping a card selects it (or deselects it when it
 * is already selected); a target, a cancel or a changed screen clears it.
 * @param sel - The selection now
 * @param action - What happened
 * @returns The new selection
 */
export function reduceSelection(sel: Selection, action: SelectionAction): Selection {
    switch (action.type) {
        case "TapCard":
            return sel.kind === "Card" && sel.index === action.index && sel.card === action.card ?
                nothing :
                { kind: "Card", card: action.card, index: action.index };
        case "TapTarget":
        case "Cancel":
        case "ScreenChanged":
            return nothing;
    }
}
