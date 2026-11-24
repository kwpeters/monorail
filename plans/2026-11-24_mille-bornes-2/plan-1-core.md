# Mille Bornes Core (Milestone 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/mille-bornes-core`, a pure, browser-safe TypeScript package containing the Mille Bornes domain model, lobby model, rules engine (including the rulebook's player-count variants and Extension), scoring, per-player views, bot strategy, and randomized-simulation tests.

**Architecture:** Immutable plain-JSON state, and pure functions of the form `(state, command) → Result<{ state, events }, Rejection>`.
Branded value types and discriminated unions make illegal states unrepresentable.
The engine never reads a clock and never generates randomness: shuffled decks and random numbers are injected.
Players receive redacted views, never the full state.

**Tech Stack:** TypeScript 6, Zod 4, `@repo/depot` (`Result`, `Brand`, `pipe`), Jasmine (via tsx), `fast-check`.

**Spec:** `plans/2026-11-24_mille-bornes-2/design.md`.
Rules authority: `plans/2026-11-24_mille-bornes-2/rules.md`; every open rules question is decided there.
This plan covers milestone 1 only.
The server (milestone 2) and web client (milestone 3) get their own plans once the core's real interfaces exist.
The old `mille-bornes-shared`, `mille-bornes-engine`, and `mille-bornes-server` projects are reference only: copy ideas, never import them, and do not delete them in this plan.

## Global Constraints

- Follow `AGENTS.md` and `.editorconfig`: two blank lines after imports and between class members, wrap comments at 80 columns, JSDoc with `@param`/`@returns` on exported items, camelCase file names, PascalCase types, `T`-prefixed type parameters, Zod enums, depot helpers (`Result`, `pipe`), tests named `baseName.test.mts` laid out as `describe` per module with one nested `describe` per function, two blank lines between adjacent lifecycle blocks.
- The package has no Node-only and no DOM dependencies, so a browser can import it.
- Game, lobby, and snapshot state is plain JSON-serializable data: no `Map`, `Set`, class instances, or `Option`.
  Branded primitives are allowed.
  An absent value is `null`, never `undefined`.
- Engine functions are deterministic and never mutate their inputs.
  No `Date`, no `Math.random` in the engine.
  Randomness arrives as an injected `rand: () => number` (default: depot `getRandom`) only in `shuffleDeck` and `pickWhimsicalName`.
- Rejections are typed values (`Rejection`), never bare strings; `describeRejection` turns one into plain English for new players.
- Vocabulary: a **race** is one contest to complete the trip; a **hand** is only the cards a player holds.
  Use `Race` in type, function, and event names; use `hand` only for cards.
  "Shutout" is one word.
- Each public module gets a `package.json` `exports` entry (`types` → `./src/x.mts`, `default` → `./dist/x.mjs`), as in the other packages.
- Run one test file with: `npm test -w @repo/mille-bornes-core -- src/<name>.test.mts`.
- Final gate (Task 14): `npm run all && npm run type-check` from the repo root passes.

## Rules

`plans/2026-11-24_mille-bornes-2/rules.md` is the authority for game rules; it is taken from the owner's rulebook plus the owner's decisions.
This section restates only what the engine pins, so the tests below are unambiguous.

- Variants by seat count (the game needs exactly 2, 3, 4, or 6 seats, robots included):
  - 2 seats: 2 teams of 1, 700-mile trip with Extension, 101-card deck.
  - 3 seats: 3 teams of 1, 700-mile trip with Extension, 101-card deck.
  - 4 seats: 2 teams of 2, 1,000-mile trip, no Extension, 106-card deck.
  - 6 seats: 3 teams of 2, 700-mile trip with Extension, 106-card deck.
  - The 101-card ("Reduced") deck is the 106-card ("Standard") deck minus one each of Stop, Accident, Out of Gas, Flat Tire, and Speed Limit.
- Turn: an automatic draw (when the draw pile is not empty), then exactly one of: play a card, or discard any one card.
  The discard pile is face up.
- Extra turn: after a normal Safety play the same player draws and plays again.
  After a Coup Fourré the player draws a replacement card, then takes an extra turn (which begins with another draw).
- `canMove(zone)`: status is `Rolling`, or Right of Way is in play and no blocking hazard is active.
  A zone starts as `NeedsRoll`.
- The current trip distance is 700 while Extension is `Available`, and 1,000 otherwise (no-Extension games and after Extension is called).
  Distance cards: require `canMove`; while a Speed Limit is active only 25 and 50 are allowed; at most two 200s per team per race; the total may never exceed the current trip distance.
  So at 650 in a 700-mile game a 100 or a 75 is refused and only a 25 or a 50 fits.
  Check order: movement, speed, two-hundreds, overshoot.
- Remedies must match the active hazard (Repairs/Accident, Gasoline/Out of Gas, Spare Tire/Flat Tire, End of Speed Limit/Speed Limit).
  Roll is playable only when status is `NeedsRoll` or the active hazard is Stop, and Right of Way is not in play.
  Remedying a calamity leaves status `NeedsRoll` (or `Rolling` with Right of Way).
  Remedying Stop with Roll gives `Rolling`.
  A played remedy and the hazard it cures both go to the discard pile.
  A played Roll goes to the discard pile.
- Attacks: only on another team.
  Calamities and Stop require the target to `canMove`.
  Speed Limit requires a target with no active Speed Limit and no Right of Way (it does not require the target to `canMove`).
  The target must not hold the matching safety in play (Driving Ace/Accident, Extra Tank/Out of Gas, Puncture Proof/Flat Tire, Right of Way/Stop and Speed Limit).
- Safeties: playing one cancels its matching active calamity, and the team is `Rolling` again immediately (the Roll beneath is exposed).
  Right of Way also cancels an active Stop and an active Speed Limit; status becomes `Rolling` unless a calamity is active.
  Cancelled hazards go to the discard pile.
- Coup Fourré: only while a hazard window is open, by any member of the target team who holds the safety that counters that hazard.
  The hazard goes to the discard pile, the safety is recorded as a Coup Fourré, and the zone is otherwise unchanged.
- Extension: when a `Drive` brings a team to exactly 700 miles while Extension is `Available`, the race pauses in an Extension offer for the player who played that card.
  Calling Extension makes the trip distance 1,000 for every team and the race continues.
  Declining, or the offer timing out, completes the trip at 700 and ends the race.
- A race ends when a team reaches exactly the current trip distance (or declines Extension at 700), or when no player holds any cards (after the draw pile empties, players keep playing without drawing, and empty-handed players are skipped).
  A race ended by exhaustion is won by the team with the most miles (`Tie` if equal).
  Delayed action means the trip was completed while the draw pile was empty.
