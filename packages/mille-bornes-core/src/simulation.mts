import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { chooseCommand } from "./bot.mjs";
import { type Applied, type PlayerCommand } from "./commands.mjs";
import { shuffleDeck } from "./deck.mjs";
import { applyPlayerCommand, applySystemCommand, createGame } from "./engine.mjs";
import { type Game, type GameConfig, type PlayerState } from "./game.mjs";
import { type PlayerId } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { describeRejection } from "./rejection.mjs";
import { variantForSeatCount } from "./variant.mjs";
import { legalPlays, viewFor } from "./view.mjs";


/**
 * Creates a small seeded pseudo-random generator (mulberry32), so a simulated
 * game can be replayed from its seed.
 * @param seed - The seed; the same seed always gives the same sequence
 * @returns A function returning numbers in [0, 1)
 */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


/** A finished simulated game. */
export interface SimulationResult {
    /** The game in phase GameOver. */
    readonly game:        Game;
    /** The commands applied, player and system. */
    readonly steps:       number;
    readonly racesPlayed: number;
}


/** Optional settings for `playGame()`. */
export interface SimulationOptions {
    /**
     * Prefixed to every failure message, so a failing game can be replayed:
     * for example the seed and the config.
     */
    readonly label?:  string;
    /**
     * Called with every state the game passes through, the dealt game first
     * and the finished game last, before the next command is applied.
     */
    readonly onStep?: (g: Game) => void;
}


interface Decision {
    readonly by:  PlayerId;
    readonly cmd: PlayerCommand;
}


function commandKey(c: PlayerCommand): string {
    const card = "card" in c ? c.card : null;
    const team = "targetTeam" in c ? c.targetTeam : null;
    return JSON.stringify([c.type, card, team]);
}


// The seats the phase lets decide, in turn order.
function deciders(g: Game): ReadonlyArray<PlayerState> {
    const phase = g.phase;
    switch (phase.kind) {
        case "Turn":
            return g.players.filter((p) => p.seat.id === phase.player);
        case "HazardIncoming":
            return g.players.filter((p) => p.team === phase.target);
        case "ExtensionOffer":
            return g.players.filter((p) => p.seat.id === phase.decider);
        case "RaceOver":
        case "GameOver":
            return [];
    }
}


// Asks the deciding seats' robots; each answer must be a legal play.
function decisions(g: Game, rand: () => number): Result<ReadonlyArray<Decision>, string> {
    const asked: Array<Decision> = [];
    for (const { seat } of deciders(g)) {
        const view = viewFor(g, seat.id);
        if (view.failed) {
            return new FailedResult(describeRejection(view.error));
        }
        const cmd = chooseCommand(view.value, rand);
        if (cmd === null) {
            continue;
        }
        if (!legalPlays(view.value).some((c) => commandKey(c) === commandKey(cmd))) {
            return new FailedResult(
                `The robot for ${seat.name} chose ${commandKey(cmd)}, which is not legal.`
            );
        }
        asked.push({ by: seat.id, cmd });
    }
    return new SucceededResult(asked);
}


// The one command that moves the game on.
function step(g: Game, rand: () => number): Result<Applied, string> {
    const phase = g.phase;
    return decisions(g, rand).bind((asked): Result<Applied, string> => {
        const first = asked[0];
        if (first) {
            return applyPlayerCommand(g, first.by, first.cmd)
            .mapError((r) => `${commandKey(first.cmd)} was rejected: ${describeRejection(r)}`);
        }
        switch (phase.kind) {
            case "HazardIncoming":
                return applySystemCommand(g, { type: "CloseHazardWindow" })
                .mapError(describeRejection);
            case "ExtensionOffer":
                return applySystemCommand(g, { type: "CloseExtensionOffer" })
                .mapError(describeRejection);
            case "RaceOver":
                return variantForSeatCount(g.players.length)
                .bind((v) => applySystemCommand(
                    g,
                    { type: "StartNextRace", deck: shuffleDeck(v.deck, rand) }
                ))
                .mapError(describeRejection);
            default:
                return new FailedResult(`The robot for the ${phase.kind} phase made no play.`);
        }
    });
}


/**
 * Plays a whole game with every seat driven by the robot (`chooseCommand()`),
 * checking the engine as it goes.  Each step asks the robot of every seat the
 * phase lets decide and fails unless every answer is one of its legal plays;
 * then:
 * - Turn: the player's choice is applied.
 * - HazardIncoming: the first target-team seat (in turn order) with a Coup
 *   Fourre plays it, else CloseHazardWindow.
 * - ExtensionOffer: the decider's choice, else CloseExtensionOffer.
 * - RaceOver: StartNextRace with a deck shuffled by `rand`.
 *
 * `checkInvariants()` runs on every state, the dealt game and GameOver
 * included.
 * @param config - The game's config; every seat is played by the robot
 * @param rand - Returns a number in [0, 1); shuffles the decks and breaks the
 * robots' ties, so a seeded `rand` (see `seededRandom()`) replays a game
 * @param maxSteps - The most commands to apply before giving up (default
 * 20,000), so a game that never ends cannot hang the caller
 * @param options - A label for failure messages and a step observer
 * @returns The finished game, or a message (prefixed by the label) naming the
 * step and what went wrong: a robot's illegal or rejected command, a broken
 * invariant, or running out of steps
 */
export function playGame(
    config: GameConfig,
    rand: () => number,
    maxSteps = 20000,
    options: SimulationOptions = {}
): Result<SimulationResult, string> {
    const fail = (message: string): FailedResult<string> => {
        return new FailedResult(options.label ? `${options.label}: ${message}` : message);
    };
    const created = variantForSeatCount(config.teams.flat().length)
    .mapError(describeRejection)
    .bind((v) => createGame(config, shuffleDeck(v.deck, rand)));
    if (created.failed) {
        return fail(created.error);
    }

    let g = created.value.game;
    for (let steps = 0; ; steps++) {
        const valid = checkInvariants(g);
        if (valid.failed) {
            return fail(`step ${steps}, race ${g.raceNumber}: ${valid.error}`);
        }
        options.onStep?.(g);
        if (g.phase.kind === "GameOver") {
            return new SucceededResult({ game: g, steps, racesPlayed: g.raceNumber });
        }
        if (steps >= maxSteps) {
            return fail(`no GameOver within ${maxSteps} steps`);
        }
        const next = step(g, rand);
        if (next.failed) {
            return fail(`step ${steps}, race ${g.raceNumber}, ${g.phase.kind}: ${next.error}`);
        }
        g = next.value.game;
    }
}
