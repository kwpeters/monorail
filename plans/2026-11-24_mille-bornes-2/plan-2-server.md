# Mille Bornes Game Server (Milestone 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/mille-bornes-game-server`, a Node server that hosts lobbies and games over tRPC (with server-sent-event subscriptions), drives robots and timers, snapshots every game to disk, restores them after a restart, and serves a `/host` page with a QR code.
A scripted client can play a whole game against it.

**Architecture:** Three layers, each testable without the one above.
(1) `Table` owns one running game: it applies commands with the core engine, derives every timer and robot move from `game.phase`, and reports each change.
(2) `Hub` owns every pending and running game, the players' sessions, presence, and persistence, and turns state into one redacted `Screen` per player.
(3) Express, tRPC, and the host page are thin adapters over the `Hub`.
Time (`Clock`), randomness, storage, and logging are injected, so tests use a fake clock and a temp directory.

**Tech Stack:** TypeScript 6, Node 25, Express 5, tRPC 11 (`@trpc/server`, `@trpc/client`), Zod 4, `qrcode`, `@repo/mille-bornes-core`, `@repo/depot`, `@repo/depot-node`, Jasmine via tsx, `eventsource` (a test-only ponyfill for the Node client).

**Spec:** `plans/2026-11-24_mille-bornes-2/design.md` (sections "Coup Fourre window", "Extension offer", "Server").
Milestone 1 is done: `packages/mille-bornes-core`.
Carry-over findings: `plans/2026-11-24_mille-bornes-2/milestone-2-carryover.md`.
This plan covers milestone 2 only.
The web client (milestone 3) gets its own plan once the router's real types exist.
The old `mille-bornes-shared`, `-engine`, and `-server` projects are reference only: do not import them and do not delete them in this plan.

## Global Constraints

- Follow `AGENTS.md` and `.editorconfig` (style, JSDoc with `@param`/`@returns` on exported items, camelCase file names, PascalCase types, `T`-prefixed type parameters, Zod enums, depot `Result`, tests named `baseName.test.mts` with one `describe` per class or module and one nested `describe` per method, two blank lines between adjacent lifecycle blocks).
- Server code never reads the clock, `Math.random`, the file system, or the console directly except in the few adapter files named below: everything else receives a `Clock`, a `rand: () => number`, a `SnapshotStore`, and a `Logger`.
- Never send the client a `PendingGame`, a `Game`, or an unredacted `GameEvent`.
  Only `PendingView`, `PendingSummary`, `PlayerView`, and the events returned by core's `broadcast()` leave the server.
- No hard-coded host names or IP addresses; the client uses relative URLs.
  The server listens on all interfaces; the port comes from `PORT` (default 3000).
- Timings are configuration (`Timings`) with these defaults: hazard window 5,000 ms; Extension offer 30,000 ms; pause after a race 20,000 ms; a robot waits a random 1,000 to 3,000 ms before a play on its turn or an Extension answer; a robot answers a Coup Fourre window with delay 0; a dropped connection counts as disconnected after 3,000 ms.
- A player is in at most one game at a time (pending or running).
- A player's credential is `{ playerId, token }`, sent as `Authorization: Bearer <playerId>.<token>`.
  EventSource cannot set headers, so a subscription sends the same string as the connection parameter `authorization`.
  The token never appears in any view, log line, or error message.
- Add the app's `data/` directory to the repo `.gitignore`.
- Run one test file with: `npm test -w @repo/mille-bornes-game-server -- src/<name>.test.mts` (core: `-w @repo/mille-bornes-core`).
  Core's consumers resolve it through `dist`, so run `npm run build -w @repo/mille-bornes-core` after adding or changing a core export.
- Final gate (Task 11): `npm run all && npm run type-check` from the repo root passes.

## Calls made by the author

These are not in the design; the owner can veto any of them.

- **One subscription per player.**
  `watch` emits a `Screen` (the lobby, a waiting room, or the game) so a reconnecting phone always lands in the right place.
  The first message of every subscription is the current screen; missed events are not replayed, so a phone that was asleep snaps to the latest state without animation.