- Scoring (`standardScoring`): 1 per mile; 100 per safety; 300 extra if a team has all four safeties; 300 extra per Coup Fourré (so 400 including the safety's 100); only for the team that completes the trip: 400 trip completed, 300 delayed action, 300 safe trip (no 200-mile card played), 500 shutout (every other team has zero miles).
  The printed rulebook has Safe Trip 500 and Shutout 300; the owner reversed them.
  Extension bonus (200): if the team that called Extension completes the trip, that team scores 200; in every other case where Extension was called (another team completes first, or the cards run out), every team other than the caller scores 200.
  A caller that fails scores no trip bonus.
- Score sheet: after every race every team's `RaceScore` carries one value per row of the rulebook's score sheet (Task 4), including the total brought forward and the combined total.
- Game ends: Quick ends after the first race that has a winner (trip completer, or most miles; a tie deals another race).
  Short (2,000 points) and Full (5,000 points) end after a race in which a team's total reaches the goal and one team has the strictly highest total; otherwise another race is dealt.
- Seating: seat order is turn order, and a seat's team is its position in that order modulo the team count (4 seats A, B, C, D: teams A+C and B+D).
  Cards are dealt in turn order, 6 each, from the front of the deck; draws also take from the front.
  Race 1's first player is seat 0, and the first player advances one seat each race.

## Review Focus

Inputs and conditions the spec implies that no feature task would otherwise exercise; each has a pinning test in the task named.

1. Draw pile exhausted with uneven hands: empty-handed players are skipped, an extra turn after a Safety with an empty hand passes on, and the race ends when no one holds cards (Task 6).
2. Server-timer races: `CloseHazardWindow` or `CloseExtensionOffer` arriving after the window or offer already resolved, a second Coup Fourré from a teammate, and any command during an open window or offer must be rejected, not crash (Tasks 7 and 8).
3. Hostile or corrupt JSON: unknown cards, extra fields, duplicated cards, oversized hands, dangling player ids, an inconsistent Extension state, and `null` must yield a failed `Result`, never a throw (Task 12).
4. Name edge cases: surrounding and repeated whitespace, case and accent variants, emoji, control characters, exactly-20 and 21 characters (Tasks 1 and 11).
5. Ties at the points goal, three-team shutout, and the Extension payout with several opponents (Tasks 4 and 9).

## File Structure

All under `packages/mille-bornes-core/src/` (tests beside sources as `*.test.mts`).

- `miles.mts`, `points.mts`, `ids.mts`, `playerName.mts`: branded value types.
- `card.mts`, `deck.mts`: cards, categories, relations, deck kinds, deck construction and validation.
- `testHelpers.mts`: `deckFor`, `buildGame` (test support; built with the package, never imported by production code).
- `drivingZone.mts`: one team's zone and every zone-level rule.
- `rejection.mts`: the `Rejection` union and `describeRejection`.
- `scoring.mts`: `ScoringRules`, `scoreRace`, `resolveRace`.
- `variant.mts`: `RaceVariant`, `variantForSeatCount`, Extension state and trip distance.
- `game.mts`, `events.mts`, `commands.mts`, `invariants.mts`: game types, events, commands, consistency checks.
- `rules.mts`: `PlayContext`, `checkCommand` (shared by engine and views).
- `engine.mts`: `createGame`, `applyPlayerCommand`, `applySystemCommand`.
- `view.mts`: `PlayerView`, `viewFor`, `eventsFor`, `legalPlays`.
- `whimsicalNames.mts`, `pendingGame.mts`: lobby model.
- `schemas.mts`: Zod schemas, `decodeGame`, `decodePendingGame`.
- `bot.mts`, `simulation.mts`, `soak.mts`: robot strategy and simulation.

---

### Task 1: Package scaffold and value types

**Files:**
- Create: `packages/mille-bornes-core/{package.json,tsconfig.json,tsconfig.src.json,jasmine.json,.depcheckrc.json,eslint.config.ts}`, copied from `packages/mille-bornes-engine` and adjusted.
- Create: `src/miles.mts`, `src/points.mts`, `src/ids.mts`, `src/playerName.mts` and a `*.test.mts` for each.

**Interfaces:**
- Produces:
  ```ts
  type Miles = Brand<number, "Miles">;
  namespace Miles { tryCreate(n: number): Result<Miles, string>; /* integer multiple of 25, >= 0 */
                    zero: Miles; add(a: Miles, b: Miles): Miles; }
  type Points = Brand<number, "Points">;
  namespace Points { tryCreate(n: number): Result<Points, string>; /* integer >= 0 */
                     zero: Points; add(a: Points, b: Points): Points; }
  type PlayerId = Brand<string, "PlayerId">;  type GameId = Brand<string, "GameId">;
  namespace PlayerId { create(): PlayerId; tryCreate(s: string): Result<PlayerId, string>; } // GameId likewise
  type TeamIndex = Brand<number, "TeamIndex">;
  namespace TeamIndex { tryCreate(n: number): Result<TeamIndex, string>; /* integer 0..2 */ }
  type PlayerName = Brand<string, "PlayerName">;
  namespace PlayerName { tryCreate(raw: string): Result<PlayerName, string>;
                         isSame(a: PlayerName, b: PlayerName): boolean; }
  ```

- [ ] **Step 1: Scaffold.**
  `package.json`: name `@repo/mille-bornes-core`, `"type": "module"`, the same scripts as the engine package plus `"soak": "tsx ./src/soak.mts"`, `dependencies` `@repo/depot` and `zod`, `devDependencies` as the engine package plus `fast-check`.
  Add `exports` entries as modules are created.
  Run `npm install` at the repo root.

- [ ] **Step 2: Write failing tests.**
  ```ts
  it("Miles.tryCreate accepts multiples of 25 and rejects the rest", () => {
      expect(Miles.tryCreate(75).succeeded).toBeTrue();
      expect(Miles.tryCreate(0).succeeded).toBeTrue();
      for (const bad of [-25, 30, 12.5, NaN]) { expect(Miles.tryCreate(bad).failed).toBeTrue(); }
  });
  it("PlayerName.tryCreate trims and collapses whitespace", () => {
      expect(PlayerName.tryCreate("  Ann  Lee ").throwIfFailed()).toEqual("Ann Lee" as PlayerName);
  });
  ```
  More cases:
  - `TeamIndex`: 0, 1, 2 succeed; 3 and -1 fail.
  - `Points`: -1 and 1.5 fail.
  - `PlayerId.create()` values are distinct and `tryCreate` accepts them back; `tryCreate("")` fails.
  - `PlayerName`: `""` and `"   "` fail; exactly 20 code points succeeds and 21 fails; `"🚗"` counts as one code point; `"A\u0000"` fails (control characters); `isSame("Zoë", "ZOË")` and `isSame("Ann", "ann")` are true (case-insensitive after NFKC normalization), `isSame("Ann", "Anne")` false.

- [ ] **Step 3: Run tests, expect FAIL** (modules missing).

- [ ] **Step 4: Implement the four modules** with the signatures above, each returning `FailedResult` with a plain message on bad input, and make `npm run build -w @repo/mille-bornes-core` succeed (this proves each `@repo/depot/...` import path resolves).

- [ ] **Step 5: Run the four test files, expect PASS; run `npm run lint -w @repo/mille-bornes-core`; commit.**
  ```bash
  git add packages/mille-bornes-core package-lock.json
  git commit -m "feat(core): scaffold mille-bornes-core with value types"
  ```

---

### Task 2: Cards and decks

**Files:**
- Create: `src/card.mts`, `src/deck.mts`, `src/testHelpers.mts` and `card.test.mts`, `deck.test.mts`.

**Interfaces:**
- Consumes: `Miles` (Task 1).
- Produces:
  ```ts
  const Card = { dist25: "25", dist50: "50", dist75: "75", dist100: "100", dist200: "200",
    accident: "Accident", outOfGas: "Out of Gas", flatTire: "Flat Tire", speedLimit: "Speed Limit",
    stop: "Stop", repairs: "Repairs", gasoline: "Gasoline", spareTire: "Spare Tire",
    endOfSpeedLimit: "End of Speed Limit", roll: "Roll", drivingAce: "Driving Ace",
    extraTank: "Extra Tank", punctureProof: "Puncture Proof", rightOfWay: "Right of Way" } as const;
  const cardSchema: z.ZodEnum<typeof Card>;  type Card = z.infer<typeof cardSchema>;
  // Category schemas (z.enum extract) and types:
  distanceCardSchema/DistanceCard, hazardCardSchema/HazardCard (accident, outOfGas, flatTire, speedLimit, stop),
  blockingHazardSchema/BlockingHazard (HazardCard minus speedLimit), remedyCardSchema/RemedyCard
  (repairs, gasoline, spareTire, endOfSpeedLimit, roll), safetyCardSchema/SafetyCard
  function distanceMiles(card: DistanceCard): Miles;
  function remedyFor(hazard: HazardCard): RemedyCard;   // stop -> roll, speedLimit -> endOfSpeedLimit
  function safetyFor(hazard: HazardCard): SafetyCard;   // stop and speedLimit -> rightOfWay
  function describeCard(card: Card): string;            // one plain sentence, used for long-press help
  // deck.mts
  type DeckKind = "Standard" | "Reduced";               // 106 or 101 cards
  function cardCounts(kind: DeckKind): Readonly<Record<Card, number>>;
  type ShuffledDeck = Brand<ReadonlyArray<Card>, "ShuffledDeck">;
  namespace ShuffledDeck { tryCreate(cards: ReadonlyArray<Card>): Result<ShuffledDeck, string>; // either kind
                           kind(deck: ShuffledDeck): DeckKind; }
  function createDeck(kind?: DeckKind): ShuffledDeck;   // standard order, valid by construction; default Standard
  function shuffleDeck(kind?: DeckKind, rand?: () => number): ShuffledDeck; // Fisher-Yates over createDeck(kind)
  // testHelpers.mts
  function deckFor(hands: ReadonlyArray<ReadonlyArray<Card>>, nextDraws?: ReadonlyArray<Card>,
                   kind?: DeckKind): ShuffledDeck;
  ```
  `Card` keys and values come from the old `mille-bornes-shared/src/card.mts`.

- [ ] **Step 1: Write failing tests.**
  ```ts
  it("createDeck has 106 cards with the standard counts", () => {
      const deck = createDeck();
      expect(deck.length).toBe(106);
      for (const c of cardSchema.options) {
          expect(deck.filter((x) => x === c).length).toBe(cardCounts("Standard")[c]);
      }
  });
  it("ShuffledDeck.tryCreate rejects a deck missing a card", () => {
      expect(ShuffledDeck.tryCreate(createDeck().slice(1)).failed).toBeTrue();
  });
  ```
  Standard counts: 25/50/75 ×10, 100 ×12, 200 ×4; Accident/Out of Gas/Flat Tire ×3; Speed Limit ×4; Stop ×5; Repairs/Gasoline/Spare Tire ×6; End of Speed Limit ×6; Roll ×14; each safety ×1.
  More cases:
  - The `Reduced` deck has 101 cards: Stop ×4, Accident ×2, Out of Gas ×2, Flat Tire ×2, Speed Limit ×3, every other count as Standard.
  - `ShuffledDeck.tryCreate` accepts a permutation of either kind and `ShuffledDeck.kind` reports which; it rejects a 106-card deck with one card swapped for another and a 101-card deck with one extra Stop.
  - `remedyFor`/`safetyFor` give the values noted in Interfaces and for each calamity.
  - `describeCard` returns a non-empty string without `undefined` for all 19 cards.
  - `shuffleDeck("Standard", seededRand)` is a valid deck, identical for the same seeded `rand`, and not equal to `createDeck()` for a fixed seed; `shuffleDeck("Reduced", ...)` is a valid 101-card deck.
  - `deckFor([[...6 cards], [...6 cards]], [x])` puts hand 0 at deck indexes 0–5, hand 1 at 6–11, `x` at 12, and the remaining cards after it, forming a valid `ShuffledDeck` (it throws if the requested cards exceed the kind's counts).

- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement** the modules.
  `deckFor` takes the requested cards in order and appends the remaining cards of the kind in standard order.
- [ ] **Step 4: Run tests, expect PASS; commit** (`feat(core): cards and decks`).

---

### Task 3: Driving zone and rejections

**Files:**
- Create: `src/drivingZone.mts`, `src/rejection.mts` and their tests.

**Interfaces:**
- Consumes: `Card`-category types, `remedyFor`, `safetyFor`, `distanceMiles` (Task 2); `Miles`, `PlayerName`.
- Produces:
  ```ts
  type ZoneStatus = { kind: "NeedsRoll" } | { kind: "Rolling" } | { kind: "Hazard"; hazard: BlockingHazard };
  type PlayedSafety = { card: SafetyCard; coupFourre: boolean };
  type DrivingZone = { status: ZoneStatus; speedLimit: boolean;
                       distance: ReadonlyArray<DistanceCard>; safeties: ReadonlyArray<PlayedSafety> };
  type ZoneChange = { zone: DrivingZone; discarded: ReadonlyArray<Card> };
  newZone(): DrivingZone;  zoneMiles(z): Miles;  canMove(z): boolean;  hasSafety(z, card: SafetyCard): boolean;
  playDistance(z, card: DistanceCard, tripDistance: Miles): Result<ZoneChange, Rejection>;
  playRemedy(z, card: RemedyCard): Result<ZoneChange, Rejection>;
  playSafety(z, card: SafetyCard): Result<ZoneChange, Rejection>;
  canAttack(z, hazard: HazardCard): Result<void, Rejection>;
  landHazard(z, hazard: HazardCard): Result<ZoneChange, Rejection>;  // re-checks canAttack
  playCoupFourre(z, card: SafetyCard): ZoneChange;  // records {card, coupFourre: true}; status unchanged
  // rejection.mts
  type Rejection =
    | { reason: "NotRolling" } | { reason: "BlockedByHazard"; hazard: BlockingHazard }
    | { reason: "SpeedLimited" } | { reason: "WouldOvershoot"; remaining: Miles; trip: Miles }
    | { reason: "TooManyTwoHundreds" } | { reason: "RemedyNotNeeded"; card: RemedyCard }
    | { reason: "RollNotNeeded"; because: "AlreadyRolling" | "RightOfWay" }
    | { reason: "CannotAttackOwnTeam" } | { reason: "TargetNotMoving"; hazard: HazardCard }
    | { reason: "TargetProtected"; safety: SafetyCard } | { reason: "TargetAlreadySpeedLimited" }
    | { reason: "SafetyAlreadyPlayed"; safety: SafetyCard };
  function describeRejection(r: Rejection): string;
  ```
  Later tasks add variants to `Rejection` and a message for each.
  `tripDistance` is the distance currently in force (700 or 1,000; see "Rules"), supplied by the caller.

- [ ] **Step 1: Write failing tests.** Zone cases (Given → When → Then):
  - `newZone()`: status `NeedsRoll`, miles 0, `canMove` false.
  - `NeedsRoll` + `playRemedy(roll)` → `Rolling`, `discarded` `["Roll"]`.
  - `NeedsRoll` + `playDistance(dist25, 1000)` → `NotRolling`; `Hazard(accident)` + `playDistance(dist25, 1000)` → `BlockedByHazard{hazard:"accident"}`.
  - `Rolling` + `playDistance(dist75, 1000)` → miles 75, `discarded` empty.
  - `Rolling` + speed limit: `dist75` → `SpeedLimited`; `dist50` succeeds.
  - Rolling at 900 miles, trip 1,000: `dist200` → `WouldOvershoot{remaining: 100, trip: 1000}`; `dist100` → miles 1000.
  - Rolling at 650 miles, trip 700: `dist100` and `dist75` → `WouldOvershoot{remaining: 50, trip: 700}`; `dist50` → miles 700; `dist25` → miles 675.
  - Two 200s played, third 200 → `TooManyTwoHundreds`.
  - `Rolling` + `roll` → `RollNotNeeded{because:"AlreadyRolling"}`; with Right of Way played → `because:"RightOfWay"`.
  - `repairs` with no accident, and `endOfSpeedLimit` with no limit → `RemedyNotNeeded`.
  - `landHazard(accident)` on `Rolling` → `Hazard(accident)`; then `playRemedy(repairs)` → `NeedsRoll` (`Rolling` with Right of Way), `discarded` `["Repairs","Accident"]`.
  - `landHazard(stop)` then `playRemedy(roll)` → `Rolling`, `discarded` `["Roll","Stop"]`.
  - `canAttack`: accident on `NeedsRoll` or `Hazard` zone → `TargetNotMoving`; speedLimit on a `NeedsRoll` zone succeeds; a second speedLimit on an already speed-limited zone → `TargetAlreadySpeedLimited` (the rulebook allows it; the owner does not); speedLimit on a Right of Way zone → `TargetProtected{rightOfWay}`; stop on a Right of Way zone → `TargetProtected{rightOfWay}`; flatTire with Puncture Proof in play → `TargetProtected{punctureProof}`.
  - `playSafety(drivingAce)` on `Hazard(accident)` → `Rolling` (the attack is cancelled, so the Roll beneath is exposed again; rulebook p. 11), `discarded` `["Accident"]`.
  - `playSafety(rightOfWay)` on `Hazard(stop)` with speed limit → `Rolling`, speed limit cleared, `discarded` `["Stop","Speed Limit"]`; on `Hazard(flatTire)` → status stays `Hazard(flatTire)`, speed limit cleared.
  - Playing the same safety twice → `SafetyAlreadyPlayed`.
  - `playCoupFourre(rolling, punctureProof)` keeps status `Rolling`, records `{card:"Puncture Proof", coupFourre:true}`.
  - `describeRejection`: exact text for the messages below, and every variant yields a non-empty string without `undefined` or `[object`.
    ```ts
    expect(describeRejection({ reason: "TooManyTwoHundreds" }))
        .toBe("Each team can only play two 200-mile cards per race.");
    expect(describeRejection({ reason: "NotRolling" }))
        .toBe("You can't drive yet. Play a Roll card first.");
    expect(describeRejection({ reason: "SpeedLimited" })).toBe(
        "A speed limit is active: you can only play 25- or 50-mile cards until you play End of Speed Limit.");
    expect(describeRejection({ reason: "WouldOvershoot", remaining: 50 as Miles, trip: 700 as Miles }))
        .toBe("That would take you past 700 miles. You have 50 miles to go and must land on 700 exactly.");
    ```
    Format miles with a thousands separator (`1,000`).
- [ ] **Step 2: Run tests, expect FAIL.**
- [ ] **Step 3: Implement** the modules per the "Rules" section above and `rules.md`.
  Every function returns a new zone; the input is never mutated.
- [ ] **Step 4: Run tests, expect PASS; commit** (`feat(core): driving zone rules and rejections`).

---

### Task 4: Scoring, score sheet, and race resolution

**Files:**
- Create: `src/scoring.mts`, `src/scoring.test.mts`.

**Interfaces:**
- Consumes: `DrivingZone`, `zoneMiles`, `hasSafety` (Task 3); `Miles`, `Points`, `TeamIndex`.
- Produces:
  ```ts
  type ScoringRules = { perMile: number; perSafety: number; allFourSafeties: number; coupFourre: number;
                        tripCompleted: number; delayedAction: number; safeTrip: number; shutout: number;
                        extension: number };
  const standardScoring: ScoringRules; // 1, 100, 300, 300, 400, 300, 300 (safeTrip), 500 (shutout), 200
  type RaceOutcome =
    | { kind: "TripCompleted"; team: TeamIndex; delayedAction: boolean; extensionCaller: TeamIndex | null }
    | { kind: "Exhausted"; winner: TeamIndex | "Tie"; extensionCaller: TeamIndex | null };
  // One value per row of the rulebook's score sheet (rules.md, p. 19). Every row is present, 0 when not earned.
  type RaceScore = {
    broughtForward: Points;                         // this team's total coming into the race
    miles: Miles;                                   // distance traveled this race
    milestones: Points;                             // miles x perMile
    safetyCount: number;  safeties: Points;         // 100 each, plus 300 when the team has all four
    coupFourreCount: number;  coupFourres: Points;  // 300 each, in addition to the safety's 100
    tripCompleted: Points;  delayedAction: Points;  // these three bonuses are 0 unless this team completed the trip
    safeTrip: Points;  shutout: Points;
    extension: Points;                              // see "Rules": 200 to the caller on success, else 200 to every other team
    totalForRace: Points;                           // milestones + safeties + coupFourres + the five bonuses
    combinedTotal: Points;                          // broughtForward + totalForRace
  };
  function scoreRace(rules: ScoringRules, zones: ReadonlyArray<DrivingZone>, outcome: RaceOutcome,
                     broughtForward: ReadonlyArray<Points>): ReadonlyArray<RaceScore>; // index = team
  type GameLength = "Quick" | "Short" | "Full"; // zod enum gameLengthSchema in game.mts is built from this
  function pointsGoal(length: GameLength): Points | null; // Quick null, Short 2000, Full 5000
  type RaceResolution = { kind: "NextRace" } | { kind: "GameOver"; winner: TeamIndex };
  function resolveRace(length: GameLength, totalsAfterRace: ReadonlyArray<Points>,
                       outcome: RaceOutcome): RaceResolution; // totalsAfterRace = each team's combinedTotal
  ```
  Define `GameLength` and `pointsGoal` here, and have `game.mts` (Task 5) import them.

- [ ] **Step 1: Write failing tests.** `scoreRace` (the team has the described zone, outcome `Exhausted` with `extensionCaller: null` unless stated; `broughtForward` is 0 unless stated):
  - 425 miles + Driving Ace (plain), brought forward 1,000 → `miles` 425, `milestones` 425, `safetyCount` 1, `safeties` 100, `totalForRace` 525, `combinedTotal` 1,525.
  - All four safeties, no miles → `safetyCount` 4, `safeties` 700 (4×100 + 300), `totalForRace` 700.
  - One Coup Fourré safety → `safetyCount` 1, `safeties` 100, `coupFourreCount` 1, `coupFourres` 300, `totalForRace` 400.
  - Trip by `[100×10]`, outcome `TripCompleted{team:0, delayedAction:false, extensionCaller:null}`, one opponent at 0 miles → `tripCompleted` 400, `safeTrip` 300, `shutout` 500, `delayedAction` 0, `extension` 0, `totalForRace` 1000 + 400 + 300 + 500 = 2,200.
  - Same with the opponent at 25 miles → `shutout` 0, `totalForRace` 1,700; with `delayedAction:true` → `delayedAction` 300, `totalForRace` 2,000.
  - Trip by `[200,200,100×6]` (1,000 miles, two 200s) → `safeTrip` 0.
  - The non-completing team has the three trip bonuses at 0 and keeps its `milestones` and `safeties`.
  - Three teams: `shutout` is earned only if both opponents have 0 miles.
  - **Extension (Review Focus 5):**
    - Team 0 calls Extension and completes: team 0 `extension` 200, the others 0.
    - Three teams, team 0 calls Extension and team 1 completes: team 1 has `tripCompleted` 400 and `extension` 200, team 2 `extension` 200, team 0 has `extension` 0 and no trip bonus.
    - Two teams, team 0 calls Extension and the race is `Exhausted`: team 1 `extension` 200, team 0 0.
    - `extensionCaller: null`: every `extension` is 0.
  - For every scenario above: `totalForRace` equals the sum of its rows and `combinedTotal` equals `broughtForward + totalForRace`.

  `resolveRace`:
  - Quick + `TripCompleted team 1` → `GameOver 1`.
  - Quick + `Exhausted winner 0` → `GameOver 0`; `Exhausted "Tie"` → `NextRace`.
  - Short, totals `[2100, 1900]` → `GameOver 0`.
  - Short, totals `[1900, 1500]` → `NextRace`.
  - Short, totals `[2000, 2000]` → `NextRace`; `[2100, 2150]` → `GameOver 1`.
  - Full, totals `[5000, 4999]` → `GameOver 0`; `[4999, 4000]` → `NextRace`.
  - Three teams, Short, totals `[2100, 2100, 500]` → `NextRace`.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): scoring, score sheet, and race resolution`).

---

### Task 5: Variants, game types, events, commands, creation, invariants

**Files:**
- Create: `src/variant.mts`, `src/game.mts`, `src/events.mts`, `src/commands.mts`, `src/invariants.mts`, `src/engine.mts` (only `createGame` now), tests for variant, engine, and invariants.
- Modify: `src/testHelpers.mts` (add `buildGame`), `src/rejection.mts` (new variants).

**Interfaces:**
- Consumes: all of Tasks 1–4.
- Produces:
  ```ts
  // variant.mts
  type RaceVariant = { teamCount: 2 | 3; teamSize: 1 | 2; tripDistance: Miles; // tripDistance = the initial distance
                       extension: boolean; deck: DeckKind };
  function variantForSeatCount(seats: number): Result<RaceVariant, Rejection>;
  //   2 -> {2,1,700,true,Reduced}  3 -> {3,1,700,true,Reduced}  4 -> {2,2,1000,false,Standard}
  //   6 -> {3,2,700,true,Standard}  anything else -> UnsupportedPlayerCount{count}
  type ExtensionState = { kind: "NotApplicable" } | { kind: "Available" } | { kind: "Called"; caller: TeamIndex };
  const EXTENSION_MILES: Miles;  // 700
  const FULL_TRIP_MILES: Miles;  // 1000
  function initialExtension(v: RaceVariant): ExtensionState;           // Available if v.extension, else NotApplicable
  function tripDistance(e: ExtensionState): Miles;                     // Available -> 700, otherwise 1000
  // game.mts
  type Seat = { id: PlayerId; name: PlayerName; kind: "Human" | "Robot" };
  type GameConfig = { id: GameId; length: GameLength; teams: ReadonlyArray<ReadonlyArray<Seat>> };
  function validateGameConfig(c: GameConfig): Result<GameConfig, string>;
  //   seat count has a variant and the team count and sizes match it; unique names (PlayerName.isSame); >= 1 human
  type PlayerState = { seat: Seat; team: TeamIndex; hand: ReadonlyArray<Card> };
  type TeamState = { zone: DrivingZone; points: Points };          // points = totals from finished races
  type RaceResult = { outcome: RaceOutcome; scores: ReadonlyArray<RaceScore> };
  type Phase = { kind: "Turn"; player: PlayerId }
             | { kind: "HazardIncoming"; attacker: PlayerId; hazard: HazardCard; target: TeamIndex }
             | { kind: "ExtensionOffer"; decider: PlayerId; team: TeamIndex }
             | { kind: "RaceOver"; result: RaceResult }
             | { kind: "GameOver"; winner: TeamIndex; result: RaceResult };
  type Game = { config: GameConfig; players: ReadonlyArray<PlayerState>; teams: ReadonlyArray<TeamState>;
                drawPile: ReadonlyArray<Card>; discardPile: ReadonlyArray<Card>;
                raceNumber: number; extension: ExtensionState; phase: Phase };   // discardPile top = last element
  // events.mts
  type GameEvent =
    | { type: "RaceDealt"; race: number } | { type: "TurnStarted"; player: PlayerId }
    | { type: "CardDrawn"; player: PlayerId; card: Card | null }
    | { type: "DistancePlayed"; player: PlayerId; card: DistanceCard; team: TeamIndex }
    | { type: "HazardPlayed"; player: PlayerId; card: HazardCard; targetTeam: TeamIndex }
    | { type: "HazardLanded"; card: HazardCard; targetTeam: TeamIndex }
    | { type: "RemedyPlayed"; player: PlayerId; card: RemedyCard; team: TeamIndex }
    | { type: "SafetyPlayed"; player: PlayerId; card: SafetyCard; team: TeamIndex }
    | { type: "CoupFourrePlayed"; player: PlayerId; card: SafetyCard; team: TeamIndex; hazard: HazardCard }
    | { type: "CardDiscarded"; player: PlayerId; card: Card }
    | { type: "ExtensionOffered"; player: PlayerId; team: TeamIndex }
    | { type: "ExtensionCalled"; player: PlayerId; team: TeamIndex }
    | { type: "ExtensionDeclined"; player: PlayerId; team: TeamIndex }
    | { type: "RaceEnded"; result: RaceResult } | { type: "GameEnded"; winner: TeamIndex };
  // commands.mts
  type PlayerCommand =
    | { type: "Drive"; card: DistanceCard } | { type: "Attack"; card: HazardCard; targetTeam: TeamIndex }
    | { type: "Remedy"; card: RemedyCard } | { type: "PlaySafety"; card: SafetyCard }
    | { type: "Discard"; card: Card } | { type: "CoupFourre"; card: SafetyCard }
    | { type: "CallExtension" } | { type: "DeclineExtension" };
  type SystemCommand = { type: "CloseHazardWindow" } | { type: "CloseExtensionOffer" }
                     | { type: "StartNextRace"; deck: ShuffledDeck };
  type Applied = { game: Game; events: ReadonlyArray<GameEvent> };
  function seatOrder(teams: GameConfig["teams"]): ReadonlyArray<{ seat: Seat; team: TeamIndex }>;
  //   interleaves teams: team 0 seat 0, team 1 seat 0, ..., team 0 seat 1, ...
  function createGame(config: GameConfig, deck: ShuffledDeck): Result<Applied, string>;
  //   fails if ShuffledDeck.kind(deck) is not the variant's deck
  function checkInvariants(g: Game): Result<void, string>;
  // testHelpers.mts: builds a valid Game; every card of the variant's deck not placed by `parts` goes to the discard pile
  function buildGame(parts: { config: GameConfig; hands?: ReadonlyArray<ReadonlyArray<Card>>;
        zones?: ReadonlyArray<DrivingZone>; drawPile?: ReadonlyArray<Card>; phase?: Phase;
        raceNumber?: number; extension?: ExtensionState; points?: ReadonlyArray<number> }): Game;
  // New Rejection variants: NotYourTurn{current: PlayerName}, CardNotInHand{card: Card},
  //   WrongPhase, WindowOpen, NoWindowOpen, NotOnTargetTeam, WrongSafetyForHazard{hazard: HazardCard, card: SafetyCard},
  //   ExtensionOfferOpen{decider: PlayerName}, NoExtensionOffer, NotTheCaller{decider: PlayerName},
  //   UnsupportedPlayerCount{count: number}, WrongDeck
  ```
  Test configs from `testHelpers.mts`: `twoByTwo()` (4 humans `Ann, Bob, Cy, Di`; teams `[[Ann, Cy],[Bob, Di]]`, `length: "Full"`), `oneOnOne()` (Ann, Bob), `threeSolo()` (Ann, Bob, Cy), and `threeByTwo()` (Ann, Bob, Cy, Di, Ed, Flo; teams `[[Ann, Di],[Bob, Ed],[Cy, Flo]]`).

- [ ] **Step 1: Write failing tests.**
  ```ts
  it("createGame deals 6 cards each in turn order and auto-draws for the first player", () => {
      const { game, events } = createGame(twoByTwo(), createDeck()).throwIfFailed();
      expect(game.players.map((p) => p.seat.name)).toEqual(["Ann", "Bob", "Cy", "Di"]);
      expect(game.players.map((p) => p.hand.length)).toEqual([7, 6, 6, 6]);
      expect(game.drawPile.length).toBe(106 - 24 - 1);
      expect(game.extension).toEqual({ kind: "NotApplicable" });
      expect(game.phase).toEqual({ kind: "Turn", player: game.players[0]!.seat.id });
      expect(events.map((e) => e.type)).toEqual(["RaceDealt", "TurnStarted", "CardDrawn"]);
  });
  ```
  More cases:
  - `variantForSeatCount`: 2, 3, 4, 6 give the variants in Interfaces; 0, 1, 5, 7 → `UnsupportedPlayerCount{count}`.
  - Draw pile sizes after dealing and the first draw: 2 seats (Reduced deck) 88, 3 seats 82, 4 seats 81, 6 seats 69; Extension is `Available` for 2, 3, and 6 seats.
  - `createGame` with a Standard deck for 2 seats, or a Reduced deck for 4 seats → failure (`WrongDeck` message).
  - Hands come from the deck prefix as specified, checked with `deckFor`.
  - Invalid configs are rejected: 1 seat, 5 seats, 7 seats, 4 seats as 4 teams of 1, 6 seats as 2 teams of 3, duplicate names differing only by case, no human.
  - `tripDistance`: `Available` → 700; `NotApplicable` and `Called` → 1,000.
  - `checkInvariants` passes on a fresh game of each seat count and fails (message mentions the card) on a copy with one card duplicated, a hand of 8, a phase naming an unknown player, `teams.length` ≠ `config.teams.length`, `extension` `Available` in a 4-seat game, `extension` `NotApplicable` in a 2-seat game, `Called` naming a missing team, an `ExtensionOffer` while Extension is not `Available`, or a zone beyond the current trip distance.
  - `buildGame` output always passes `checkInvariants`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `createGame` using an internal `dealRace(config, players, teams, deck, raceNumber)` that Task 9 reuses.
  `checkInvariants` counts every physical card: hands, draw pile, discard pile, zone distance cards, safeties, an active blocking hazard, an active speed limit (as `Speed Limit`), and an in-flight hazard in `HazardIncoming`.
  The multiset must equal the variant's deck.
- [ ] **Step 4: Run, expect PASS; commit** (`feat(core): variants, game types, creation, invariants`).

---

### Task 6: Rules, plays, turn flow, race end

**Files:**
- Create: `src/rules.mts`.
- Modify: `src/engine.mts` (add `applyPlayerCommand` for `Drive`, `Remedy`, `PlaySafety`, `Discard`; `Attack`, `CoupFourre`, `CallExtension`, `DeclineExtension` return `WrongPhase` until Tasks 7 and 8), tests.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  ```ts
  type PlayContext = { me: PlayerId; myTeam: TeamIndex; hand: ReadonlyArray<Card>;
                       zones: ReadonlyArray<DrivingZone>;      // index = TeamIndex
                       tripDistance: Miles;                    // the distance currently in force
                       phase: { kind: "Turn"; player: PlayerId; playerName: PlayerName }
                            | { kind: "HazardIncoming"; attacker: PlayerId; hazard: HazardCard; target: TeamIndex }
                            | { kind: "ExtensionOffer"; decider: PlayerId; deciderName: PlayerName }
                            | { kind: "Over" } };
  function contextFromGame(g: Game, me: PlayerId): Result<PlayContext, Rejection>;
  function checkCommand(ctx: PlayContext, cmd: PlayerCommand): Result<void, Rejection>;
  function applyPlayerCommand(g: Game, by: PlayerId, cmd: PlayerCommand): Result<Applied, Rejection>;
  ```
  `checkCommand` order: phase, turn (`NotYourTurn`), card in hand (`CardNotInHand`), then zone rules.
  Phase rules: in `Turn` the usual commands apply, and `CallExtension`/`DeclineExtension` → `NoExtensionOffer`; in `HazardIncoming` only `CoupFourre` is allowed and everything else → `WindowOpen`; in `ExtensionOffer` only `CallExtension`/`DeclineExtension` from the decider are allowed, a different player → `NotTheCaller{decider}`, any other command → `ExtensionOfferOpen{decider}`; in `RaceOver`/`GameOver` everything → `WrongPhase`.
  Any card may be discarded.
  After a play: `Drive`/`Remedy`/`Discard` pass the turn; `PlaySafety` keeps the turn with the same player; passing or continuing a turn starts the next turn.
  After a `Drive`, using the zone's miles and `tripDistance(game.extension)`:
  - Extension `Available` and miles exactly 700 → phase `ExtensionOffer{decider: the driver, team}` and event `ExtensionOffered` (the offer is resolved in Task 8; no turn starts yet).
  - Otherwise miles exactly equal to the trip distance → the race ends as `TripCompleted` with `delayedAction` true when the draw pile is empty and `extensionCaller` set from a `Called` extension (else `null`).
  Starting a turn: `TurnStarted` event, then `CardDrawn` if the draw pile is not empty.
  The next player is the next in turn order who holds cards.
  If nobody holds cards, the race ends as `Exhausted`.
  Ending a race: `scoreRace(standardScoring, zones, outcome, teams.map((t) => t.points))`, set each `team.points` to that team's `combinedTotal`, `resolveRace` on the combined totals, set phase `RaceOver` or `GameOver` carrying the `RaceResult` (the scoreboard), emit `RaceEnded` (and `GameEnded`).
  The zones are left as they were at the end of the race so the scoreboard can show them.

- [ ] **Step 1: Write failing tests** (rig hands with `deckFor`/`buildGame`).
  ```ts
  it("Drive moves the card to the zone and passes the turn", () => {
      const g = gameWhereAnnHolds([Card.roll, Card.dist75 /* ... */]);   // helper in the test file
      const afterRoll = applyPlayerCommand(g, ann, { type: "Remedy", card: Card.roll }).throwIfFailed();
      expect(afterRoll.events.map((e) => e.type)).toEqual(["RemedyPlayed", "TurnStarted", "CardDrawn"]);
      expect(afterRoll.game.phase).toEqual({ kind: "Turn", player: bob });
  });
  ```
  More cases:
  - Not your turn → `NotYourTurn{current: "Ann"}`; card not in hand → `CardNotInHand`; `Drive` of `roll` is unrepresentable.
  - `Discard` puts the card on top of `discardPile` and passes the turn.
  - `PlaySafety` keeps the turn: events `SafetyPlayed, TurnStarted, CardDrawn`, same player, hand back to 7.
  - Rejections from the zone surface unchanged (a third 200 → `TooManyTwoHundreds`).
  - Hand-size invariant: after any accepted command `checkInvariants` passes.
  - 4 seats, `Full`: completing 1,000 miles with `[100×10]` gives phase `RaceOver`, outcome `TripCompleted` with `extensionCaller` null, `delayedAction` false while the draw pile is non-empty and true when it is empty, each `team.points` equal to that team's `combinedTotal`, `result.scores` holding one `RaceScore` per team with `broughtForward` equal to the points before the race, and events end with `RaceEnded`.
  - 4 seats, `Quick`: the same completion gives `GameOver` and `GameEnded`.
  - 2 seats: a team at 650 miles that plays a 100 → `WouldOvershoot{remaining: 50, trip: 700}`; playing a 50 brings it to exactly 700, which opens an `ExtensionOffer` phase for that player, emits `DistancePlayed, ExtensionOffered`, and does not end the race.
  - 2 seats: other commands during the offer return `ExtensionOfferOpen`, a different player's `CallExtension` returns `NotTheCaller`, and `CallExtension` in a `Turn` phase returns `NoExtensionOffer` (resolution in Task 8).
  - **Exhaustion (Review Focus 1):**
    - With an empty draw pile, a new turn emits no `CardDrawn`.
    - Empty-handed players are skipped.
    - A `PlaySafety` by a player whose hand then becomes empty (empty pile) passes to the next player holding cards.
    - When the last card in the game is played, the race ends `Exhausted` with the winner the team with the most miles, and `"Tie"` when equal.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with small private helpers (`startTurn`, `nextPlayerWithCards`, `finishRace`).
  Every state change builds new objects.
- [ ] **Step 4: Run, expect PASS; commit** (`feat(core): rules, plays, turn flow, race end`).

---

### Task 7: Attacks, hazard window, Coup Fourré

**Files:**
- Modify: `src/engine.mts` (add `Attack`, `CoupFourre`, `applySystemCommand` with `CloseHazardWindow`), `src/rules.mts`, tests.

**Interfaces:**
- Consumes: Tasks 3, 5, 6.
- Produces:
  ```ts
  function applySystemCommand(g: Game, cmd: SystemCommand): Result<Applied, Rejection>;
  // StartNextRace returns WrongPhase until Task 9.
  ```
  `Attack`: validated by `canAttack` on the target team's zone (`CannotAttackOwnTeam` first).
  It removes the card from the attacker's hand, leaves every zone unchanged, sets phase `HazardIncoming`, and emits `HazardPlayed` (no turn start yet).
  While the window is open every other player command returns `WindowOpen`.
  `CoupFourre`: valid only in the window, from a member of the target team (`NotOnTargetTeam`) who holds the safety that counters the hazard (`WrongSafetyForHazard`).
  It records the safety as a Coup Fourré, discards the hazard card, draws a replacement if the pile has cards, then starts that player's own turn (a second draw).
  Events: `CoupFourrePlayed, CardDrawn, TurnStarted, CardDrawn`.
  `CloseHazardWindow`: valid only in the window (else `NoWindowOpen`).
  It lands the hazard on the target zone (`HazardLanded`), then starts the turn of the next player after the attacker who holds cards (or ends the race as `Exhausted` if none).

- [ ] **Step 1: Write failing tests.**
  - An accident played by Ann on Team 2: phase `HazardIncoming{attacker: ann, hazard: "Accident", target: 1}`, Ann's hand is 6, Team 2's zone is unchanged, events are `["HazardPlayed"]`.
  - `CloseHazardWindow` then lands it: zone status `Hazard(accident)`, events `HazardLanded, TurnStarted, CardDrawn`, next player Bob.
  - A `Drive` by anyone during the window → `WindowOpen`.
  - An `Attack` on your own team → `CannotAttackOwnTeam`; on a protected team → `TargetProtected`.
  - Puncture Proof Coup Fourré against Flat Tire by the victim: zone status unchanged, safety recorded with `coupFourre:true`, hazard on top of the discard pile, victim's hand 7 (two draws), phase `Turn` with the victim, turn order continues from them.
  - A Coup Fourré by a victim's teammate works; by the other team → `NotOnTargetTeam`; with the wrong safety → `WrongSafetyForHazard`.
  - Right of Way works as a Coup Fourré against both Stop and Speed Limit.
  - **Races (Review Focus 2):**
    - A second `CoupFourre` after the first resolved → `NoWindowOpen`.
    - `CloseHazardWindow` after a Coup Fourré → `NoWindowOpen`.
    - `CloseHazardWindow` in a `Turn` phase → `NoWindowOpen`.
  - Coup Fourré with an empty draw pile does not draw and does not crash (hand 5 or fewer).
  - An attack as the attacker's last card with every other hand empty still opens a window, and closing it ends the race `Exhausted`.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): attacks and Coup Fourré window`).

