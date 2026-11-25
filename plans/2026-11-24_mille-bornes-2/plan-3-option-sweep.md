# Prefer `Option` and `Result` Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `packages/mille-bornes-core` and `apps/mille-bornes-game-server`, replace `T | null` and `T | undefined` in TypeScript code with depot's `Option<T>`, and replace "an error or nothing" returns with `Result`.
`null` stays only in the plain-JSON wire and snapshot shapes.
This is a behavior-preserving refactor.

**Architecture:** Wire and persisted types keep `null`; everything else becomes `Option`/`Result`; conversion happens at the boundary with `Option.fromNullable` and `Option.toNullable`.

**Tech Stack:** TypeScript 6, depot `Option` (`@repo/depot/option`: `SomeOption`, `NoneOption`, `Option.fromNullable`, `Option.toNullable`, `match`, `mapSome`, `bind`, `defaultValue`) and `Result`, Jasmine.

**Spec:** the owner's rule of 2026-11-25: "Option and Result should always be preferred" in TypeScript code, with `null` fine on the wire.
Earlier plans (`plan-1-core.md`, `plan-2-server.md`) required plain-JSON `null` for state; that still holds for the wire and snapshot shapes below.

## Global Constraints

- Follow `AGENTS.md` and `.editorconfig` (two blank lines after imports and between members, JSDoc with `@param`/`@returns` on exported items, comments wrapped at 80 columns, lines under 100 columns, test layout).
- **Behavior must not change.**
  Every existing test keeps its meaning: adapt signatures and assertions to `Option`/`Result`, never delete or weaken a test.
  Wire shapes, snapshot files, tRPC outputs, and rendered text stay byte-for-byte compatible (the schema round-trip tests and the end-to-end tests are the proof).
- **Types that keep `null` (wire, persisted, or Zod-schema-derived, so plain JSON):**
  `Game`, `Phase`, `PlayerState`, `TeamState`, `RaceResult` and its outcome and score types (including `extensionCaller: TeamIndex | null`), `PendingGame`, `Seat`, `GameEvent` (including `CardDrawn.card`), `PlayerView`, `ViewPhase`, `ViewSeat`, `PendingView`, `PendingSeatView`, `PendingSummary`, `Screen` and its parts, `PlayerCommand`, `PendingCommand`, `SystemCommand`, `Rejection`, `GameRecord`, `SessionRecord`, anything produced by a Zod schema, and anything in the plan documents named as plain JSON.
- **Everything else converts:** function and method return types, parameters, class fields, interface members that are not in the list above, and locals.
  - Results of `Array.find`, `Map.get`, regex matches and similar standard-library lookups that are returned, stored, or passed on become `Option.fromNullable(...)`; so do locals that are immediately tested for `undefined`/`null` unless the conversion would make a hot path measurably slower (see the performance rule).
  - Values owned by an external API (Node, Express, tRPC, Zod issue types, `NodeJS.ErrnoException`, request headers, callback signatures a library dictates) are converted with `Option.fromNullable` as soon as they enter our code, and back with `Option.toNullable` where they must leave.
  - A function that returns "a failure message or nothing" (for example the invariant `Check` type and the `Rejection | null` rule checks) returns `Result<void, E>` rather than an inverted `Option`.
  - A plain optional parameter (`x?: T`) stays only when absence means "use the default"; otherwise it is an `Option<T>` parameter.
  - `void` results (`SucceededResult<void>(undefined)`), `.catch(() => undefined)`-style discard callbacks, and `throw` that a library requires (`TRPCError`) or rethrows inside `catch` stay as they are.
- **Performance rule:** the engine's hot paths (`legalPlays`, `checkPlay`/`checkCommand`, `playGame`) were optimized earlier.
  After the core sweep, `npm run soak -w @repo/mille-bornes-core -- 2000` must still report 0 failed games and take no more than about 1.3 times the earlier 19 s, and the core test suite no more than about 1.3 times its earlier 21 s.
  If a conversion in a hot path costs more than that, keep the `null`/`undefined` local there and say so in a one-line comment (`shortcut: ...`), and report it.
- Public signatures that change (for example `chooseCommand`, `pointsGoal`, `parseBearer`, `SessionRegistry.nameOf`, `Table.timer`) get their JSDoc and every caller and test updated in the same task.
- Run one test file with: `npm test -w <package> -- src/<name>.test.mts`; core is consumed through `dist`, so run `npm run build -w @repo/mille-bornes-core` after the core task.
- Final gate: `npm run all && npm run type-check` from the repo root passes (only the 2 known `mille-bornes-shared` lint warnings are acceptable).
- Commit messages have no trailer lines of any kind and no model names.

## Review Focus

