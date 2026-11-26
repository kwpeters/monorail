import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import type { EventBatch } from "../state/screenStore.mjs";
import type { Step } from "./steps.mjs";


// A batch whose results are not all on the table yet.
interface Arrival {
    readonly id:    number;
    /** The view it arrived with: the table once it has landed. */
    readonly after: PlayerView;
    /** The cards the viewer draws in it whose flights have not landed. */
    readonly drawn: ReadonlyArray<Card>;
}


/**
 * The table as the viewer sees it while batches animate: a view that lags
 * the live one and catches up as each batch's cards land.  Plain data; the
 * functions below make the next one.
 */
export interface ShownTable {
    /** The live view of the last render. */
    readonly live:    PlayerView;
    /** The store's queue of the last render. */
    readonly pending: ReadonlyArray<EventBatch>;
    /** What the table's non-interactive parts show. */
    readonly view:    PlayerView;
    /** The batches whose results are not all shown, oldest first. */
    readonly queue:   ReadonlyArray<Arrival>;
    /** The ids in `pending` that were seen already. */
    readonly seen:    ReadonlySet<number>;
    /** The batch whose steps are playing, while it is in `queue`. */
    readonly playing: Option<number>;
}


/**
 * Starts showing a table as it is: batches already pending (the game's first
 * screen) are not waited for, as there is no table from before them.
 * @param view - The live view
 * @param pending - The store's queue
 * @returns A table that shows `view`
 */
export function shownTable(view: PlayerView, pending: ReadonlyArray<EventBatch>): ShownTable {
    return {
        live:    view,
        pending,
        view,
        queue:   [],
        seen:    new Set(pending.map((b) => b.id)),
        playing: NoneOption.get()
    };
}


// The table can only lag within one race, and only while it is shown.
function canLag(shown: PlayerView, live: PlayerView): boolean {
    return shown.gameId === live.gameId &&
        shown.raceNumber === live.raceNumber &&
        live.phase.kind !== "RaceOver" &&
        live.phase.kind !== "GameOver";
}


function drawnBy(view: PlayerView, events: ReadonlyArray<GameEvent>): ReadonlyArray<Card> {
    return events.flatMap((e) => {
        return e.type === "CardDrawn" && e.player === view.me.id && e.card !== null ? [e.card] : [];
    });
}


/**
 * Shows everything live at once and waits for no batch; what is in flight
 * plays on, but nothing it shows is kept back.
 * @param table - The table
 * @returns The table showing its live view
 */
export function snapAll(table: ShownTable): ShownTable {
    return { ...table, view: table.live, queue: [], playing: NoneOption.get() };
}


/**
 * Takes a render's view and queue.  A new batch keeps the table as it was
 * until its cards land.  The table snaps to the live view when the store
 * dropped a batch that had not landed (a reconnect snapshot, or a screen
 * that is not Playing), when the race or the game changed or is over, and
 * under reduced motion, where nothing flies.
 * @param table - The table of the last render
 * @param pending - The store's queue now
 * @param view - The live view now
 * @param instant - Whether batches show at once (reduced motion)
 * @returns The table for this render
 */
export function arrive(
    table: ShownTable,
    pending: ReadonlyArray<EventBatch>,
    view: PlayerView,
    instant: boolean
): ShownTable {
    const ids = new Set(pending.map((b) => b.id));
    const dropped = table.queue.some((a) => !ids.has(a.id));
    if (instant || dropped || !canLag(table.view, view)) {
        return snapAll({ ...table, live: view, pending, seen: ids });
    }
    // Two batches first seen in the same render share its view, so the first
    // to land shows both.
    const fresh = pending
    .filter((b) => !table.seen.has(b.id))
    .map((b) => ({ id: b.id, after: view, drawn: drawnBy(view, b.events) }));
    const queue = [...table.queue, ...fresh];
    return {
        ...table,
        live: view,
        pending,
        view: queue.length === 0 ? view : table.view,
        queue,
        seen: ids
    };
}


/**
 * Notes that a batch's steps start.
 * @param table - The table
 * @param id - The batch
 * @returns The table, with `playing` set while the batch has not landed
 */
