import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { SeatKind } from "@repo/mille-bornes-core/game";
import { useId, useRef, useState, type ReactElement } from "react";
import type { Api } from "../api/client.mjs";
import { voidWire } from "../api/outcomes.mjs";
import { describeRaceResult } from "../text/describeEvent.mjs";
import { describeTeamName } from "../text/teamName.mjs";
import type { PlayingData } from "./GameScreen.js";
import { ScoreSheet } from "./ScoreSheet.js";


/** What `GameOverScreen` needs. */
export interface GameOverScreenProps {
    /** A Playing screen whose phase is `GameOver`. */
    screen: PlayingData;
    api:    Api;
}


// No default: a new kind of seat is a compile error until it is worded.
function kindWords(kind: SeatKind): string {
    switch (kind) {
        case "Human":
            return "a human";
        case "Robot":
            return "a robot";
    }
}


/**
 * The end of the game: the winning team ("Your team" when it is the viewer's),
 * the final score sheet, the reveal of which seats were robots, and the way
 * back to the lobby.  The reveal comes from the `GameOver` phase and is shown
 * nowhere else; the server sends it only now.  Names are rendered as text.
 * Leaving moves the player to the lobby through the subscription, so only a
 * refusal needs showing.
 * @param props - The Playing screen and the API
 * @returns The screen, or nothing when the game is not over
 */
export function GameOverScreen(props: GameOverScreenProps): ReactElement | null {
    const { screen, api } = props;
    const { view } = screen;
    const revealId = useId();
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);

    // Set before the first await: two taps in the same tick send one request.
    const inFlight = useRef(false);

    const leave = async (): Promise<void> => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setBusy(true);
        setMessage(NoneOption.get());
        try {
            const result = await api.call((t) => t.game.leave.mutate(), voidWire);
            if (!result.succeeded) {
                setMessage(new SomeOption(result.error));
            }
        }
        finally {
            // eslint-disable-next-line require-atomic-updates -- only cleared here
            inFlight.current = false;
            setBusy(false);
        }
    };

    const { phase } = view;
    if (phase.kind !== "GameOver") {
        return null;
    }
    const winnerName = phase.winner === view.me.team ?
        "Your team" :
        describeTeamName(view, phase.winner);
    return (
        <>
            <h2 className="winner-heading">{`${winnerName} wins!`}</h2>
            <p>{describeRaceResult(phase.result, view.me.team)}</p>
            <ScoreSheet
                view={view}
                result={phase.result}
                winner={new SomeOption(phase.winner)}
                winnerLabel="Winner"
                caption="Final points for each team"
            />
            <h3 id={revealId}>Who was who</h3>
            <ul className="reveal" aria-labelledby={revealId}>
                {phase.reveal.map((seat) => (
                    <li key={seat.id}>
                        <span className="truncate reveal-name">{seat.name}</span>
                        <span className="reveal-kind">{` was... ${kindWords(seat.kind)}!`}</span>
                    </li>
                ))}
            </ul>
            <button
                type="button"
                className="button primary big"
                disabled={busy}
                onClick={() => void leave()}
            >
                Back to lobby
            </button>
            {message.isSome ? <p className="error" role="alert">{message.value}</p> : null}
        </>
    );
}
