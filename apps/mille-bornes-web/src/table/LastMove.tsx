import { NoneOption, type Option } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { useState, type ReactElement } from "react";
import { describeEvent } from "../text/describeEvent.mjs";
import { pickLastMove } from "./pickLastMove.mjs";


/** What `LastMove` shows. */
export interface LastMoveProps {
    /** The batch that started animating most recently; empty before one. */
    events: ReadonlyArray<GameEvent>;
    view:   PlayerView;
}


/**
 * The most recent move, in one plain line (see `pickLastMove()`).  The line
 * is kept until a later non-empty batch of events replaces it.
 * @param props - The latest started batch and the view it arrived with
 * @returns The line, in a polite status region
 */
export function LastMove(props: LastMoveProps): ReactElement {
    const { events, view } = props;
    const [kept, setKept] = useState<Option<GameEvent>>(NoneOption.get());
    const latest = pickLastMove(events);

    // Adjusting state while rendering, so the new line never lags a frame.
    if (latest.isSome && !(kept.isSome && kept.value === latest.value)) {
        setKept(latest);
    }
    const shown = latest.isSome ? latest : kept;

    return (
        <p className="last-move" role="status">
            <span aria-hidden="true">{"\u{1F4AC} "}</span>
            {shown.match((e) => describeEvent(e, view), () => "Good luck!")}
        </p>
    );
}
