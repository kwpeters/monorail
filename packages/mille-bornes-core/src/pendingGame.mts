import { Option } from "@repo/depot/option";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type Applied } from "./commands.mjs";
import { ShuffledDeck } from "./deck.mjs";
import { createGame } from "./engine.mjs";
import { gameLengthSchema, seatSchema, validateGameConfig, type GameConfig, type Seat } from "./game.mjs";
import { type GameId, type PlayerId } from "./ids.mjs";
import { PlayerName } from "./playerName.mjs";
import { type Rejection } from "./rejection.mjs";
import { type GameLength } from "./scoring.mjs";
import { variantForSeatCount } from "./variant.mjs";


const maxSeats = 6;


/**
 * A game that has not started yet (the lobby model).  Plain JSON.  Seat order
 * is turn order, and a seat's team is its index modulo the team count (see
 * `teamLayout()`).
 */
export interface PendingGame {
    readonly id:        GameId;
    readonly organizer: PlayerId;
    readonly length:    GameLength;
    readonly seats:     ReadonlyArray<Seat>;
}


/**
 * A change to a pending game.  `AddHuman` is for oneself only; the organizer
 * alone may add robots, swap seats, set the length and remove others.
 */
export type PendingCommand =
    | { type: "AddHuman"; seat: Seat }
    | { type: "AddRobot"; seat: Seat }
    | { type: "RemoveSeat"; id: PlayerId }
    | { type: "SwapSeats"; a: PlayerId; b: PlayerId }
    | { type: "SetLength"; length: GameLength };


/**
 * Creates a pending game with its organizer in the first seat and the Quick
 * length.
 * @param id - The game's id
 * @param organizer - The organizer's seat; always seated as a human
 * @returns The pending game
 */
export function createPending(id: GameId, organizer: Seat): PendingGame {
    return { id, organizer: organizer.id, length: "Quick", seats: [copySeat(organizer, "Human")] };
}


// A fresh copy, so extra properties and later mutation of the caller's object
// never reach the lobby state.
function copySeat(seat: Seat, kind: Seat["kind"] = seat.kind): Seat {
    return { id: seat.id, name: seat.name, kind };
}


function reject(rejection: Rejection): FailedResult<Rejection> {
    return new FailedResult(rejection);
}


// Checks a new seat of the given kind against the rest of the table.
function addSeat(p: PendingGame, seat: Seat, kind: Seat["kind"]): Result<PendingGame, Rejection> {
    if (seat.kind !== kind) {
        return reject({ reason: "MalformedCommand" });
    }
    if (p.seats.some((s) => s.id === seat.id)) {
        return reject({ reason: "SeatAlreadyJoined" });
    }
    if (p.seats.length >= maxSeats) {
        return reject({ reason: "TooManyPlayers" });
    }
    if (p.seats.some((s) => PlayerName.isSame(s.name, seat.name))) {
        return reject({ reason: "NameTaken", name: seat.name });
    }
    return new SucceededResult({ ...p, seats: [...p.seats, copySeat(seat)] });
}


function removeSeat(p: PendingGame, by: PlayerId, id: PlayerId): Result<PendingGame, Rejection> {
    if (by !== id && by !== p.organizer) {
        return reject({ reason: "NotOrganizer" });
    }
    if (!p.seats.some((s) => s.id === id)) {
        return reject({ reason: "NoSuchSeat" });
    }
    if (id === p.organizer) {
        return reject({ reason: "OrganizerCannotLeave" });
    }
    return new SucceededResult({ ...p, seats: p.seats.filter((s) => s.id !== id) });
}


function swapSeats(p: PendingGame, a: PlayerId, b: PlayerId): Result<PendingGame, Rejection> {
    const seatA = Option.fromNullable(p.seats.find((s) => s.id === a));
    const seatB = Option.fromNullable(p.seats.find((s) => s.id === b));
    if (seatA.isNone || seatB.isNone) {
        return reject({ reason: "NoSuchSeat" });
    }
    const seats = p.seats.map((s) => s === seatA.value ? seatB.value : s === seatB.value ? seatA.value : s);
    return new SucceededResult({ ...p, seats });
}