---

### Task 8: Extension offer

**Files:**
- Modify: `src/engine.mts` (`CallExtension`, `DeclineExtension` in `applyPlayerCommand`; `CloseExtensionOffer` in `applySystemCommand`), tests.

**Interfaces:**
- Consumes: Tasks 4–7 (`ExtensionOffer` phase, `ExtensionState`, `scoreRace`).
- Produces: engine behavior for the offer opened in Task 6.
  - `CallExtension` (decider only, in phase `ExtensionOffer`): `extension` becomes `Called{caller: the decider's team}`, event `ExtensionCalled`, then play continues as after any `Drive`: start the next player's turn (or end the race as `Exhausted` with that `extensionCaller` if nobody holds cards).
  - `DeclineExtension` (decider only) and `CloseExtensionOffer` (system, the timeout) behave identically: event `ExtensionDeclined`, then the race ends as `TripCompleted{team: the decider's team, delayedAction: draw pile empty, extensionCaller: null}`.
  - Rejections: `NoExtensionOffer` when there is no offer (including every command in a no-Extension game, and any `CloseExtensionOffer` outside the offer), `NotTheCaller{decider}`, `ExtensionOfferOpen{decider}` (already pinned in Task 6).
  - After `Called`, the trip distance is 1,000 for every team, and a later team reaching 700 opens no offer.
  - A race that ends with `Called{caller}` still in force carries `extensionCaller: caller`, whether it ends by a completed trip or by exhaustion.