- A converted function that now returns `NoneOption` where it used to return `null` must still be treated identically by every caller (no caller may treat an Option object as truthy: a `SomeOption`/`NoneOption` instance is always truthy, so `if (opt)` is a silent bug).
- `Option<T>` objects must never reach `JSON.stringify` (they serialize as class instances): every wire boundary converts with `toNullable`.
- Equality: comparisons like `x === null` or `x !== undefined` converted by hand must keep their meaning (including for falsy-but-present values such as `0` and `""`).

---

### Task 1: Sweep `packages/mille-bornes-core`

**Files:**
- Modify: the non-test sources under `packages/mille-bornes-core/src/` that contain `| null`, `| undefined`, `return null`, `=== null`, `!== null`, `=== undefined`, `?? null` outside the wire types listed above (known list: `bot.mts`, `driver.mts`, `drivingZone.mts`, `engine.mts`, `invariants.mts`, `pendingGame.mts`, `pendingView.mts`, `rules.mts`, `scoring.mts`, `simulation.mts`, `soak.mts`, `view.mts`, `whimsicalNames.mts`; `events.mts` and the wire parts of `view.mts`, `scoring.mts`, `pendingView.mts` keep `null`), and their tests.
- Do not change `testHelpers.mts` semantics (adapt only to compile).

**Interfaces:**
- Produces (changed signatures; others follow the rule above):
  ```ts
  function chooseCommand(view: PlayerView, rand?: () => number): Option<PlayerCommand>;
  function pointsGoal(length: GameLength): Option<Points>;
  // internal helpers (not exported unless they were): extensionCaller, nextPlayerWithCards,
  // randomChoice, teamIndexOf, checkPhaseAndTurn / checkHand (-> Result<void, Rejection>),
  // checkZone / checkSafety-style helpers (Result<Option<ZoneChange>, Rejection>), invariants Check (-> Result<void, string>)
  ```

- [ ] **Step 1: Inventory.** List every in-scope occurrence (a short table in the report: file, line, kind, decision: convert / keep-wire / keep-hot-path / keep-external).
- [ ] **Step 2: Convert** file by file, running that file's tests as you go; adapt callers and tests; no behavior change.
- [ ] **Step 3: Verify:** core suite passes with the same spec count (or more); `npm run lint` and `npm run type-check` and `npm run depcheck` for core; `npm run soak -w @repo/mille-bornes-core -- 2000` reports 0 failed and is within the performance rule; `schemas.test.mts` round-trips unchanged.
- [ ] **Step 4: Build core** (`npm run build -w @repo/mille-bornes-core`) and commit (`refactor(core): use Option and Result instead of null and undefined`).

---

### Task 2: Sweep `apps/mille-bornes-game-server`

**Files:**
- Modify: the non-test sources under `apps/mille-bornes-game-server/src/` with in-scope occurrences (known list: `app.mts`, `config.mts`, `context.mts`, `hub.mts`, `runningGames.mts`, `screens.mts` (internal parts only; `Screen` keeps `null`), `scriptedPlayer.mts`, `sessions.mts`, `snapshotStore.mts`, `table.mts`, `router.mts`), and their tests.
- Adapt to Task 1's changed core signatures (`chooseCommand`, `pointsGoal`, ...).

**Interfaces:**
- Produces (changed signatures; others follow the rule above):
  ```ts
  function parseBearer(header: Option<string>): Option<Credential>;     // callers wrap the raw header with Option.fromNullable
  class SessionRegistry { nameOf(id: PlayerId): Option<PlayerName>; /* logger option etc. */ }
  class Table { timer(): Option<VisibleTimer>; }
  interface Context { hub: Hub; sessions: SessionRegistry; player: Option<PlayerId> }
  // Hub.gameOf, RunningGames.get/of/screenFor, loadGame, ServerConfig.webRoot (Option<string>), notices and `except` parameters: Option
  // Screen (wire) is unchanged: internal Option values convert with toNullable when the Screen is built.
  ```

- [ ] **Step 1: Inventory** as in Task 1 (the known list is in the grep of `| null`, `| undefined`, `=== undefined`, `return null`, `return undefined`).
- [ ] **Step 2: Convert** file by file with tests; the router's `ctx.player` check, the `Authorization`/`connectionParams` handling, and every wire output keep exactly the same behavior.
- [ ] **Step 3: Verify:** app suite passes (same spec count or more; the end-to-end tests are the wire-compatibility proof); lint, type-check, depcheck, build; then the final gate from the repo root.
- [ ] **Step 4: Commit** (`refactor(game-server): use Option and Result instead of null and undefined`).

---

## Self-review notes

- Core's plain-JSON constraint from milestone 1 is preserved for wire and snapshot shapes and relaxed only for code that is never serialized.
- The risk of this plan is silent truthiness bugs on Option objects and an Option reaching `JSON.stringify`; both are named in Review Focus, and the whole-branch review of this sweep must look for them.