- **`Result` in server code, a plain object on the wire** (the owner's preference).
  Every `Hub` and `Table` method returns `Result<void, string>`, where the error is plain English from `describeRejection`.
  Only the router converts, with one helper `toOutcome(result): Outcome`, to `{ ok: true } | { ok: false; message }`, because the `Result` class does not survive JSON.
  The client never sees a `Result`.
  tRPC errors are only for a bad or missing credential (`UNAUTHORIZED`) and malformed input (`BAD_REQUEST`).
- **Use depot's `zodHelpers`:** `safeParse`/`zodErrorToString` to decode records and config into a `Result`, and `unwrapOrAddIssue` to turn `GameId.tryCreate` and `PlayerId.tryCreate` into Zod input transforms.
- **Names are per player, not per game.**
  `session.create` takes a typed name or `null` for "Surprise me"; joining a game whose seats already hold that name is refused with `NameTaken`, and the player calls `session.rename`.
- **The race-over scoreboard stays up for the 20 s pause**, then the next race deals automatically.
  There is no "deal now" button.
- **A finished game stays on screen until each human presses "Back to lobby"** (`game.leave`); when every human has left, the game and its snapshot are deleted.
- **`/host` and its "End game" buttons accept loopback requests only** (the PC running the server), so a phone on the LAN cannot end games.
- **Stuck guard:** if the engine ever rejects a command the server itself issued (a robot move or a timer), the game is ended with a notice, its snapshot is moved to `data/failed/` for debugging, and the server keeps running.
- **No command log.**
  The design called it optional; the `failed/` snapshot is the debugging aid.

## Review Focus

Failure modes the spec implies; each has a test in the owning task.

1. A phone locks mid hazard window and reconnects: the new subscription gets the current screen with the true remaining time; no timer is duplicated or restarted; no events are replayed.
2. Two tabs or devices for one player: both receive updates, either may play, presence stays connected until both close (Task 8, Task 9).
3. Hostile input: a missing, malformed, or wrong token; a token for another player's id; a command for a game the caller is not in; a PlayerCommand with extra fields (Task 9).
4. Restart with damage: a corrupt game file, a half-written `.tmp` file, a game file of the wrong shape, a missing sessions file; the server still starts and the good games load (Task 4, Task 10).
5. A double tap sends the same command twice, or a command arrives during a robot's turn or after the race ended: the second is rejected with a plain message and nothing changes (Task 6, Task 8).
6. A game ended (by the organizer, the host page, or the stuck guard) while a timer is pending: nothing fires afterward and the game is not resurrected (Task 6, Task 8).
7. A player name containing HTML on the `/host` page is escaped (Task 10).
8. The lobby never reveals which seats are robots to anyone but the organizer (Task 2, Task 7).

---

### Task 1: Core: robot driver and broadcast

**Files:**
- Create: `packages/mille-bornes-core/src/driver.mts`, `driver.test.mts`, `broadcast.mts`, `broadcast.test.mts`.
- Modify: `simulation.mts` (use `deciders` from `driver.mts`), `simulation.test.mts`, `schemas.test.mts`, `package.json` (exports `./driver`, `./broadcast`).

**Interfaces:**
- Consumes: `Game`, `PlayerState`, `chooseCommand`, `viewFor`, `eventsFor`, `GameEvent`, `PlayerView`.
- Produces:
  ```ts
  function deciders(g: Game): ReadonlyArray<PlayerState>;   // moved from simulation.mts, now exported
  function robotMoves(g: Game, rand?: () => number): ReadonlyArray<{ by: PlayerId; cmd: PlayerCommand }>;
  //   for every robot seat in deciders(g), chooseCommand(its view, rand); seats with no decision are omitted
  interface PlayerUpdate { player: PlayerId; view: PlayerView; events: ReadonlyArray<GameEvent> }
  function broadcast(g: Game, events: ReadonlyArray<GameEvent>): Result<ReadonlyArray<PlayerUpdate>, Rejection>;
  //   one entry per seat, in turn order: viewFor(g, id) and eventsFor(id, events)
  ```

- [ ] **Step 1: Write failing tests.**
  - `deciders`: one seat on `Turn`; every target-team seat on `HazardIncoming`; the decider on `ExtensionOffer`; none on `RaceOver` and `GameOver`.
  - `robotMoves`: on a robot's turn it returns that robot's command and it is in `legalPlays`; on a human's turn it returns `[]`; in a hazard window it returns a `CoupFourre` only for robot target-team seats that hold the counter; in an `ExtensionOffer` for a robot it returns Call or Decline.
  - `broadcast`: one update per seat; each `view.me.id` equals its player; for a `CardDrawn` event only the drawer's update has a non-null `card`; `JSON.stringify` of every update other than seat X's shows X's hand (use a hand with a distinctive card via `deckFor`; only the cards X has played are public); never contains `"Robot"` before `GameOver`.
  - Carry-over minors: in `simulation.test.mts`, assert every simulated `CloseHazardWindow` emits a `HazardLanded` event (use `onStep` to compare consecutive games, or extend `playGame`'s observer); in `schemas.test.mts`, a parity test: for a batch of generated commands (valid and invalid), `playerCommandSchema.safeParse(c).success` equals `isWellFormed(c)`.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS (all core specs still pass); build core; commit** (`feat(core): robot driver and per-player broadcast`).

---

### Task 2: Core: redacted lobby views

**Files:**
- Create: `packages/mille-bornes-core/src/pendingView.mts`, `pendingView.test.mts`.
- Modify: `package.json` (export `./pendingView`).

**Interfaces:**
- Consumes: `PendingGame`, `readiness`, `teamLayout`, `describeRejection`.
- Produces:
  ```ts
  interface PendingSeatView { id: PlayerId; name: PlayerName; team: TeamIndex | null;
                              isMe: boolean; isOrganizer: boolean; kind: SeatKind | null }
  //   team is null unless the seat count has a variant; kind is null unless the viewer is the organizer
  interface PendingView { id: GameId; length: GameLength; isOrganizer: boolean;
                          seats: ReadonlyArray<PendingSeatView>;
                          start: { ok: true } | { ok: false; reason: string } }  // reason = describeRejection(...)
  function pendingViewFor(p: PendingGame, viewer: PlayerId): PendingView;
  interface PendingSummary { id: GameId; length: GameLength; organizerName: PlayerName;
                             seatNames: ReadonlyArray<PlayerName>; isFull: boolean }
  function pendingSummary(p: PendingGame): PendingSummary;      // never carries kind
  ```

- [ ] **Step 1: Write failing tests.**
  - A viewer who is not the organizer: every `kind` is `null`, and `JSON.stringify(view)` contains neither `"Robot"` nor `"Human"`.
  - The organizer sees `kind` for every seat and `isOrganizer: true` on their own seat.
  - `start`: `{ ok: true }` for 2 seats; `{ ok: false, reason }` with the "add a robot" advice for 1 or 5 seats and "remove someone" for 7 (build 7 with direct object construction).
  - `team` follows `teamLayout` for 4 seats and is `null` for 5.
  - `pendingSummary` is `isFull` at 6 seats and lists names (robots included) in seat order.
  - A viewer who holds no seat gets `isMe: false` everywhere and no throw.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; build core; commit** (`feat(core): redacted pending game views`).

---

### Task 3: Server scaffold, clock, config, logger

**Files:**
- Create: `apps/mille-bornes-game-server/` with `package.json`, `tsconfig.json`, `tsconfig.src.json`, `eslint.config.ts`, `jasmine.json` (copy the shape of `apps/sample-express-xyzzy`), `src/clock.mts`, `src/fakeClock.mts`, `src/fakeClock.test.mts`, `src/config.mts`, `src/config.test.mts`, `src/logger.mts`.
- Modify: repo `.gitignore` (`apps/mille-bornes-game-server/data/`).

**Interfaces:**
- Produces:
  ```ts
  interface Clock { now(): number; setTimeout(fn: () => void, ms: number): () => void }  // returns a cancel function
  const realClock: Clock;
  class FakeClock implements Clock { advance(ms: number): void; pendingCount(): number }
  //   advance runs due timers in time order, including timers scheduled by a running timer, then sets now
  interface Timings { hazardWindowMs: number; extensionOfferMs: number; raceOverPauseMs: number;
                      robotDelayMinMs: number; robotDelayMaxMs: number; disconnectGraceMs: number }
  const defaultTimings: Timings;
  interface ServerConfig { port: number; dataDir: string; webRoot: string | null; timings: Timings }
  function loadConfig(env: NodeJS.ProcessEnv, cwd: string): Result<ServerConfig, string>;
  //   PORT (1-65535), MB_DATA_DIR (default <cwd>/data), MB_WEB_ROOT (default null); bad PORT -> failed Result
  interface Logger { info(msg: string): void; warn(msg: string): void; error(msg: string): void }
  const consoleLogger: Logger;        // timestamped lines
  function collectingLogger(): Logger & { readonly lines: ReadonlyArray<string> };   // for tests
  ```
  Dependencies: `@repo/depot`, `@repo/depot-node`, `@repo/mille-bornes-core`, `express`, `@trpc/server`, `@trpc/client` (type import only by tests), `qrcode`, `zod`; dev: `@types/express`, `@types/qrcode`, `eventsource`, `@types/jasmine`, `jasmine`, `eslint`, `@repo/eslint-config`, `@repo/typescript-config`.
  Scripts as in the sample app (`build`, `test`, `lint`, `type-check`, `depcheck`, `start`); `bin` entry `mille-bornes-game-server` → `./dist/www.mjs`.

- [ ] **Step 1: Write failing tests.**
  - `FakeClock`: timers fire in time order; a timer scheduled at +0 inside a firing timer runs in the same `advance`; a cancelled timer never fires; `advance` past several timers fires each exactly once; `now()` equals the advanced total.
  - `loadConfig`: defaults; `PORT=abc` and `PORT=70000` fail with a plain message; `MB_DATA_DIR` is respected.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement; run `npm install` at the repo root to link the workspace. Step 4: Run, expect PASS; `npm run build -w @repo/mille-bornes-game-server` succeeds; commit** (`feat(game-server): scaffold, clock, config`).

---

### Task 4: Snapshot store

**Files:**
- Create: `src/records.mts`, `src/snapshotStore.mts`, `src/snapshotStore.test.mts`.

**Interfaces:**
- Consumes: `encodeGame`/`decodeGame`, `encodePendingGame`/`decodePendingGame` (core schemas).
- Produces:
  ```ts
  // One JSON file per game: data/games/<gameId>.json
  type GameRecord =
    | { format: 1; state: "Pending"; pending: PendingGame }
    | { format: 1; state: "Running"; organizer: PlayerId; game: Game; seq: number; left: ReadonlyArray<PlayerId> };
  interface SessionRecord { playerId: PlayerId; token: string; name: PlayerName }   // data/sessions.json = array
  interface SnapshotStore {
    saveGame(id: GameId, record: GameRecord): Promise<void>;
    deleteGame(id: GameId): Promise<void>;
    quarantineGame(id: GameId): Promise<void>;                      // move to data/failed/
    saveSessions(records: ReadonlyArray<SessionRecord>): Promise<void>;
    loadAll(): Promise<{ games: ReadonlyArray<{ id: GameId; record: GameRecord }>;
                         sessions: ReadonlyArray<SessionRecord> }>;
    flush(): Promise<void>;                                         // resolves when every queued write is on disk
  }
  class FileSnapshotStore implements SnapshotStore { constructor(dataDir: string, logger: Logger) }
  class MemorySnapshotStore implements SnapshotStore { /* in-memory, same contract, plus a `corrupt(id)` test hook not needed */ }
  function encodeRecord(r: GameRecord): unknown;  function decodeRecord(json: unknown): Result<GameRecord, string>;
  ```
  Writes: serialize to `<file>.tmp`, then `rename` over the target (atomic).
  Writes to one file are serialized in call order and coalesced (if a newer save is queued behind a running one, the older queued one is dropped), so a burst of commands writes the latest state.
  `loadAll` never throws: an unreadable, unparsable, or invalid file is logged and skipped, `*.tmp` files are ignored (and deleted), and a file whose name does not match its record's game id is skipped.
  It creates the data directories if missing.
  File name uses the `GameId` (canonical UUID), so there is no path injection; refuse any id that is not a `GameId`.

- [ ] **Step 1: Write failing tests** (temp directory per test, removed after).
  - Save then `loadAll` round-trips a pending record and a running record (deep equal, including `left` and `seq`) and sessions.
  - Overwrite replaces the file; no `.tmp` file remains after `flush`.
  - 20 `saveGame` calls without awaiting leave the last one on disk, and the number of file writes is at most 20 (coalescing never reorders: the loaded record is the 20th).
  - `deleteGame` removes the file and a later `loadAll` omits it; `quarantineGame` moves it to `failed/`.
  - **Damage (Review Focus 4):** `loadAll` skips a file containing `{`, a file containing `[]`, a record with a duplicated card, a record whose `format` is 2, and a file named for a different game id than its content; it logs one warning each and still returns the good games; a stale `x.json.tmp` is ignored and removed; an empty directory and a missing `sessions.json` give empty results; a corrupt `sessions.json` gives no sessions and a warning.
  - `MemorySnapshotStore` satisfies the same save/load/delete behaviors (run the shared cases against both).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(game-server): snapshot store`).

---

### Task 5: Sessions

**Files:**
- Create: `src/sessions.mts`, `src/sessions.test.mts`.

**Interfaces:**
- Consumes: `SnapshotStore`, `PlayerName`, `PlayerId`, `pickWhimsicalName`.
- Produces:
  ```ts
  interface Credential { playerId: PlayerId; token: string }
  class SessionRegistry {
    static load(store: SnapshotStore, rand: () => number): Promise<SessionRegistry>;   // from store.loadAll() sessions
    create(name: string | null): Promise<Result<Credential & { name: PlayerName }, string>>;
    //   null name -> a whimsical name; invalid name -> failed with the PlayerName message
    rename(id: PlayerId, name: string): Promise<Result<PlayerName, string>>;
    nameOf(id: PlayerId): PlayerName | null;
    authenticate(c: Credential): boolean;                // constant-time token compare; false for unknown ids
  }
  function parseBearer(header: string | undefined): Credential | null;   // "Bearer <uuid>.<token>"; null if malformed
  ```
  Tokens are 24 random bytes, base64url, generated by an injectable `newToken: () => string` (default `crypto.randomBytes`).
  Every change is saved through `store.saveSessions` (all records, one array).

- [ ] **Step 1: Write failing tests.**
  - `create` returns a valid `PlayerId`, a 32-character token, and the trimmed name; `create(null)` returns a name from the pool; a blank name, 101 characters, and a name with `​` fail with plain messages and create nothing.
  - `authenticate` is true for the issued credential, false for a wrong token, a token of the same length, another player's id with this token, an unknown id, and an empty token; it does not throw for non-ASCII tokens or one of a different length.
  - `rename` changes `nameOf`; an invalid name changes nothing.
  - `load` restores sessions saved by an earlier registry (use `MemorySnapshotStore`), so a restart keeps credentials.
  - `parseBearer`: accepts the exact form; rejects `undefined`, `""`, `"Bearer"`, `"Basic x.y"`, a non-UUID id, a missing dot, an overlong value (more than 200 characters), and extra whitespace-separated parts.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(game-server): player sessions`).

---

### Task 6: Table: one running game

**Files:**
- Create: `src/table.mts`, `src/table.test.mts`.

**Interfaces:**
- Consumes: `Game`, `applyPlayerCommand`, `applySystemCommand`, `robotMoves`, `deciders`, `shuffleDeck`, `variantForSeatCount`, `describeRejection`, `Clock`, `Timings`, `Logger`.
- Produces:
  ```ts
  interface TableUpdate { game: Game; seq: number; events: ReadonlyArray<GameEvent> }   // events are unredacted: the Hub redacts with broadcast()
  type TimerKind = "HazardWindow" | "ExtensionOffer" | "NextRace" | "Robot";
  interface TableOptions {
    game: Game; seq: number; clock: Clock; rand: () => number; timings: Timings; logger: Logger;
    onUpdate: (u: TableUpdate) => void;
    onStuck: (reason: string) => void;          // the stuck guard fired; the Table has disposed itself
  }
  class Table {
    constructor(opts: TableOptions);
    get game(): Game;  get seq(): number;
    timer(): { kind: Exclude<TimerKind, "Robot">; remainingMs: number } | null;   // the human-visible countdown for the current phase
    start(): void;                                    // schedules what the phase needs; call after construction and after a restore
    submit(by: PlayerId, cmd: PlayerCommand): Result<void, string>;   // message = describeRejection; accepted -> onUpdate
    dispose(): void;                                  // cancels every timer; later calls are no-ops
  }
  ```
  Scheduling is derived from `game.phase` after every accepted change and in `start()`, replacing all timers (no timer survives a change):
  - `HazardIncoming`: a timer of the full `hazardWindowMs` that applies `CloseHazardWindow`, even if no seat can answer; plus, for each robot target-team seat that has a move, a delay-0 timer that submits it.
  - `ExtensionOffer`: a timer of `extensionOfferMs` that applies `CloseExtensionOffer`; if the decider is a robot, a robot timer with a random delay in `[robotDelayMinMs, robotDelayMaxMs]` that submits its move.
  - `Turn` with a robot on turn: a robot timer with the random delay.
  - `RaceOver`: a timer of `raceOverPauseMs` that applies `StartNextRace` with a deck from `shuffleDeck(variant.deck, rand)`.
  - `GameOver`: no timers.
  A timer callback that is rejected by the engine, throws, or finds `robotMoves` empty on a robot's turn calls the stuck guard: log an error with the reason, `dispose()`, `onStuck(reason)`.
  `submit` from a human never triggers the stuck guard; it returns the failed `Result`.

- [ ] **Step 1: Write failing tests** with `FakeClock` and the `deckFor`/`buildGame` helpers (copy small test helpers rather than exporting core's `testHelpers`; or build games with `createGame` and a seeded shuffle).
  - **Hazard window:** after a hazard is played, `CloseHazardWindow` is not applied at 4,999 ms and is applied at 5,000 ms, both when nobody holds the counter and when a human on the target team does; a human target-team Coup Fourre at 1 s applies it, cancels the close timer (advancing to 10 s applies nothing more), and `timer()` reports the remaining time (`4000` at 1 s).
  - A robot target-team seat holding the counter answers at delay 0 (after `advance(0)`), and a robot not holding it does nothing.
  - **Robot turn:** the robot plays after a delay in the configured range (use a `rand` returning 0, 0.5, 0.999 and assert the fire times 1,000, 2,000, 2,999 ms); a human's turn schedules nothing.
  - **Extension offer:** a human decider times out at 30 s with `ExtensionDeclined`; answering at 10 s cancels the timeout; a robot decider answers within the delay range.
  - **Race over:** the next race deals after `raceOverPauseMs` with `raceNumber` incremented and every hand dealt; `GameOver` leaves `pendingCount() === 0`.
  - **Restore:** a `Table` constructed on a game that is mid `HazardIncoming` and started runs the full window again from zero.
  - **Double tap (Review Focus 5):** submitting the same `Drive` twice returns `ok` then a failed `Result` with a plain message, `seq` increases once, and `onUpdate` fires once; a command from a player who is not on turn, a command after `RaceOver`, and a command by an id that is not in the game all fail without changing `seq`.
  - **Dispose (Review Focus 6):** after `dispose()`, advancing a day fires nothing and `submit` fails with a plain message.
  - **Stuck guard:** an injected engine failure (wrap `applySystemCommand` through an option `apply` hook, or a game whose robot has no legal move built with direct construction) calls `onStuck` once, logs an error, and leaves no timers.
  - **Whole game:** a 4-seat all-robot game driven only by `FakeClock.advance` (small steps) reaches `GameOver` and every `TableUpdate.game` passes `checkInvariants`; repeat for 2 and 6 seats and for a seeded batch of 20 games; no stuck guard fires.
  - `seq` is `opts.seq + 1` after the first accepted change and increases by exactly 1 per update.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(game-server): table with timers and robot driver`).

---

### Task 7: Hub: screens and the lobby

**Files:**
- Create: `src/hub.mts`, `src/screens.mts`, `src/hub.test.mts`.

**Interfaces:**
- Consumes: `SessionRegistry`, `SnapshotStore`, `PendingGame`, `createPending`, `applyPendingCommand`, `pendingViewFor`, `pendingSummary`, `pickWhimsicalName`, `Clock`, `Timings`, `Logger`.
- Produces:
  ```ts
  type Outcome = { ok: true } | { ok: false; message: string };   // wire shape only; see toOutcome in Task 9
  type Screen =
    | { kind: "Lobby"; notice: string | null; games: ReadonlyArray<PendingSummary> }
    | { kind: "Waiting"; pending: PendingView }
    | { kind: "Playing"; view: PlayerView; events: ReadonlyArray<GameEvent>;
        connected: ReadonlyArray<PlayerId>;           // humans with an open subscription, plus every robot
        timer: { kind: "HazardWindow" | "ExtensionOffer" | "NextRace"; remainingMs: number } | null;
        isOrganizer: boolean;
        robots: ReadonlyArray<PlayerId> | null };     // only the organizer sees which seats are robots
  interface HubOptions { store: SnapshotStore; sessions: SessionRegistry; clock: Clock;
                         rand: () => number; timings: Timings; logger: Logger }
  class Hub {
    static open(opts: HubOptions): Promise<Hub>;      // loads pending games now; running games are Task 8
    screenFor(player: PlayerId): Screen;              // Lobby for a player in no game
    watch(player: PlayerId, signal: AbortSignal): AsyncIterable<Screen>;
    createGame(player: PlayerId): Promise<Result<void, string>>;
    join(player: PlayerId, gameId: GameId): Promise<Result<void, string>>;
    leavePending(player: PlayerId): Promise<Result<void, string>>;
    cancelPending(player: PlayerId): Promise<Result<void, string>>;       // organizer only
    addRobot(player: PlayerId): Promise<Result<void, string>>;
    removeSeat(player: PlayerId, seat: PlayerId): Promise<Result<void, string>>;
    swapSeats(player: PlayerId, a: PlayerId, b: PlayerId): Promise<Result<void, string>>;
    setLength(player: PlayerId, length: GameLength): Promise<Result<void, string>>;
    flush(): Promise<void>;
    dispose(): void;
  }
  ```
  Every mutation applies synchronously, then returns a promise that resolves after the affected game's snapshot is written (`store.saveGame`).
  `watch` registers its listener before computing the first screen (so no change is missed), yields the current screen first, then every later screen for that player in order, and stops when `signal` aborts (no thrown `AbortError`).
  Use one `EventEmitter` with `events.on(emitter, playerId, { signal })`.
  Mutations by a player who has no session (`nameOf` is null) fail with a plain message.
  The `Lobby` lists pending games oldest first.
  A `notice` is shown once on the player's next `Lobby` screen (in memory only) after they are removed or the game is cancelled.

- [ ] **Step 1: Write failing tests** (`MemorySnapshotStore`, `FakeClock`, seeded `rand`).
  - Lobby: a new player sees an empty `Lobby`; after `createGame` the organizer sees `Waiting` (organizer name first seat) and another player sees the game in `Lobby.games` with `seatNames` and no kind information (`JSON.stringify` has no `"Robot"`, **Review Focus 8**).
  - `join` seats the player and both `Waiting` screens update; joining an unknown id, a game that is full (6 seats), or while already in a game fails with a plain message; a duplicate name differing by case or whitespace fails with the `NameTaken` text.
  - `addRobot` by the organizer adds a whimsical robot name not already taken; by a non-organizer fails; a seventh seat fails; the organizer's `Waiting` view shows `kind: "Robot"` and a joiner's shows `null`.
  - `removeSeat` by the organizer returns the removed player to `Lobby` with a notice, shown once; `leavePending` returns the leaver to `Lobby`; the organizer cannot leave but can `cancelPending`, which returns everyone to `Lobby` with a notice and removes the snapshot.
  - `swapSeats` and `setLength` are organizer-only and reflected in every `Waiting` screen.
  - `watch`: first item is the current screen; a later change yields the next screen; two watchers of one player both receive it; aborting stops the iteration without throwing and leaves no listener (`emitter.listenerCount === 0`); a change between `watch()` being called and the first `next()` is not lost.
  - Persistence: after each mutation `flush()` the store holds the pending record; `Hub.open` on a store with two pending records restores both and the organizers' screens are `Waiting`.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(game-server): hub with lobby and screens`).

---

### Task 8: Hub: running games, presence, restore

**Files:**
- Modify: `src/hub.mts`, `src/hub.test.mts`.

**Interfaces:**
- Consumes: Task 6 `Table`, core `beginGame`, `broadcast`, `shuffleDeck`, `variantForSeatCount`.
- Produces (added to `Hub`):
  ```ts
  startGame(player: PlayerId): Promise<Result<void, string>>;          // organizer; beginGame with a shuffled deck for the seat count
  play(player: PlayerId, cmd: PlayerCommand): Promise<Result<void, string>>;
  endGame(player: PlayerId): Promise<Result<void, string>>;            // organizer, at any time; everyone returns to Lobby with a notice
  leaveFinished(player: PlayerId): Promise<Result<void, string>>;      // after GameOver only
  adminEnd(gameId: GameId): Promise<Result<void, string>>;             // the host page
  adminList(): ReadonlyArray<{ id: GameId; state: "Pending" | "Running" | "Finished"; organizerName: PlayerName;
                               seatNames: ReadonlyArray<PlayerName>; phase: string }>;
  ```
  Behavior:
  - Starting a pending game creates a `Table` (`start()` called), saves a `Running` record (organizer, game, `seq`, `left: []`), and every seat's screen becomes `Playing`.
  - Each `TableUpdate` is saved (`store.saveGame`), passed to core's `broadcast()`, and emitted as one `Screen` per human player with that player's redacted `events` (only `broadcast` output is ever sent).
  - Presence: a player is connected while at least one `watch` for them is open; a disconnect takes effect after `disconnectGraceMs` (a reconnect inside the grace period never shows as disconnected); a change re-emits `Playing` to the others in that game; robots are always in `connected`.
  - `robots` is the organizer's list of robot seats; everyone else gets `null`.
  - The `timer` field comes from `Table.timer()`, computed when the screen is built, so a reconnecting phone sees the true remaining time (**Review Focus 1**).
  - The stuck guard (`onStuck`): the game is removed, `store.quarantineGame`, and every human returns to `Lobby` with a notice ("Something went wrong with the game, so it was ended.").
  - `endGame`, `adminEnd`, and the stuck guard dispose the `Table` first (**Review Focus 6**).
  - `leaveFinished` records the player in `left`; when every human seat has left, the game is deleted from memory and the store.
  - `Hub.open` restores `Running` records into `Table`s (each `start()`ed: a window or offer restarts in full, robots resume) and restores `left` and `organizer`; a restored game whose phase is `GameOver` waits for players to leave.

- [ ] **Step 1: Write failing tests.**
  - `startGame`: non-organizer fails; with 1 seat fails with the "add a robot" message; with 2 seats every player's screen becomes `Playing` with their own hand of 6 or 7 cards and `view.me.id` correct; the snapshot on disk is a `Running` record.
  - No leakage: for each player, `JSON.stringify(screen)` contains no other player's hand-only cards (use a seeded game and compare with `Game.players[i].hand`), no draw pile contents, and `robots` is `null` unless the player is the organizer.
  - `play`: a legal play yields one `Playing` update to every player with redacted events (`CardDrawn.card` null for non-drawers); an illegal play returns `{ ok: false, message }` with plain text and changes nothing; a player not in a game fails; a non-participant cannot play into someone else's game.
  - Timers through the Hub: with a human on each side, advancing `FakeClock` by 5,000 ms after a hazard closes the window and emits `HazardLanded`; a screen built at 1,000 ms into the window has `timer.remainingMs === 4000` (**Review Focus 1**) and a later reconnect (`watch`) does not restart or duplicate timers (`FakeClock.pendingCount()` is unchanged).
  - A game with a robot on turn plays by itself after the delay and the human screens update; an all-robot-plus-one-human game reaches `GameOver` with the human playing via `chooseCommand` in the test loop.
  - Presence: opening a watch marks the player connected for others; closing it marks them disconnected only after 3,000 ms; closing then reopening within 2,000 ms never emits a disconnected screen; two watches for one player stay connected until both close (**Review Focus 2**); robots always connected.
  - `endGame` by the organizer returns everyone to `Lobby` with the notice, the Table's timers are gone (`pendingCount() === 0`), the record is deleted, and a later `play` fails; by a non-organizer fails; `adminEnd` does the same; ending while a hazard window timer is pending never resurrects the game after advancing the clock.
  - `leaveFinished` before `GameOver` fails; after it returns the player to `Lobby`; when the last human leaves the record is deleted; the reveal data is in the `Playing` screen's `view.phase` for `GameOver` (`reveal` lists every seat's kind).
  - Stuck guard: with an injected faulty `Table` factory option (`HubOptions.tableFactory?`) or a robot built to have no move, the game is quarantined, humans see `Lobby` with the notice, and the Hub keeps serving other games.
  - Restore: play some moves, `flush()`, build a new `Hub.open` on the same store, and the humans' `Playing` screens equal the pre-restart ones (same view and `seq` carried through); a game restored mid hazard window closes the window after the full 5,000 ms; a restored `GameOver` game waits for `leaveFinished`; a `Running` record that fails `decodeGame` is skipped by the store (Task 4) and other games load.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement (keep `hub.mts` readable: extract `presence.mts` if it passes about 400 lines). Step 4: Run, expect PASS; commit** (`feat(game-server): running games, presence, restore`).

