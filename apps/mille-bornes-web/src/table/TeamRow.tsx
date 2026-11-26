import { type Option } from "@repo/depot/option";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import { zoneMiles, type DrivingZone } from "@repo/mille-bornes-core/drivingZone";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { useId, type ReactElement } from "react";
import { cardFace } from "../text/cardFace.mjs";
import { describeTeamName, teamLabel } from "../text/teamName.mjs";


/** What `TeamRow` shows. */
export interface TeamRowProps {
    view:       PlayerView;
    team:       PlayerView["teams"][number];
    /** The player to mark as on turn, if any. */
    onTurn:     Option<PlayerId>;
    /** Which seats are robots; known only on the organizer's screen. */
    robots:     Option<ReadonlyArray<PlayerId>>;
    /** Which seats are connected; known only on the organizer's screen. */
    connected:  Option<ReadonlyArray<PlayerId>>;
    /** Plays the picked-up attack on this team, when it can land here. */
    onPlayHere: Option<() => void>;
}


type ChipTone = "go" | "stop" | "info" | "safe";


interface StatusChip {
    readonly text: string;
    readonly tone: ChipTone;
}


// The rulebook's limit under a Speed Limit; core does not export the number.
const speedLimitMax = 50;


// No default: a new kind of ZoneStatus is a compile error until it is shown.
function statusChip(zone: DrivingZone): StatusChip {
    switch (zone.status.kind) {
        case "Rolling":
            return { text: "Rolling", tone: "go" };
        case "NeedsRoll":
            return { text: "Needs a Roll", tone: "info" };
        case "Hazard":
            return { text: cardFace(zone.status.hazard).label, tone: "stop" };
    }
}


// Every chip says its meaning in words; the color only repeats it.
function statusChips(zone: DrivingZone): ReadonlyArray<StatusChip> {
    const status = statusChip(zone);
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
 * turn marked with a dot and a green frame), and its status in words.  On the
 * organizer's screen, robots and disconnected players are marked too.  While
 * an attack that can land here is picked up, the lane has a Play button.
 * @param props - The view, the team, what is known about the seats and the
 * play on this lane
 * @returns The lane
 */
export function TeamRow(props: TeamRowProps): ReactElement {
    const { view, team, onTurn, robots, connected, onPlayHere } = props;
    const titleId = useId();
    const miles = zoneMiles(team.zone);
    const trip = view.trip.distance;
    const members = view.seats.filter((s) => s.team === team.index);
    const active = onTurn.isSome && members.some((s) => s.id === onTurn.value);
    const tripText = trip.toLocaleString("en-US");

    return (
        <section
            className={["team-row", active ? "active" : "", onPlayHere.isSome ? "targeted" : ""]
            .filter((c) => c !== "")
            .join(" ")}
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
                                {isOnTurn ?
                                    <span className="turn-dot" aria-hidden="true">{"●"}</span> :
                                    null}
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
                {onPlayHere.isSome ?
                    <button
                        type="button"
                        className="button primary lane-target"
                        onClick={onPlayHere.value}
                    >
                        {`Play on ${teamLabel(team.index)}`}
                    </button> :
                    null}
            </div>
        </section>
    );
}
