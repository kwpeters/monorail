import { type Option } from "@repo/depot/option";
import type { RaceResult } from "@repo/mille-bornes-core/game";
import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import type { RaceScore } from "@repo/mille-bornes-core/scoring";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import type { ReactElement } from "react";
import { describeTeamName } from "../text/teamName.mjs";


/** What `ScoreSheet` shows. */
export interface ScoreSheetProps {
    /** The viewer's view, which holds the names. */
    view:        PlayerView;
    result:      RaceResult;
    /** The team to mark as the winner, if any. */
    winner:      Option<TeamIndex>;
    /** The word that marks the winner ("Winner", "Race winner"). */
    winnerLabel: string;
    /** What the table is about, for screen readers (not shown). */
    caption:     string;
}


interface Row {
    readonly label: string;
    readonly of:    (score: RaceScore) => number;
    /** The race total and the combined total stand out. */
    readonly total: boolean;
}


// The rulebook's score sheet, in its order.  The miles row is the points the
// miles are worth (the rulebook's "milestones").
const rows: ReadonlyArray<Row> = [
    { label: "Brought forward", of: (s) => s.broughtForward, total: false },
    { label: "Miles", of: (s) => s.milestones, total: false },
    { label: "Safeties", of: (s) => s.safeties, total: false },
    { label: "Coup Fourrés", of: (s) => s.coupFourres, total: false },
    { label: "Trip completed", of: (s) => s.tripCompleted, total: false },
    { label: "Delayed action", of: (s) => s.delayedAction, total: false },
    { label: "Safe trip", of: (s) => s.safeTrip, total: false },
    { label: "Shutout", of: (s) => s.shutout, total: false },
    { label: "Extension", of: (s) => s.extension, total: false },
    { label: "Total for this race", of: (s) => s.totalForRace, total: true },
    { label: "Combined total", of: (s) => s.combinedTotal, total: true },
];


/**
 * The score sheet of a race: one column per team and one row per line of
 * the rulebook's sheet, every value read from the result (none is worked
 * out here).  A value not earned shows as 0.  The table scrolls sideways in
 * a labeled region the keyboard can focus, so six long names stay readable
 * at 320 px.  The winner is marked with a word, not only a color.
 * @param props - The view, the result and the winner to mark
 * @returns The score sheet
 */
export function ScoreSheet(props: ScoreSheetProps): ReactElement {
    const { view, result, winner, winnerLabel, caption } = props;
    return (
        // A scroll area must be reachable by keyboard to be scrollable by it.
        <div className="score-scroll" role="region" aria-label="Score sheet" tabIndex={0}>
            <table className="score-sheet">
                <caption className="visually-hidden">{caption}</caption>
                <thead>
                    <tr>
                        <th scope="col"><span className="visually-hidden">Points</span></th>
                        {result.scores.map((_, team) => (
                            <th
                                key={team}
                                scope="col"
                                className={winner.isSome && winner.value === team ?
                                    "score-team winning" :
                                    "score-team"}
                            >
                                <span className="truncate score-team-name">
                                    {describeTeamName(view, team as TeamIndex)}
                                </span>
                                {winner.isSome && winner.value === team ?
                                    <>
                                        {" "}
                                        <span className="score-winner">
                                            <span aria-hidden="true">{"★ "}</span>
                                            {winnerLabel}
                                        </span>
                                    </> :
                                    null}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.label} className={row.total ? "total" : undefined}>
                            <th scope="row">{row.label}</th>
                            {result.scores.map((score, team) => (
                                <td key={team} className="num">
                                    {row.of(score).toLocaleString("en-US")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