---

### Task 9: tRPC router, context, and authentication

**Files:**
- Create: `src/router.mts`, `src/context.mts`, `src/router.test.mts`.

**Interfaces:**
- Consumes: `Hub`, `SessionRegistry`, `parseBearer`, core `playerCommandSchema`, `gameLengthSchema`, `GameId.tryCreate`, `PlayerId.tryCreate`.
- Produces:
  ```ts
  interface Context { hub: Hub; sessions: SessionRegistry; player: PlayerId | null }   // player is set only by a valid credential
  function createContextFromHeader(deps: { hub: Hub; sessions: SessionRegistry }, authorization: string | undefined): Context;
  function toOutcome(r: Result<void, string>): Outcome;   // the only place a Result becomes wire data
  const t = initTRPC.context<Context>().create({ sse: { ping: { enabled: true, intervalMs: 2000 },
                                                         client: { reconnectAfterInactivityMs: 6000 } } });
  const appRouter: Router;  type AppRouter = typeof appRouter;     // the client imports this type only
  ```
  Procedures (every one except `session.create` requires `ctx.player`, else `TRPCError` `UNAUTHORIZED` with the message "Your session is not valid. Please enter your name again."):
  ```
  session.create({ name: string | null })        mutation -> { playerId, token, name } | { ok: false; message }   (public)
  session.rename({ name })                       mutation -> Outcome
  session.me()                                   query    -> { playerId, name }          (UNAUTHORIZED if the credential is bad)
  lobby.createGame()   lobby.join({ gameId })    mutations -> Outcome
  pending.leave()  pending.cancel()  pending.addRobot()  pending.removeSeat({ seat })
  pending.swapSeats({ a, b })  pending.setLength({ length })  pending.start()          mutations -> Outcome
  game.play(PlayerCommand)  game.end()  game.leave()                                   mutations -> Outcome
  watch()                                        subscription -> Screen  (yields hub.watch(ctx.player, signal))
  ```
  Inputs are Zod schemas: ids parse with `tryCreate` through depot's `unwrapOrAddIssue` (a failure becomes `BAD_REQUEST`), `PlayerCommand` uses core's strict `playerCommandSchema`, names are `z.string().max(200)`, and the router sets `maxBodySize` through the Express adapter (Task 10).
  For `watch`, a credential comes from the connection parameter `authorization` (the adapter passes `opts.info.connectionParams` to the context factory; extend `createContextFromHeader` or add `createContext` that accepts either source).

