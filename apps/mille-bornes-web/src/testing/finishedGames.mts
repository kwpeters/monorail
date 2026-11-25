import type { Game, GameConfig, Seat } from "@repo/mille-bornes-core/game";
import { playGame, seededRandom } from "@repo/mille-bornes-core/simulation";
import { viewFor } from "@repo/mille-bornes-core/view";
import type { PlayingData } from "../screens/GameScreen.js";
import { gameForSeats, playingScreen, type SeatCount } from "./viewFixtures.mjs";


// Test support: never import this from production code.  The games are
// played to the end by core's own simulation, so the race results and score
// sheets are what the engine really produces.


/** A simulated game: the state at each race's end, and at the game's end. */
export interface FinishedGame {
    /** The game at every `RaceOver`, in order (none for a one-race game). */
    readonly raceOvers: ReadonlyArray<Game>;
    /** The game at `GameOver`. */
    readonly gameOver:  Game;
}


/** What to simulate. */
export interface FinishedGameOptions {
    /** Seeds the shuffles and the players' choices. */
    readonly seed:    number;
    readonly length:  GameConfig["length"];
    /** Seat names in team order (default: core's test names). */
    readonly names?:  ReadonlyArray<string>;
    /** Names of the seats that are robots (default none). */
    readonly robots?: ReadonlyArray<string>;
    /** Random legal plays instead of the robot's choices (default false). */
    readonly random?: boolean;
}


const cache = new Map<string, FinishedGame>();


/**
 * Plays a seeded game to its end (the simulation checks the engine on every
 * step) and keeps the game at each race's end and at the game's end.
 * @param seatCount - The number of seats
 * @param options - Seed, length, names and robots
 * @returns The finished game
 * @throws If the simulation fails
 */
export function finishedGame(seatCount: SeatCount, options: FinishedGameOptions): FinishedGame {
    const key = JSON.stringify([seatCount, options]);
    const known = cache.get(key);
    if (known) {
        return known;
    }
    const robots = options.robots ?? [];
    const base = gameForSeats(
        seatCount,
        options.names === undefined ? {} : { names: options.names }
    );
    const asSeat = (s: Seat): Seat => ({ ...s, kind: robots.includes(s.name) ? "Robot" : "Human" });
    const config: GameConfig = {
        ...base.config,
        length: options.length,
        teams:  base.config.teams.map((t) => t.map(asSeat)),
    };
    const raceOvers: Game[] = [];
    const played = playGame(config, seededRandom(options.seed), undefined, {
        policy: options.random === true ? "Random" : "Bot",
        onStep: (g) => {
            if (g.phase.kind === "RaceOver") {
                raceOvers.push(g);
            }
        },
    }).throwIfFailed();
    const finished = { raceOvers, gameOver: played.game };
    cache.set(key, finished);
    return finished;
}


/**
 * Builds the `Playing` screen one seat of a game would get.
 * @param game - A game, for example one of a finished game's states
 * @param name - The seat's name
 * @param extras - Any other fields of the screen
 * @returns The screen
 * @throws If no seat has the name
 */
export function screenOf(
    game: Game,
    name: string,
    extras: Partial<Omit<PlayingData, "kind" | "view">> = {}
): PlayingData {
    const player = game.players.find((p) => p.seat.name === name);
    if (!player) {
        throw new Error(`No seat named "${name}".`);
    }
    return playingScreen(viewFor(game, player.seat.id).throwIfFailed(), extras);
}
