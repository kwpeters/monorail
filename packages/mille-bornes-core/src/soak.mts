// A script, not part of the package's API: plays many seeded simulated games
// and reports every failure.
//
//     npm run soak -w @repo/mille-bornes-core -- <games>
//
// Game n uses seed n; the seed picks the seat count, the game length and the
// policy (Bot and Random alternate in blocks of 12 seeds), so every
// combination is played.  A failing game is replayed with
// `playGame({ ...config, length }, seededRandom(seed), undefined, { policy })`.

import { type GameConfig } from "./game.mjs";
import { type GameLength } from "./scoring.mjs";
import { playGame, seededRandom, simulationPolicySchema } from "./simulation.mjs";
import { oneOnOne, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";


const configs: ReadonlyArray<() => GameConfig> = [oneOnOne, threeSolo, twoByTwo, threeByTwo];
const lengths: ReadonlyArray<GameLength> = ["Quick", "Short", "Full"];
const policies = simulationPolicySchema.options;


function soak(games: number): number {
    const started = performance.now();
    let failures = 0;
    let races = 0;
    let steps = 0;
    for (let seed = 1; seed <= games; seed++) {
        const base = configs[seed % configs.length]!();
        const length = lengths[Math.floor(seed / configs.length) % lengths.length]!;
        const block = Math.floor(seed / (configs.length * lengths.length));
        const policy = policies[block % policies.length]!;
        const seats = base.teams.flat().length;
        const label = `${policy} policy, ${seats} seats, ${length}, seed ${seed}`;
        try {
            const rand = seededRandom(seed);
            const result = playGame({ ...base, length }, rand, undefined, { label, policy });
            if (result.failed) {
                failures++;
                console.log(`FAILED ${result.error}`);
            }
            else {
                races += result.value.racesPlayed;
                steps += result.value.steps;
            }
        }
        catch (err) {
            // A throw is the crash the soak exists to find: report its seed.
            failures++;
            console.log(`FAILED ${label}: threw ${err instanceof Error ? err.stack : String(err)}`);
        }
    }
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`${games} games, ${failures} failed; ${races} races, ${steps} steps; ${seconds} s`);
    return failures;
}


const games = Number(process.argv[2]);
if (!Number.isInteger(games) || games < 1) {
    console.error("Usage: npm run soak -w @repo/mille-bornes-core -- <games>  (games > 0)");
    process.exitCode = 2;
}
else if (soak(games) > 0) {
    // exitCode, not exit(), so the failure lines are flushed first.
    process.exitCode = 1;
}