- [ ] **Step 1: Write failing tests** with `createCallerFactory` and a `Hub` over `MemorySnapshotStore` and `FakeClock`.
  - `session.create` returns a credential that `createContextFromHeader` accepts; `session.create({ name: null })` returns a whimsical name; a blank name returns `{ ok: false, message }`.
  - **Hostile (Review Focus 3):** every procedure but `session.create` throws `UNAUTHORIZED` for a missing header, `Bearer`, a wrong token, a valid token with another player's id, a malformed id, and a 10,000-character header; the error text contains no token.
  - Inputs: `lobby.join({ gameId: "nope" })`, `pending.swapSeats` with a non-UUID, `game.play` with `{ type: "Drive", card: "Roll" }`, an extra field, a missing `type`, and `null` each fail with `BAD_REQUEST` and change nothing.
  - A caller who is not in a game: `game.play`, `game.end`, `game.leave`, `pending.start` return `{ ok: false, message }` (not a thrown error); a player cannot play into a game they are not in even when they know its id (there is no game id input to `play`).
  - Flow through the router: Ann creates, Bob joins, Ann adds a robot (3 seats), starts; Bob's `watch` first item is `Playing`; `game.play` with Bob's legal command from `legalPlays` returns `{ ok: true }` and Ann's watcher receives the update (consume the async iterable from the caller; if a caller does not return an iterable for subscriptions, test `hub.watch` plus the procedure's generator body through the raw procedure call instead, and say so in the report).
  - Aborting the subscription's signal ends the iteration and decrements presence.
  - `Outcome` failures carry `describeRejection` text, not JSON: a play on someone else's turn returns "It is not your turn." (use the message core produces).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(game-server): tRPC router and credentials`).

