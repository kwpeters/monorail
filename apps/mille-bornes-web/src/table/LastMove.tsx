import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { useState, type ReactElement } from "react";
import { describeEvent } from "../text/describeEvent.mjs";


/** What `LastMove` shows. */
export interface LastMoveProps {
    /** The latest batch of events; empty most of the time. */
    events: ReadonlyArray<GameEvent>;
    view:   PlayerView;
}


/**
 * The most recent thing that happened, in one plain line.  The line is kept
 * until a later non-empty batch of events replaces it.
 * @param props - The latest events and the view that names the players
 * @returns The line, in a polite status region
 */
export function LastMove(props: LastMoveProps): ReactElement {
    const { events, view } = props;
    const [kept, setKept] = useState<Option<GameEvent>>(NoneOption.get());
    const latest = events.at(-1);

    // Adjusting state while rendering, so the new line never lags a frame.
    if (latest !== undefined && !(kept.isSome && kept.value === latest)) {
        setKept(new SomeOption(latest));
    }
    const shown: Option<GameEvent> = latest === undefined ? kept : new SomeOption(latest);

    return (
        <p className="last-move" role="status">
            <span aria-hidden="true">{"\u{1F4AC} "}</span>
            {shown.match((e) => describeEvent(e, view), () => "Good luck!")}
        </p>
    );
}