- [ ] **Step 1: Write failing tests.** Use a 2-seat game where Ann has 650 and holds a 50, and a 3-seat game for the multi-opponent payouts.
  ```ts
  it("declining Extension at 700 completes the trip and ends the race", () => {
      const offered = annReaches700();                                   // helper in the test file
      const { game } = applyPlayerCommand(offered, ann, { type: "DeclineExtension" }).throwIfFailed();
      expect(game.phase).toEqual(jasmine.objectContaining({ kind: "RaceOver" }));
      const result = (game.phase as { result: RaceResult }).result;
      expect(result.outcome).toEqual({ kind: "TripCompleted", team: 0, delayedAction: false, extensionCaller: null });
      expect(result.scores[0]!.tripCompleted).toBe(400);
      expect(result.scores.every((s) => s.extension === 0)).toBeTrue();
  });
  ```
  More cases:
  - `CloseExtensionOffer` gives exactly the same result as `DeclineExtension`, with events `ExtensionDeclined, RaceEnded`.
  - `CallExtension`: `game.extension` is `Called{caller: 0}`, events `ExtensionCalled, TurnStarted, CardDrawn`, turn passes to Bob, and Ann (at 700) can later play a 100 to reach 800 while Bob's limit is also 1,000.
  - The caller reaches 1,000 first: `extensionCaller` 0 in the outcome, Ann's `extension` row 200 and `tripCompleted` 400, Bob's `extension` 0.
  - Bob reaches 1,000 first in a 3-seat game with Ann calling: Bob has `tripCompleted` 400 and `extension` 200, Cy has `extension` 200, Ann has neither a trip bonus nor an extension bonus.
  - The cards run out after the call: `Exhausted` with `extensionCaller` 0, and every other team has `extension` 200.
  - A second team reaching exactly 700 after `Called` does not open an offer (the turn simply passes).
  - **Races (Review Focus 2):**
    - `CloseExtensionOffer` after `CallExtension` or after `DeclineExtension` → `NoExtensionOffer`.
    - `CallExtension` after `DeclineExtension` → `WrongPhase`.
    - `CloseExtensionOffer` in a `Turn` phase → `NoExtensionOffer`.
    - In a 4-seat game `CallExtension` → `NoExtensionOffer`.
  - The 700th mile is a player's last card and every other hand is empty: the offer still opens, `CallExtension` ends the race `Exhausted` with `extensionCaller` set, and `DeclineExtension` ends it `TripCompleted`.
  - With an empty draw pile, `DeclineExtension` gives `delayedAction: true`.
  - `checkInvariants` holds after every command above.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): Extension offer`).

---

### Task 9: Next race and multi-race games

**Files:**
- Modify: `src/engine.mts` (`StartNextRace`), tests.

**Interfaces:**
- Consumes: Tasks 5–8.
- Produces: `applySystemCommand(g, { type: "StartNextRace", deck })`: valid only in phase `RaceOver` (else `WrongPhase`, including in `GameOver`); a deck whose kind is not the variant's → `WrongDeck`.
  It resets every zone with `newZone()`, resets `extension` with `initialExtension(variant)`, clears the discard pile, deals from `deck` with the same `dealRace` as `createGame`, keeps `team.points`, increments `raceNumber`, and makes `players[(raceNumber - 1) % players.length]` the first player (auto-draw, `TurnStarted`).
  Events: `RaceDealt, TurnStarted, CardDrawn`.
  The engine never advances on its own: `RaceOver` persists, so players can read the scoreboard, until the server issues `StartNextRace` (milestone 2 does this when the organizer taps "Deal next race").

- [ ] **Step 1: Write failing tests.**
  - In `RaceOver`, every player command returns `WrongPhase` and the phase (with its scoreboard) is unchanged.
  - A scripted two-race game: the second race's `RaceScore.broughtForward` equals the first race's `combinedTotal` for each team.
  - After a `Full` race ends in `RaceOver`, `StartNextRace` gives `raceNumber` 2, empty zones, empty discard pile, points preserved, and the first player is the second player in turn order.
  - After a race in which Extension was called, the next race starts with `extension` `Available` again (2, 3, or 6 seats) and a 700-mile trip.
  - `StartNextRace` in a `Turn` phase or in `GameOver` → `WrongPhase`; a Standard deck in a 2-seat game → `WrongDeck`.
  - `Short`: totals reaching 2,000 end the game through the engine (`GameOver`, correct winner); a race ending with totals `[2000, 2000]` yields `RaceOver`, then a further race can be played.
  - Quick tie on exhaustion (equal miles) → `RaceOver`, not `GameOver`.
  - **Three teams (Review Focus 5):** in a 3-team, 2-per-team game, completing the trip while both opponents have 0 miles earns the `shutout` row (500); with one opponent at 25 miles it is 0.
  - `checkInvariants` holds after every command in a scripted two-race game.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): next race and multi-race games`).