---

### Task 10: Express app, host page, startup

**Files:**
- Create: `src/app.mts`, `src/hostPage.mts`, `src/network.mts`, `src/www.mts`, `src/app.test.mts`, `src/hostPage.test.mts`, `src/network.test.mts`.

**Interfaces:**
- Consumes: `Hub`, router, config, `getExternalIpv4Addresses` (depot-node), `qrcode`.
- Produces:
  ```ts
  function createApp(deps: { hub: Hub; sessions: SessionRegistry; config: ServerConfig; logger: Logger;
                             addresses: () => ReadonlyArray<string>; port: number }): express.Express;
  //   /trpc  -> createExpressMiddleware (maxBodySize 16 KB, createContext reads Authorization or connectionParams.authorization)
  //   /host (GET) and /host/end/:gameId (POST) -> loopback only (403 with a plain message otherwise)
  //   everything else -> static files from config.webRoot, falling back to index.html; a one-line placeholder page when webRoot is null
  function isPrivateIpv4(addr: string): boolean;                     // 10/8, 172.16/12, 192.168/16 only
  function lanUrls(addresses: Map<string, string>, port: number): ReadonlyArray<string>;   // http://<ip>:<port>/ for private addresses only
  function renderHostPage(info: { urls: ReadonlyArray<string>; qrSvg: ReadonlyArray<string>;
                                  games: ReturnType<Hub["adminList"]> }): string;           // HTML, all user text escaped
  ```
  `www.mts` (the only file that reads `process`, the real clock, and the real file system):
  loads config; opens `FileSnapshotStore`, `SessionRegistry`, `Hub`; creates the app and `http` server; prints each URL and a terminal QR for the first one (`qrcode` `toString(url, { type: "terminal", small: true })`); listens on all interfaces; on `EADDRINUSE` prints a plain message and exits 1;
  logs (and does not exit on) `uncaughtException` and `unhandledRejection`;
  on `SIGINT`/`SIGTERM` disposes the Hub, awaits `flush()`, closes the server, and exits 0.
  No request logger may print the query string of `/trpc` requests (subscription URLs carry the credential).