function isString(x: unknown): boolean {
    return typeof x === "string";
}


// Commands come from clients, so check what the types promise.  Extra seat
// properties are allowed here; `copySeat()` drops them.
function isWellFormed(c: PendingCommand): boolean {
    switch (c.type) {
        case "AddHuman":
        case "AddRobot":
            return seatSchema.safeParse(c.seat).success;
        case "RemoveSeat":
            return isString(c.id);
        case "SwapSeats":
            return isString(c.a) && isString(c.b);
        case "SetLength":
            return gameLengthSchema.safeParse(c.length).success;
        default:
            return false;
    }
}


/**
 * Applies a command to a pending game.  Never throws: a malformed command or
 * unknown id is a rejection.
 * @param p - The pending game
 * @param by - The player issuing the command
 * @param cmd - The command
 * @returns The changed pending game, or the reason the command was refused
 */
export function applyPendingCommand(
    p:   PendingGame,
    by:  PlayerId,
    cmd: PendingCommand
): Result<PendingGame, Rejection> {
    // The static type promises a command, but a client may send null.
    const received = Option.fromNullable<PendingCommand>(cmd);
    if (received.isNone || !isWellFormed(received.value)) {
        return reject({ reason: "MalformedCommand" });
    }
    const c = received.value;
    switch (c.type) {
        case "AddHuman":
            return by === c.seat.id ? addSeat(p, c.seat, "Human") : reject({ reason: "NotOrganizer" });
        case "AddRobot":
            return by === p.organizer ? addSeat(p, c.seat, "Robot") : reject({ reason: "NotOrganizer" });
        case "RemoveSeat":
            return removeSeat(p, by, c.id);
        case "SwapSeats":
            return by === p.organizer ? swapSeats(p, c.a, c.b) : reject({ reason: "NotOrganizer" });
        case "SetLength":
            if (by !== p.organizer) {
                return reject({ reason: "NotOrganizer" });
            }
            return new SucceededResult({ ...p, length: c.length });
        default:
            return reject({ reason: "MalformedCommand" });
    }
}


/**
 * Gets the teams the seats form right now: seat i is on team i modulo the
 * team count.
 * @param p - The pending game
 * @returns The teams, or UnsupportedPlayerCount when the seat count has no
 * variant
 */
export function teamLayout(p: PendingGame): Result<ReadonlyArray<ReadonlyArray<Seat>>, Rejection> {
    return variantForSeatCount(p.seats.length).mapSuccess(({ teamCount }) => {
        return Array.from({ length: teamCount }, (_, t) => p.seats.filter((_s, i) => i % teamCount === t));
    });
}


/**
 * Says whether the game can start, and if so how.
 * @param p - The pending game
 * @returns The config to start the game with, or why Start is disabled
 */
export function readiness(p: PendingGame): Result<GameConfig, Rejection> {
    return teamLayout(p)
    .mapSuccess((teams): GameConfig => ({ id: p.id, length: p.length, teams }))
    .bind((config) => {
        // A pending game decoded from storage may not be one `applyPendingCommand`
        // could have built.
        return validateGameConfig(config).mapError((): Rejection => ({ reason: "MalformedCommand" }));
    });
}


/**
 * Starts the game.
 * @param p - The pending game
 * @param by - The player pressing Start; must be the organizer
 * @param deck - The deck for race 1; its kind must suit the seat count
 * @returns The same result as `createGame()`, or why the game cannot start
 */
export function beginGame(p: PendingGame, by: PlayerId, deck: ShuffledDeck): Result<Applied, Rejection> {
    if (by !== p.organizer) {
        return reject({ reason: "NotOrganizer" });
    }
    return readiness(p).bind((config) => {
        const wanted = variantForSeatCount(config.teams.flat().length).throwIfFailed().deck;
        if (ShuffledDeck.kind(deck) !== wanted) {
            return reject({ reason: "WrongDeck" });
        }
        // `readiness()` validated the config and the deck kind matches, so
        // this is not expected to fail.
        return createGame(config, deck).mapError((): Rejection => ({ reason: "MalformedCommand" }));
    });
}