---

### Task 10: Views, event redaction, legal plays

**Files:**
- Create: `src/view.mts`, `src/view.test.mts`.
- Modify: `src/rules.mts` (`contextFromView`).

**Interfaces:**
- Consumes: Tasks 5–9.
- Produces:
  ```ts
  type ViewSeat = { id: PlayerId; name: PlayerName; team: TeamIndex; handSize: number; isMe: boolean };
  type ViewPhase = { kind: "Turn"; player: PlayerId }
                 | { kind: "HazardIncoming"; attacker: PlayerId; hazard: HazardCard; target: TeamIndex }
                 | { kind: "ExtensionOffer"; decider: PlayerId; team: TeamIndex }
                 | { kind: "RaceOver"; result: RaceResult }
                 | { kind: "GameOver"; winner: TeamIndex; result: RaceResult;
                     reveal: ReadonlyArray<{ id: PlayerId; name: PlayerName; kind: "Human" | "Robot" }> };
  type PlayerView = { gameId: GameId; raceNumber: number; length: GameLength;
                      me: { id: PlayerId; name: PlayerName; team: TeamIndex; hand: ReadonlyArray<Card> };
                      seats: ReadonlyArray<ViewSeat>;           // turn order
                      teams: ReadonlyArray<{ index: TeamIndex; zone: DrivingZone; points: Points }>;
                      trip: { distance: Miles; extension: ExtensionState };  // the distance now in force
                      drawPileCount: number; discardTop: Card | null; phase: ViewPhase };
  function viewFor(g: Game, player: PlayerId): Result<PlayerView, Rejection>;
  function eventsFor(viewer: PlayerId, events: ReadonlyArray<GameEvent>): ReadonlyArray<GameEvent>;
  //   CardDrawn.card is null unless the viewer is the drawer; all other events unchanged
  function contextFromView(v: PlayerView): PlayContext;
  function candidateCommands(v: PlayerView): ReadonlyArray<PlayerCommand>; // every well-formed command for the hand
  function legalPlays(v: PlayerView): ReadonlyArray<PlayerCommand>;        // candidates accepted by checkCommand
  ```
  Seats never carry `kind`; `reveal` exists only in `GameOver`.
  `candidateCommands` includes `CallExtension` and `DeclineExtension` only for the decider during an `ExtensionOffer`.