- [ ] **Step 1: Write failing tests** (start the app on an ephemeral port with `app.listen(0)`; use Node's global `fetch`).
  - `isPrivateIpv4`: true for `192.168.1.5`, `10.0.0.2`, `172.16.0.1`, `172.31.255.1`; false for `172.32.0.1`, `169.254.1.1`, `8.8.8.8`, `127.0.0.1`, garbage.
  - `lanUrls` keeps only private addresses and formats the port.
  - `/host` from loopback returns 200 HTML containing every URL and an inline `<svg`; a request whose socket address is non-loopback (test through the exported handler with a fake `req`) gets 403; `POST /host/end/<id>` from loopback ends that game (`Hub.adminEnd`), and returns to `/host`; a non-loopback request is 403 and ends nothing.
  - **Escaping (Review Focus 7):** a player named `<script>alert(1)</script>` appears as `&lt;script&gt;...` in the host page and never as a raw tag; same for a `"` in an attribute context.
  - `/trpc/session.me` without credentials is 401; `/trpc/session.create` over HTTP returns a credential; a body over 16 KB is rejected.
  - Static: with a temp `webRoot` containing `index.html` and `a.js`, `/a.js` and `/` are served and an unknown path falls back to `index.html`; `..` path traversal (`/..%2f..%2fpackage.json`) never leaves the root; with `webRoot: null` `/` returns the placeholder.
  - A thrown error inside a route returns 500 JSON without a stack trace and the server keeps serving.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement (`www.mts` is covered by Task 11, not unit tests). Step 4: Run, expect PASS; commit** (`feat(game-server): express app, host page, startup`).

---

### Task 11: Scripted client, end-to-end tests, final gate

**Files:**
- Create: `src/scriptedPlayer.mts`, `src/endToEnd.test.mts`, `README.md` (the app: how to run, the API in one table, env vars, the data directory, the failed-game directory).

**Interfaces:**
- Consumes: the full server over real HTTP and SSE.
- Produces:
  ```ts
  // A "text client": the same calls a phone makes, with decisions from core's chooseCommand.
  function createScriptedPlayer(baseUrl: string, name: string | null, rand?: () => number): Promise<ScriptedPlayer>;
  interface ScriptedPlayer {
    readonly playerId: PlayerId;  readonly name: PlayerName;
    readonly screens: ReadonlyArray<Screen>;          // everything received, in order
    createGame(): Promise<Outcome>;  join(gameId: GameId): Promise<Outcome>;  addRobot(): Promise<Outcome>;  start(): Promise<Outcome>;
    waitFor(pred: (s: Screen) => boolean, timeoutMs?: number): Promise<Screen>;     // rejects with the last screen in the message on timeout
    autoPlay(): void;                                  // on every Playing screen where this player may act, send chooseCommand(view)
    close(): void;
  }
  ```
  It uses `createTRPCClient<AppRouter>` with `splitLink` (`httpBatchLink` with an `Authorization` header; `httpSubscriptionLink` with `connectionParams: { authorization }` and the `eventsource` package as the `EventSource` ponyfill).
  Verify the exact option names against the installed `@trpc/client` types.

- [ ] **Step 1: Write the end-to-end tests** (a real server on an ephemeral port with a temp data dir and tiny timings: hazard window 40 ms, offer 80 ms, pause 40 ms, robot delay 1 to 5 ms, grace 50 ms; real clock).
  - **Whole games over HTTP:** for 2, 3, 4, and 6 seats mixing scripted humans and robots, the organizer creates, others join, robots are added, start; every scripted human `autoPlay()`s; every human reaches a `GameOver` screen whose `view.phase.reveal` names every seat; every screen received by any player passes a no-leak scan (no other player's hand-only card, `robots` is `null` for non-organizers, no `"Robot"` in any lobby screen); then each human calls `game.leave` and `/host` shows no games.
  - **Restart:** with two games in progress (one pending, one running), stop the server (the `SIGTERM` path: dispose, `flush`, close), start a new server on the same data dir and a new port, the same credentials return the same screens (`session.me` works; `watch` first item is `Waiting` or `Playing` for the right game), and the running game reaches `GameOver`.
  - **Reconnect:** close and reopen one human's subscription mid-game; the first item of the new stream is the current `Playing` screen, play continues, and no duplicate or replayed events are delivered.
  - **Damage:** write a corrupt `.json` and a stale `.tmp` into the data dir before start; the server starts, logs warnings, and a fresh game plays normally.
  - **Organizer ends the game** mid-race: every human receives `Lobby` with a notice and later `watch` items never show `Playing` for that game.
  - **No crash on garbage:** send malformed JSON, a wrong content type, a 1 MB body, and 50 concurrent `session.create` calls to `/trpc`; the server answers each and then completes a normal game.
  - **Soak:** play 30 seeded 4-seat games (1 scripted human, 3 robots) back to back in one server with the tiny timings; every one reaches `GameOver`, no stuck guard fires (the logger has no `error` lines), and the process memory delta stays small (assert only that `hub.adminList()` is empty at the end, i.e. nothing leaked).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement the scripted player and fix any real bug the tests reveal in the module that owns it, adding a pinning example test there. Step 4: Run, expect PASS.**
- [ ] **Step 5: Start the real server by hand** (`npm run build` then `npm start -w @repo/mille-bornes-game-server`), confirm it prints the URLs and a QR code and `http://localhost:3000/host` shows the page; stop it.
- [ ] **Step 6: Run the final gate from the repo root: `npm run all && npm run type-check`, expect success; commit** (`feat(game-server): scripted client, end-to-end tests, readme`).

---

## Self-review notes

- Spec coverage: lobby with pending games and organizer (Tasks 2, 7); robots and robot disguise (Tasks 2, 7, 8); Coup Fourre window always full length, server-owned timer, robots at delay 0, restart restarts it (Task 6, 8); Extension offer timer (Task 6); snapshots with atomic writes, corrupt files skipped (Task 4, 8, 11); credentials never in views (Tasks 5, 9); presence (Task 8); end game by the organizer (Task 8); `/host` with QR, LAN addresses, End game (Task 10); terminal QR (Task 10); tRPC with SSE subscriptions (Task 9); tests with injected clock and in-process caller (Tasks 6 to 9) plus a scripted client over real HTTP (Task 11).
- The carry-over must-haves are covered: `pendingViewFor` (Task 2), the shared decider helper (Task 1), `broadcast` (Tasks 1, 8), phase-derived timers (Task 6), presence (Task 8), two cheap minors (Task 1).
- Deliberately skipped, so the owner knows: event replay on reconnect, a command log, a "deal now" button, Zod schemas for views and events (the client gets types from the router), per-origin CSRF checks on `/host`, accent-insensitive name comparison, and persistence of the one-time lobby notice.
