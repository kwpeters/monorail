import { Option } from "@repo/depot/option";
import { type PlayerId, type TeamIndex } from "@repo/mille-bornes-core/ids";
import { type PlayerView } from "@repo/mille-bornes-core/view";


/**
 * Gets a player's name as a plain string, never markup (React escapes it
 * at render).
 * @param view - The viewer's view, whose seats hold the names
 * @param id - The player
 * @returns The player's name, or "Someone" if the view has no such seat
 */
export function nameOf(view: PlayerView, id: PlayerId): string {
    return Option.fromNullable(view.seats.find((s) => s.id === id))
    .match((seat) => seat.name, () => "Someone");
}


/**
 * Gets the word for a player as the subject of a sentence.
 * @param view - The viewer's view
 * @param id - The player
 * @returns "You" for the viewer, otherwise the player's name
 */
export function subjectOf(view: PlayerView, id: PlayerId): string {
    return id === view.me.id ? "You" : nameOf(view, id);
}


/**
 * Gets a team's short label.
 * @param team - The team
 * @returns "Team 1" for the first team, and so on
 */
export function teamLabel(team: TeamIndex): string {
    return `Team ${team + 1}`;
}


/**
 * Describes a team with its members, the viewer first and shown as "you".
 * @param view - The viewer's view
 * @param team - The team
 * @returns For example "Team 1 (you + Bob)" or "Team 3 (Cy)"
 */
export function describeTeamName(view: PlayerView, team: TeamIndex): string {
    const members = view.seats.filter((s) => s.team === team);
    const names = [...members.filter((s) => s.isMe), ...members.filter((s) => !s.isMe)]
    .map((s) => s.isMe ? "you" : s.name);
    return names.length === 0 ? teamLabel(team) : `${teamLabel(team)} (${names.join(" + ")})`;
}
