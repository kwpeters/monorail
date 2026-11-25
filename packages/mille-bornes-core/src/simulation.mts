import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { z } from "zod";
import { chooseCommand } from "./bot.mjs";
import { type Applied, type PlayerCommand } from "./commands.mjs";
import { shuffleDeck } from "./deck.mjs";
import { applyPlayerCommand, applySystemCommand, createGame } from "./engine.mjs";
import { type Game, type GameConfig, type PlayerState } from "./game.mjs";
import { type PlayerId } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { describeRejection } from "./rejection.mjs";
import { variantForSeatCount } from "./variant.mjs";
import { legalPlays, viewFor, type PlayerView } from "./view.mjs";


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


/**
 * Gets a key that is equal for two commands exactly when they are the same
 * command, whatever the order of their properties.
 * @param c - The command
 * @returns The key
 */
export function commandKey(c: PlayerCommand): string {
    const card = "card" in c ? c.card : null;
    const team = "targetTeam" in c ? c.targetTeam : null;
    return JSON.stringify([c.type, card, team]);
}


/** A finished simulated game. */
export interface SimulationResult {
    /** The game in phase GameOver. */
    readonly game:        Game;
    /** The commands applied, player and system. */
    readonly steps:       number;
    /** The races dealt, the last (which ended the game) included. */
    readonly racesPlayed: number;
}


/**
 * How the simulated players choose:
 * - Bot: the robot strategy (`chooseCommand()`).
 * - Random: a uniformly random legal play, so moves the robot never makes
 *   (discarding a safety, attacking a trailing team, ...) are played too.  A
 *   Coup Fourre is played with probability 1/2, else the window closes; an
 *   Extension offer is called or declined with probability 1/2 each.
 */
export const simulationPolicySchema = z.enum(["Bot", "Random"]);
export type SimulationPolicy = z.infer<typeof simulationPolicySchema>;


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
    /** How the players choose (default Bot). */
    readonly policy?: SimulationPolicy;
}


interface Decision {
    readonly by:  PlayerId;
    readonly cmd: PlayerCommand;
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


// A uniformly random legal play; null for no play, or (in a hazard window)
// for letting the window close half the time.
function randomChoice(view: PlayerView, rand: () => number): PlayerCommand | null {
    const legal = legalPlays(view);
    if (legal.length === 0 || (view.phase.kind === "HazardIncoming" && rand() >= 0.5)) {
        return null;
    }
    return legal[Math.min(legal.length - 1, Math.floor(rand() * legal.length))]!;
}


// Asks the deciding seats' players; each answer must be a legal play.
function decisions(
    g: Game,
    rand: () => number,
    policy: SimulationPolicy
): Result<ReadonlyArray<Decision>, string> {
    const asked: Array<Decision> = [];
    for (const { seat } of deciders(g)) {
        const view = viewFor(g, seat.id);
        if (view.failed) {
            return new FailedResult(describeRejection(view.error));
        }
        const cmd = policy === "Bot" ?
            chooseCommand(view.value, rand) :
            randomChoice(view.value, rand);
        if (cmd === null) {
            continue;
        }
        if (!legalPlays(view.value).some((c) => commandKey(c) === commandKey(cmd))) {
            return new FailedResult(
                `The ${policy} player ${seat.name} chose ${commandKey(cmd)}, which is not legal.`
            );
        }
        asked.push({ by: seat.id, cmd });
    }
    return new SucceededResult(asked);
}


// The game after one step, and the type of the command applied.
type Stepped = Applied & { readonly command: string };


// The one command that moves the game on, and its type.
function step(
    g: Game,
    rand: () => number,
    policy: SimulationPolicy
): Result<Stepped, string> {
    const phase = g.phase;
    return decisions(g, rand, policy).bind((asked): Result<Stepped, string> => {
        const first = asked[0];
        if (first) {
            return applyPlayerCommand(g, first.by, first.cmd)
            .mapSuccess((a) => ({ ...a, command: first.cmd.type }))
            .mapError((r) => `${commandKey(first.cmd)} was rejected: ${describeRejection(r)}`);
        }
        switch (phase.kind) {
            case "HazardIncoming":
                return applySystemCommand(g, { type: "CloseHazardWindow" })
                .mapSuccess((a) => ({ ...a, command: "CloseHazardWindow" }))
                .mapError(describeRejection);
            case "ExtensionOffer":
                return applySystemCommand(g, { type: "CloseExtensionOffer" })
                .mapSuccess((a) => ({ ...a, command: "CloseExtensionOffer" }))
                .mapError(describeRejection);
            case "RaceOver":
                return variantForSeatCount(g.players.length)
                .bind((v) => applySystemCommand(
                    g,
                    { type: "StartNextRace", deck: shuffleDeck(v.deck, rand) }
                ))
                .mapSuccess((a) => ({ ...a, command: "StartNextRace" }))
                .mapError(describeRejection);
            default:
                return new FailedResult(`The ${policy} player on turn made no play.`);
        }
    });
}


/**
 * Plays a whole game with every seat driven by the simulation (the robot, or
 * random legal plays; see `SimulationPolicy`), checking the engine as it
 * goes.  Each step asks every seat the phase lets decide and fails unless
 * every answer is one of its legal plays; then:
 * - Turn: the player's choice is applied.
 * - HazardIncoming: the first target-team seat (in turn order) that plays a
 *   Coup Fourre, else CloseHazardWindow.
 * - ExtensionOffer: the decider's choice, else CloseExtensionOffer.
 * - RaceOver: StartNextRace with a deck shuffled by `rand`.
 *
 * `checkInvariants()` runs on every state, the dealt game and GameOver
 * included.
 * @param config - The game's config; every seat is simulated
 * @param rand - Returns a number in [0, 1); shuffles the decks and makes the
 * players' choices, so a seeded `rand` (see `seededRandom()`) replays a game
 * @param maxSteps - The most commands to apply before giving up, so a game
 * that never ends cannot hang the caller (default 20,000 for Bot, and 100,000
 * for Random, whose wasted cards make games longer)
 * @param options - A label for failure messages, a step observer and the
 * policy
 * @returns The finished game, or a message (prefixed by the label) naming the
 * step and what went wrong: an illegal or rejected command, a broken
 * invariant, or running out of steps
 */
export function playGame(
    config: GameConfig,
    rand: () => number,
    maxSteps?: number,
    options: SimulationOptions = {}
): Result<SimulationResult, string> {
    const policy = options.policy ?? "Bot";
    const limit = maxSteps ?? (policy === "Bot" ? 20000 : 100000);
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
    let lastCommand = "none";
    for (let steps = 0; ; steps++) {
        const valid = checkInvariants(g);
        if (valid.failed) {
            return fail(`step ${steps}, race ${g.raceNumber}: ${valid.error}`);
        }
        options.onStep?.(g);
        if (g.phase.kind === "GameOver") {
            return new SucceededResult({ game: g, steps, racesPlayed: g.raceNumber });
        }
        if (steps >= limit) {
            return fail(`no GameOver within ${limit} steps (race ${g.raceNumber}, ` +
                `${g.phase.kind}, last command ${lastCommand})`);
        }
        const next = step(g, rand, policy);
        if (next.failed) {
            return fail(`step ${steps}, race ${g.raceNumber}, ${g.phase.kind}: ${next.error}`);
        }
        g = next.value.game;
        lastCommand = next.value.command;
    }
}
