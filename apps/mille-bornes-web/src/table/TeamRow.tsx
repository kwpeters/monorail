import { type Option } from "@repo/depot/option";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import { canMove, zoneMiles, type DrivingZone } from "@repo/mille-bornes-core/drivingZone";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { useId, type ReactElement } from "react";
import { cardFace } from "../text/cardFace.mjs";
import { describeTeamName, teamLabel } from "../text/teamName.mjs";


/** What `TeamRow` shows. */
export interface TeamRowProps {
    view:      PlayerView;
    team:      PlayerView["teams"][number];
    /** The player to mark as on turn, if any. */
    onTurn:    Option<PlayerId>;
    /** Which seats are robots; known only on the organizer's screen. */
    robots:    Option<ReadonlyArray<PlayerId>>;
    /** Which seats are connected; known only on the organizer's screen. */
    connected: Option<ReadonlyArray<PlayerId>>;
}


type ChipTone = "go" | "stop" | "info" | "safe";


interface StatusChip {
    readonly text: string;
    readonly tone: ChipTone;
}


// The rulebook's limit under a Speed Limit; core does not export the number.
const speedLimitMax = 50;


// Every chip says its meaning in words; the color only repeats it.
function statusChips(zone: DrivingZone): ReadonlyArray<StatusChip> {
    const status: StatusChip = canMove(zone) ?
        { text: "Rolling", tone: "go" } :
        zone.status.kind === "Hazard" ?
            { text: cardFace(zone.status.hazard).label, tone: "stop" } :
            { text: "Needs a Roll", tone: "info" };
    const coupFourres = zone.safeties.filter((s) => s.coupFourre).length;
    const speedLimit: ReadonlyArray<StatusChip> = zone.speedLimit ?
        [{ text: `Speed Limit: ${speedLimitMax} max`, tone: "info" }] :
        [];
    const safeties: ReadonlyArray<StatusChip> = zone.safeties
    .map((s) => ({ text: cardFace(s.card).label, tone: "safe" }));
    const coupFourre: ReadonlyArray<StatusChip> = coupFourres > 0 ?
        [{ text: `Coup Fourre ×${coupFourres}`, tone: "safe" }] :
        [];
    return [status, ...speedLimit, ...safeties, ...coupFourre];
}


/**
 * One team's lane: its name, miles and progress, its players (the one on
 * turn marked with a dot and bold type), and its status in words.  On the
 * organizer's screen, robots and disconnected players are marked too.
 * @param props - The view, the team and what is known about the seats
 * @returns The lane
 */
export function TeamRow(props: TeamRowProps): ReactElement {
    const { view, team, onTurn, robots, connected } = props;
    const titleId = useId();
    const miles = zoneMiles(team.zone);
    const trip = view.trip.distance;
    const members = view.seats.filter((s) => s.team === team.index);
    const active = onTurn.isSome && members.some((s) => s.id === onTurn.value);
    const tripText = trip.toLocaleString("en-US");

    return (
        <section
            className={active ? "team-row active" : "team-row"}
            aria-labelledby={titleId}
            aria-current={active ? "true" : undefined}
            data-anim-anchor={`team-${team.index}`}
        >
            <div className="miles">
                <span className="miles-number">{miles}</span>
                <span className="miles-of">{`of ${tripText}`}</span>
            </div>
            <div className="team-body">
                <h2 id={titleId} className="team-name truncate">
                    {describeTeamName(view, team.index)}
                </h2>
                <div
                    className="bar"
                    role="progressbar"
                    aria-label={`${teamLabel(team.index)} miles`}
                    aria-valuemin={0}
                    aria-valuemax={trip}
                    aria-valuenow={miles}
                    aria-valuetext={`${miles} of ${tripText} miles`}
                >
                    <i style={{ transform: `scaleX(${Math.min(1, miles / trip)})` }} />
                </div>
                <ul className="players" aria-label="Players">
                    {members.map((seat) => {
                        const isOnTurn = onTurn.isSome && onTurn.value === seat.id;
                        return (
                            <li
                                key={seat.id}
                                className={isOnTurn ? "player on-turn" : "player"}
                                aria-current={isOnTurn ? "true" : undefined}
                            >
                                {isOnTurn ? <span aria-hidden="true">{"●"}</span> : null}
                                <span className="truncate">{seat.name}</span>
                                {robots.isSome && robots.value.includes(seat.id) ?
                                    <span className="robot">
                                        <span aria-hidden="true">{"\u{1F916}"}</span>
                                        <span className="visually-hidden">Robot</span>
                                    </span> :
                                    null}
                                {connected.isSome && !connected.value.includes(seat.id) ?
                                    <span className="offline">
                                        <span aria-hidden="true">{"⚠ "}</span>
                                        disconnected
                                    </span> :
                                    null}
                            </li>
                        );
                    })}
                </ul>
                <ul className="statuses" aria-label="Status">
                    {statusChips(team.zone).map((chip) => (
                        <li key={chip.text} className={`status ${chip.tone}`}>{chip.text}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