- [ ] **Step 1: Write failing tests.**
  - With distinctive hands via `deckFor`, `view.me.hand` equals the viewer's hand and no other hand's card appears in the serialized view beyond what is public.
  - In `RaceOver` and `GameOver` the view's `result.scores` has one `RaceScore` per team with every row present (including `broughtForward`, `extension`, and `combinedTotal`), and `teams[i].zone` still shows the finished race's miles, safeties, and Coup Fourrés, so the client can render the full score sheet for every team.
  - No key named `hand` on seats, no key `drawPile` (only `drawPileCount`), and `JSON.stringify(view)` contains no `"Robot"` before `GameOver` but does in `reveal` at `GameOver`.
  - `eventsFor` leaves `CardDrawn.card` for the drawer and nulls it for others.
  - `legalPlays`: with a hand `[Roll, dist75]` on `NeedsRoll` it contains `Remedy Roll` and every `Discard`, but not `Drive 75`.
  - `trip` is `{distance: 700, extension: Available}` in a fresh 2-seat game, `{distance: 1000, extension: Called{...}}` after a call, and `{distance: 1000, extension: NotApplicable}` in a 4-seat game.
  - During an `ExtensionOffer` the decider's `legalPlays` is exactly `CallExtension` and `DeclineExtension`; every other player's is empty.
  - For each scripted rejected command, `checkCommand(contextFromView(view), cmd)` returns the same `Rejection` as `applyPlayerCommand` on the full game.
  - During the hazard window, only team members holding the counter-safety have `CoupFourre` in `legalPlays`; others see no plays.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): views, redaction, legal plays`).

---

### Task 11: Whimsical names and the pending game (lobby)

**Files:**
- Create: `src/whimsicalNames.mts`, `src/pendingGame.mts` and tests.

**Interfaces:**
- Consumes: Tasks 1, 5 (`Seat`, `GameConfig`, `GameLength`, `variantForSeatCount`).
- Produces:
  ```ts
  const whimsicalNames: ReadonlyArray<PlayerName>;   // >= 30, all valid, all distinct, includes "Sir Honks-a-Lot", "Gary the Flat Tire"
  function pickWhimsicalName(taken: ReadonlyArray<PlayerName>, rand?: () => number): Result<PlayerName, string>;
  // Seat order is turn order; a seat's team is its index modulo the team count (see "Rules").
  type PendingGame = { id: GameId; organizer: PlayerId; length: GameLength; seats: ReadonlyArray<Seat> };
  type PendingCommand =
    | { type: "AddHuman"; seat: Seat } | { type: "AddRobot"; seat: Seat }
    | { type: "RemoveSeat"; id: PlayerId } | { type: "SwapSeats"; a: PlayerId; b: PlayerId }
    | { type: "SetLength"; length: GameLength };
  function createPending(id: GameId, organizer: Seat): PendingGame;
  function applyPendingCommand(p: PendingGame, by: PlayerId, cmd: PendingCommand): Result<PendingGame, Rejection>;
  function teamLayout(p: PendingGame): Result<ReadonlyArray<ReadonlyArray<Seat>>, Rejection>;
  //   the teams the seats form right now, or UnsupportedPlayerCount{count} when the seat count has no variant
  function readiness(p: PendingGame): Result<GameConfig, Rejection>;      // why Start is disabled
  function beginGame(p: PendingGame, by: PlayerId, deck: ShuffledDeck): Result<Applied, Rejection>;
  // New Rejection variants: NameTaken{name}, TooManyPlayers, NotOrganizer, NoSuchSeat, SeatAlreadyJoined,
  //   OrganizerCannotLeave   (UnsupportedPlayerCount comes from Task 5)
  ```
  Rules: `AddHuman` is allowed only for oneself (`by === seat.id`); the organizer alone may `AddRobot`, `SwapSeats`, `SetLength`, and remove others; anyone may remove themselves except the organizer.
  A new seat is appended to the end of the seat order.
  Names must be unique across seats (`PlayerName.isSame`); at most 6 seats.
  `teamLayout` and `readiness` succeed only for 2, 3, 4, or 6 seats (`UnsupportedPlayerCount` otherwise).
  `describeRejection` gets plain messages for all new variants, e.g. `UnsupportedPlayerCount{count: 5}` → "Mille Bornes needs 2, 3, 4, or 6 players. You have 5, so add a robot."
  Choose the message's advice from the count: 1 → "add a robot", 5 → "add a robot", 7 or more → "remove someone".

- [ ] **Step 1: Write failing tests.**
  - Pool: at least 30 names, all distinct under `isSame`.
  - `pickWhimsicalName` never returns a taken name (including a case-variant) and fails only when the pool is exhausted.
  - The organizer alone → `readiness` fails `UnsupportedPlayerCount{count: 1}`; adding a robot → `Ok` with 2 teams of 1.
  - Team layouts: 3 seats → 3 teams of 1; 4 seats `[a,b,c,d]` → teams `[[a,c],[b,d]]`; 5 seats → `UnsupportedPlayerCount{count: 5}`; 6 seats `[a..f]` → 3 teams `[[a,d],[b,e],[c,f]]`.
  - `SwapSeats(b, c)` on 4 seats `[a,b,c,d]` gives order `[a,c,b,d]` and teams `[[a,b],[c,d]]`; an unknown id → `NoSuchSeat`; by a non-organizer → `NotOrganizer`.
  - Duplicate name differing by case or surrounding whitespace → `NameTaken` (Review Focus 4).
  - A seventh seat → `TooManyPlayers`.
  - A non-organizer `AddRobot` → `NotOrganizer`; the organizer removing themselves → `OrganizerCannotLeave`; a seat joining twice → `SeatAlreadyJoined`.
  - `AddHuman` for another player's id → `NotOrganizer`.
  - `readiness(...)` returns a `GameConfig` that `validateGameConfig` accepts, with `teams` equal to `teamLayout`.
  - `beginGame` by a non-organizer → `NotOrganizer`; by the organizer returns the same `Applied` as `createGame(config, deck)`; a deck of the wrong kind surfaces the failure.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): whimsical names and pending game`).