export function startBatch(table: ShownTable, id: number): ShownTable {
    const queued = table.queue.some((a) => a.id === id);
    return { ...table, playing: queued ? new SomeOption(id) : NoneOption.get() };
}


/**
 * Shows all of a batch's results (and those of any batch before it).
 * @param table - The table
 * @param id - The batch that landed
 * @returns The table showing the batch's view, or the live view when no
 * batch is left
 */
export function land(table: ShownTable, id: number): ShownTable {
    const at = table.queue.findIndex((a) => a.id === id);
    if (at < 0) {
        return table;
    }
    const rest = table.queue.slice(at + 1);
    return {
        ...table,
        view:    rest.length === 0 ? table.live : table.queue[at]!.after,
        queue:   rest,
        playing: NoneOption.get()
    };
}


function withTeam(shown: PlayerView, after: PlayerView, team: TeamIndex): PlayerView {
    const teams = shown.teams.map((t) => t.index === team ? after.teams[team] ?? t : t);
    return { ...shown, teams };
}


/**
 * Shows the part of a batch's result that a step brings: a flight out of
 * the draw pile its count, a flight onto the discard pile its top, a flight
 * or a pulse on a lane that team's lane.  The turn and the rest wait for the
 * batch to land.
 * @param shown - What the table shows
 * @param after - The view the batch arrived with
 * @param step - The step that landed (a flight) or started (a pulse)
 * @returns What the table shows next
 */
export function reveal(shown: PlayerView, after: PlayerView, step: Step): PlayerView {
    switch (step.kind) {
        case "Fly": {
            const v: PlayerView = {
                ...shown,
                ...(step.from.kind === "DrawPile" ? { drawPileCount: after.drawPileCount } : {}),
                ...(step.to.kind === "DiscardPile" ? { discardTop: after.discardTop } : {})
            };
            return step.to.kind === "Team" ? withTeam(v, after, step.to.team) : v;
        }
        case "Pulse":
            return step.target.kind === "Team" ? withTeam(shown, after, step.target.team) : shown;
        case "Pause":
        case "Hold":
            return shown;
    }
}


/**
 * Shows what a step of the playing batch brings (see `reveal()`); a draw
 * into the viewer's hand also stops hiding its card.
 * @param table - The table
 * @param step - The step that landed (a flight) or started (a pulse)
 * @returns The table; the same one when no batch is playing
 */
export function revealStep(table: ShownTable, step: Step): ShownTable {
    const head = table.queue[0];
    if (head === undefined || !(table.playing.isSome && table.playing.value === head.id)) {
        return table;
    }
    const drew = step.kind === "Fly" && step.from.kind === "DrawPile" && step.to.kind === "Hand" ?
        step.card :
        NoneOption.get();
    const at = drew.isSome ? head.drawn.indexOf(drew.value) : -1;
    const drawn = at < 0 ? head.drawn : head.drawn.filter((_, i) => i !== at);
    return {
        ...table,
        view:  reveal(table.view, head.after, step),
        queue: [{ ...head, drawn }, ...table.queue.slice(1)]
    };
}


/**
 * Lists the cards the viewer drew whose flights have not landed.
 * @param table - The table
 * @returns The cards, oldest first
 */
export function stillDrawing(table: ShownTable): ReadonlyArray<Card> {
    return table.queue.flatMap((a) => a.drawn);
}


/**
 * Finds the places in the hand of cards still flying in: a drawn card is
 * added at the end, so each is the last place holding it, newest first.
 * @param hand - The viewer's live hand
 * @param drawn - The cards still flying in, oldest first
 * @returns Their positions in the hand
 */
export function drawnSlots(
    hand: ReadonlyArray<Card>,
    drawn: ReadonlyArray<Card>
): ReadonlySet<number> {
    const slots = new Set<number>();
    for (const card of [...drawn].reverse()) {
        let at = hand.length - 1;
        while (at >= 0 && (hand[at] !== card || slots.has(at))) {
            at--;
        }
        if (at >= 0) {
            slots.add(at);
        }
    }
    return slots;
}
