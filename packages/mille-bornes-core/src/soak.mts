// A script, not part of the package's API: plays many seeded robot games and
// reports every failure.
//
//     npm run soak -w @repo/mille-bornes-core -- <games>
//
// Game n uses seed n; the seed picks the seat count and the game length, so
// every combination is played.  A failing game is replayed with
// `playGame({ ...config, length }, seededRandom(seed))`.

import { type GameConfig } from "./game.mjs";
import { type GameLength } from "./scoring.mjs";
import { playGame, seededRandom } from "./simulation.mjs";
import { oneOnOne, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";


const configs: ReadonlyArray<() => GameConfig> = [oneOnOne, threeSolo, twoByTwo, threeByTwo];
const lengths: ReadonlyArray<GameLength> = ["Quick", "Short", "Full"];


function soak(games: number): number {
    const started = performance.now();
    let failures = 0;
    let races = 0;
    let steps = 0;
    for (let seed = 1; seed <= games; seed++) {
        const base = configs[seed % configs.length]!();
        const length = lengths[Math.floor(seed / configs.length) % lengths.length]!;
        const label = `${base.teams.flat().length} seats, ${length}, seed ${seed}`;
        const result = playGame({ ...base, length }, seededRandom(seed), undefined, { label });
        if (result.failed) {
            failures++;
            console.log(`FAILED ${result.error}`);
        }
        else {
            races += result.value.racesPlayed;
            steps += result.value.steps;
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