---

### Task 12: Wire schemas and snapshot decoding

**Files:**
- Create: `src/schemas.mts`, `src/schemas.test.mts`.

**Interfaces:**
- Consumes: all earlier modules.
- Produces:
  ```ts
  const playerCommandSchema: z.ZodType<PlayerCommand>;     // strict objects, category-checked cards
  const pendingCommandSchema: z.ZodType<PendingCommand>;
  function encodeGame(g: Game): unknown;                   // plain JSON value
  function decodeGame(json: unknown): Result<Game, string>;           // structure, then checkInvariants
  function encodePendingGame(p: PendingGame): unknown;
  function decodePendingGame(json: unknown): Result<PendingGame, string>;
  ```
  Use Zod enums (`cardSchema`, category schemas) and `.transform` to apply brands via the value types' `tryCreate`.
  Cap array sizes (hands ≤ 7, teams ≤ 3, players ≤ 6, a deck ≤ 106, pending seats ≤ 6).
  Apply `validateGameConfig` and `checkInvariants` after parsing.

- [ ] **Step 1: Write failing tests.**
  - `playerCommandSchema` accepts one valid example of each command type, including `CallExtension` and `DeclineExtension`.
  - It rejects an unknown `type`, an extra field, `{type:"Drive", card:"Roll"}`, `targetTeam: 5`, and `null`.
  - `decodeGame(JSON.parse(JSON.stringify(encodeGame(g))))` equals `g` for a fresh game of each seat count (2, 3, 4, 6) and for mid-game states (a hazard window open, zones with safeties, an `ExtensionOffer`, `extension` `Called`, `RaceOver`).
  - **Hostile JSON (Review Focus 3):** `decodeGame` returns a failed `Result` (no throw) for `null`, `{}`, a game with a duplicated card, a hand of 8, a phase naming an unknown player, a mismatched team count, an unknown card string, an extra top-level property, `extension` `Available` in a 4-seat game, and an `ExtensionOffer` phase whose team is not at 700 miles.
  - `decodePendingGame` rejects duplicate seat ids, duplicate names differing by case, and more than 6 seats.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): wire schemas and snapshot decoding`).

---

### Task 13: Robot strategy

**Files:**
- Create: `src/bot.mts`, `src/bot.test.mts`.

**Interfaces:**
- Consumes: `PlayerView`, `legalPlays`, `PlayerCommand` (Task 10).
- Produces:
  ```ts
  function chooseCommand(view: PlayerView, rand?: () => number): PlayerCommand | null;
  ```
  Returns `null` when the robot has no decision to make (not its turn, no Coup Fourré available, and no Extension offer for it).
  Always returns a member of `legalPlays(view)`.
  Priority: a Coup Fourré if it is on the target team and holds the counter; during an Extension offer for it, `CallExtension` when its team leads every other team by at least 100 miles, else `DeclineExtension`; on its turn, `Drive` the largest card that completes or advances the trip, else a cure or remedy for an active hazard, else `Roll` when stopped, else a safety, else an `Attack` on the team with the most miles, else the least useful `Discard`.

- [ ] **Step 1: Write failing tests** with scripted views:
  - Holding a trip-completing `Drive` → chosen.
  - On the target team of `HazardIncoming` while holding the counter → `CoupFourre`; not holding it → `null`.
  - `NeedsRoll` holding `Roll` → `Remedy Roll`.
  - Active Flat Tire holding Spare Tire → `Remedy Spare Tire`.
  - Nothing playable → a `Discard`.
  - Not its turn → `null`.
  - Extension offer for the robot with a 150-mile lead → `CallExtension`; with a 50-mile lead → `DeclineExtension`; an offer for someone else → `null`.
  - Across 200 random reachable views (use the Task 14 simulation helper once available; until then, scripted), the returned command is always in `legalPlays`.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(core): robot strategy`).

