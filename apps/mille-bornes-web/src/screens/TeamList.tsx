import { type Option } from "@repo/depot/option";
import type { PendingSeatView } from "@repo/mille-bornes-core/pendingView";
import { useId, type ReactElement, type ReactNode } from "react";
import { teamLabel } from "../text/teamName.mjs";


/** What `TeamList` needs. */
export interface TeamListProps {
    seats:     ReadonlyArray<PendingSeatView>;
    /**
     * Whether to mark robots.  Only the organizer's data carries seat kinds;
     * everyone else passes false so nothing is ever guessed.
     */
    showKinds: boolean;
    /** Shown under the Players list, used when the seats have no teams yet. */
    hint:      Option<string>;
    /** Controls for one seat (the organizer's Remove and Swap buttons). */
    actions?:  (seat: PendingSeatView) => ReactNode;
}


/**
 * The seats of a waiting room grouped by team, in turn order within a team.
 * When the seat count has no team layout yet, one "Players" list is shown with
 * the hint.  Names are rendered as text and truncated.
 * @param props - The seats and how to show them
 * @returns The lists
 */
export function TeamList(props: TeamListProps): ReactElement {
    const { seats, showKinds, hint, actions } = props;
    const teams = [...new Set(seats.flatMap((s) => s.team === null ? [] : [s.team]))]
    .sort((a, b) => a - b);
    const group = { showKinds, ...(actions === undefined ? {} : { actions }) };

    if (teams.length === 0) {
        return (
            <div className="teams">
                <SeatGroup title="Players" seats={seats} {...group} />
                {hint.isSome ? <p className="hint">{hint.value}</p> : null}
            </div>
        );
    }
    return (
        <div className="teams">
            {teams.map((team) => (
                <SeatGroup
                    key={team}
                    title={teamLabel(team)}
                    seats={seats.filter((s) => s.team === team)}
                    {...group}
                />
            ))}
        </div>
    );
}


interface SeatGroupProps {
    title:     string;
    seats:     ReadonlyArray<PendingSeatView>;
    showKinds: boolean;
    actions?:  (seat: PendingSeatView) => ReactNode;
}


function SeatGroup(props: SeatGroupProps): ReactElement {
    const { title, seats, showKinds, actions } = props;
    const titleId = useId();
    return (
        <section className="team" aria-labelledby={titleId}>
            <h4 id={titleId} className="team-title">{title}</h4>
            <ul className="team-seats">
                {seats.map((seat) => (
                    <li key={seat.id} className="team-seat">
                        <span className="seat-name truncate">{seat.name}</span>
                        {seat.isMe ? <span className="you">(you)</span> : null}
                        {showKinds && seat.kind === "Robot" ?
                            <span className="robot">
                                <span aria-hidden="true">{"\u{1F916}"}</span>
                                <span className="visually-hidden">Robot</span>
                            </span> :
                            null}
                        {actions?.(seat)}
                    </li>
                ))}
            </ul>
        </section>
    );
}