---

### Task 14: Simulation, property tests, soak, final gate

**Files:**
- Create: `src/simulation.mts`, `src/simulation.test.mts`, `src/soak.mts`.

**Interfaces:**
- Consumes: everything.
- Produces:
  ```ts
  function seededRandom(seed: number): () => number;                          // mulberry32
  type SimulationResult = { game: Game; steps: number; racesPlayed: number };
  function playGame(config: GameConfig, rand: () => number, maxSteps?: number): Result<SimulationResult, string>;
  //   loops until GameOver: robots choose via chooseCommand (all seats are driven by the bot),
  //   HazardIncoming -> offer Coup Fourré to each target-team seat, then CloseHazardWindow,
  //   ExtensionOffer -> the decider's chooseCommand, falling back to CloseExtensionOffer,
  //   RaceOver -> StartNextRace with shuffleDeck(variant.deck, rand); checkInvariants after every step;
  //   fails (message includes the seed context) on a rejected bot command, broken invariant, or maxSteps (default 20000)
  ```
  `soak.mts`: `npm run soak -w @repo/mille-bornes-core -- <games>` plays that many seeded games over varied configs, prints each failing seed, and exits non-zero on any failure.

- [ ] **Step 1: Write failing tests** with `fast-check`.
  - For every supported seat count (2, 3, 4, 6, with the matching team layout), each game length, and arbitrary seeds (`numRuns: 200`): `playGame` succeeds, ends in `GameOver`, and every step satisfied `checkInvariants`.
  - Across those games, at least one race in the 2-, 3-, and 6-seat runs reaches an `ExtensionOffer` and at least one has `extension` `Called` (assert over a fixed batch of seeds so the property tests really exercise Extension).
  - Extension payouts: in every finished race whose outcome has `extensionCaller` set, the `extension` rows are 200 for the caller only when the caller completed the trip, and otherwise 200 for every team except the caller and 0 for the caller.
  - Never-throws fuzz: from reachable states, arbitrary well-formed `PlayerCommand`s from arbitrary players never throw; rejected commands leave the game untouched.
  - Immutability: `deepFreeze` the game before each command; no command throws a `TypeError`.
  - `legalPlays` agrees with the engine: every command in `legalPlays(view)` is accepted by `applyPlayerCommand`, and every other candidate is rejected.
  - Every command `chooseCommand` returns is accepted by the engine (reachable views from simulated games).
  - `seededRandom(7)` produces the same sequence on every call.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement** `simulation.mts` and `soak.mts`.
- [ ] **Step 4: Run the new tests, expect PASS.**
  Fix any real engine bug the property tests reveal in the module that owns it, and add a pinning example test for it in that module's test file.
- [ ] **Step 5: Run `npm run soak -w @repo/mille-bornes-core -- 2000`, expect exit code 0 and no failing seeds.**
- [ ] **Step 6: Run the final gate from the repo root: `npm run all && npm run type-check`, expect success; commit** (`feat(core): simulation, soak script, and property tests`).
