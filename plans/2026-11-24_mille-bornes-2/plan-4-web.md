# Mille Bornes Web Client (Milestone 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/mille-bornes-web`, a phone-first React app that lets family members enter a name, find and join games, play a whole game against the game server, see a score sheet after each race, and enjoy card animations and funny sounds.
The game server serves the built app on its one port.

**Architecture:** The server pushes one `Screen` per player over a tRPC subscription (`watch`).
A framework-free `ScreenStore` holds the latest screen, the connection status, and a queue of the events that produced each update;
React components render the screen and send commands through the tRPC client.
Animations and sounds are driven from the event queue, never by comparing states.
The rules are not re-implemented: the client imports `legalPlays`, `checkCommand`, and `describeRejection` from `@repo/mille-bornes-core`.

**Tech Stack:** TypeScript 6, React 18.3 (the version `apps/difftui` already uses), Vite, Vitest with Testing Library and jsdom, `@trpc/client` ^11.31.3 (match the server's `@trpc/server`), Zod, `@repo/mille-bornes-core`, `@repo/depot` (`Option`, `Result`, `discriminatedResultSchema`), Playwright (end-to-end only).

**Spec:** `plans/2026-11-24_mille-bornes-2/design.md` (section "Web client" and "Testing").
Approved visual references (copy of the brainstorm mockups): `plans/2026-11-24_mille-bornes-2/mockups/game-table-layout.html` (the owner chose layout B, "scoreboard rows") and `mockups/lobby-flow.html` (lobby, organizer waiting room, joiner waiting room; the "move" links are replaced by the swap-seats control, and the team layout follows `rules.md`).
Server contract and notes: `plans/2026-11-24_mille-bornes-2/milestone-3-carryover.md` and `apps/mille-bornes-game-server/README.md`.
This plan covers milestone 3 only.

## Global Constraints

- Follow `AGENTS.md` and `.editorconfig` (two blank lines after imports and between members, JSDoc with `@param`/`@returns` on exported items, comments wrapped at 80 columns, lines under 100 columns, camelCase file names except React components which are PascalCase `.tsx`, PascalCase types, `T`-prefixed type parameters, Zod enums, tests named `baseName.test.mts(x)` with one `describe` per module and one nested `describe` per function or component behavior, two blank lines between adjacent lifecycle blocks).
- **`Option` and `Result` always, `null` only on the wire.**
  Convert a received `Screen` at the store boundary (`Option.fromNullable`), keep `Option`/`Result` in all client code and props, and convert back with `toNullable` only when something external needs `null` (for example a tRPC input).
  Never write `if (opt)` for an `Option` (it is always truthy).
  Decode every mutation response with `discriminatedResultSchema` from `@repo/depot/schemaUtility`.
- The client imports from the server **only types** (`import type { AppRouter } ...`, `Screen`): never server runtime code.
  The server's package exports `./router` and `./screens`; if type-checking the web app drags Node-only types in, point those exports' `types` at the built `dist/*.d.mts` or add `@types/node` to the web app's type-check only, and say which in the report.
- Browser support: Baseline widely available features without fallbacks; newer features (for example View Transitions) only behind feature detection with a graceful fallback.
- Phone-first: portrait layout that works down to 320 CSS pixels wide, controls at least 44 by 44 CSS pixels on touch screens (`@media (pointer: coarse)`), nothing hover-only, `viewport-fit=cover` with safe-area padding, long names truncate with an ellipsis, text and controls never clip.
- Accessibility: semantic buttons and headings, an `aria-live="polite"` region for the top bar message, native `<dialog>` for confirmations, color is never the only signal (chips carry text), contrast at least WCAG AA.
- Motion: only `transform` and `opacity`, respect `prefers-reduced-motion` (no card flights under reduce, but state changes still show), nothing flashes more than three times a second, and every animation ends in its final state.
- No hard-coded host names or ports: the client uses relative URLs (`/trpc`).
- The credential (`playerId` and `token`) is kept in `localStorage` under one key and sent as `Authorization: Bearer <playerId>.<token>` for HTTP calls and as the connection parameter `authorization` for the subscription (the native `EventSource` cannot set headers).
  The token is never rendered, logged, or put in an error message.
- Sound and vibration are enhancements: they must never throw, and the game is fully playable with both unavailable (iOS has no Vibration API; audio starts only after a user gesture).
- Commit messages have no trailer lines of any kind and no model names.
- Run one test file with: `npm test -w @repo/mille-bornes-web -- src/<path>/<name>.test.mts`.
  The core and server packages are consumed through `dist`: rebuild with `npm run build -w <package>` after changing them.
- Final gate (Task 12): `npm run all && npm run type-check` from the repo root passes, and `npm run e2e -w @repo/mille-bornes-web` passes (the end-to-end run needs Playwright browsers and is not part of `npm run all`).

## Calls made by the author

These are not in the design; the owner can veto any of them.

- **Cards are drawn with CSS and emoji, no image assets**, as in the mockups (a distance card shows its miles; hazards, remedies and safeties show an emoji and a short label).
  A `cardFace()` function is the one place that maps a card to its face, so illustrated art can replace it later.
- **Sounds are synthesized with the Web Audio API**, no audio files and no licensing questions.
  A "sound pack" module maps named sounds to small synth recipes, so recorded clips can replace any recipe later.
  The owner should listen to the result and say which ones are not funny enough.
- **React 18.3, Vitest, jsdom**: React 18.3 matches the version already in the monorepo; Vitest is what the design chose for the web app.
- **Vite dev server proxies `/trpc` to the game server** (`http://localhost:3000`) so `npm run dev` works with hot reload.
  For real use, the game server serves the built `dist` (Task 12 makes the server find it by default).
- **A play is two taps** (tap a card, then tap a target lane or the discard pile), with a **long press** on any card explaining it in one sentence.
  Cards that cannot be played are dimmed; tapping one shows the plain-English reason from `checkCommand`.
- **The race-over scoreboard shows the server's 20 s countdown** (`timer.kind === "NextRace"`) and the whole score sheet, one column per team, one row per line of the rulebook sheet.
- **Disconnect indicator only on the organizer's screen** (the server sends `connected` only to the organizer).
- **Keeping phones awake is deferred** (owner's decision); the stream reconnects and shows the current state if a phone locks.

## Review Focus

Failure modes the design implies; each has a test in the owning task.

1. A phone locks mid hazard window and wakes up: the reconnect snaps to the current state with no replayed animations or sounds, the countdown starts from the new `remainingMs`, and the "reconnecting" banner clears (Task 3, Task 8).
2. Double tap: a double tap on a card or target sends one command; if the phase changed under a half-finished selection (window closed, turn passed), the selection clears and a plain message appears; a command refused by the server shows its message and leaves the UI usable (Task 8).
3. The server stops or restarts mid-game: the app shows a clear "Lost connection, trying again" state, recovers on its own, and `UNAUTHORIZED` (a credential the server no longer knows) sends the player back to name entry with the credential cleared (Task 2, Task 3).
4. Hostile or odd names: HTML in a name renders as text, a 20-character name and a name with emoji fit a 320 px wide row, and 6 seats fit on a screen without breaking the layout (Tasks 5 to 7).
5. Sound and vibration unavailable: no `AudioContext`, a suspended context, or no `navigator.vibrate` never throws and never blocks play; the mute choice persists (Task 11).
6. The organizer ends the game or leaves while others are watching: everyone returns to the lobby with the notice (Task 5, Task 6, Task 9).
7. Hidden information: nothing the client renders or logs reveals another player's hand, which seats are robots (outside the organizer's screen), or the token (Tasks 5 to 9).

---

### Task 1: Scaffold the web app

**Files:**
- Create: `apps/mille-bornes-web/` with `package.json`, `tsconfig.json`, `tsconfig.src.json` if the build needs it, `eslint.config.ts` (copy the shape from `apps/difftui`, including `getReactConfig()`), `vite.config.mts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/App.test.tsx`, `src/testSetup.mts`.
- Modify: repo `.gitignore` if needed (Vite `dist`, Playwright output); root workspaces already include `apps/*`.

**Interfaces:**
- Produces: package `@repo/mille-bornes-web` with scripts `dev` (Vite with the `/trpc` proxy to `http://localhost:3000`, `ws: false`, SSE-safe), `build` (`tsc --noEmit` type-check then `vite build`, output `dist`), `test` (`vitest run`), `lint`, `type-check`, `depcheck`, `e2e` (added in Task 12; a placeholder that prints a message until then).
  A renderable `App` component that shows the title and the text "Loading" for now.
  `index.html` has `lang="en"`, a viewport meta with `viewport-fit=cover`, a title, and a `theme-color`.
- Dependencies: `react`, `react-dom` ^18.3.1, `@trpc/client` ^11.31.3, `zod`, `@repo/mille-bornes-core`, `@repo/depot`; dev: `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`, `@repo/mille-bornes-game-server` (types only), `@repo/eslint-config`, `@repo/typescript-config`, `eslint`.
  Add only what the code imports at each task so `npm run depcheck` stays green (it must pass at the end of every task).

- [ ] **Step 1: Write the failing test.** `App.test.tsx` renders `<App />` and finds a heading with the game's title (jest-dom matchers wired in `testSetup.mts`).
- [ ] **Step 2: Run, expect FAIL. Step 3: Scaffold** (run `npm install` at the repo root; `npm install -w` may fail with an arborist error: edit `package.json` by hand and install at the root).
  Confirm `npm run build`, `test`, `lint`, `type-check` and `depcheck` all pass for the new package, and that `import type { AppRouter } from "@repo/mille-bornes-game-server/router"` type-checks in a scratch file (resolve the Node-types question described in Global Constraints, and remove the scratch file).
- [ ] **Step 4: Run, expect PASS; commit** (`feat(web): scaffold the web app`).

---

### Task 2: API layer (client, credential, results)

**Files:**
- Create: `src/api/credential.mts`, `src/api/credential.test.mts`, `src/api/client.mts`, `src/api/client.test.mts`, `src/api/outcomes.mts`, `src/api/outcomes.test.mts`.

**Interfaces:**
- Consumes: `AppRouter` (type), `discriminatedResultSchema`, `Option`, `Result`.
- Produces:
  ```ts
  interface Credential { playerId: string; token: string }
  interface CredentialStore { load(): Option<Credential>; save(c: Credential): void; clear(): void }
  function createCredentialStore(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): CredentialStore;
  //   one key, JSON; a corrupt or wrongly shaped value loads as none (and is cleared); storage that throws behaves as empty
  function authorizationHeader(c: Credential): string;             // "Bearer <playerId>.<token>"
  function createApi(deps: { credentials: CredentialStore; baseUrl?: string; onUnauthorized: () => void }): Api;
  interface Api {
    readonly trpc: ReturnType<typeof createTRPCClient<AppRouter>>;
    call<TOut>(fn: (t: Api["trpc"]) => Promise<unknown>, valueSchema: z.ZodType<TOut>): Promise<Result<TOut, string>>;
    //   decodes the wire ResultWire; a network failure or a malformed answer becomes a failed Result with a plain message ("We could not reach the game. Check the Wi-Fi."); UNAUTHORIZED calls onUnauthorized once and fails with "Please enter your name again."
  }
  const voidWire: z.ZodType<void>;                                  // value schema for mutations that return nothing
  ```
  `createApi` builds `createTRPCClient<AppRouter>` with `splitLink`: `httpBatchLink` (`url: "/trpc"` by default, header `authorization` from the stored credential when present) for queries and mutations, and `httpSubscriptionLink` (same url, `connectionParams: () => ({ authorization })` when a credential exists) for subscriptions.
  Verify the exact link and option names against the installed `@trpc/client` types.

- [ ] **Step 1: Write failing tests.**
  - Credential store: saves and loads a credential; `clear` removes it; `""`, `"{"`, `"[]"`, a JSON object missing `token`, and a non-string `playerId` all load as none and clear the key; a storage whose methods throw never throws out of the store.
  - `authorizationHeader` has exactly the form `Bearer <playerId>.<token>`.
  - `call`: with an injected fake link/transport (or a stubbed `fetch`), a `{succeeded: true}` wire decodes to a successful `Result`; `{succeeded: false, error: "It is not your turn."}` decodes to a failed `Result` with that message; a rejected fetch gives the plain network message and never contains the token; a tRPC `UNAUTHORIZED` calls `onUnauthorized` exactly once and fails with the "enter your name again" message; a malformed body fails with a plain message.
  - No log line, thrown error, or returned message contains the token (assert across the cases above with a recognizable token string).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): API client, credential store, result decoding`).

---

### Task 3: Screen store (subscription, connection status, event queue)

**Files:**
- Create: `src/state/screenStore.mts`, `src/state/screenStore.test.mts`, `src/state/useScreen.ts`, `src/state/useScreen.test.tsx`.

**Interfaces:**
- Consumes: `Api`, the server's `Screen` type.
- Produces:
  ```ts
  type ConnectionStatus = "Connecting" | "Live" | "Reconnecting";
  interface Snapshot {
    screen: Option<Screen>;                 // none until the first message
    status: ConnectionStatus;
    sequence: number;                       // increases with every received screen
    pendingEvents: ReadonlyArray<{ id: number; events: ReadonlyArray<GameEvent> }>;   // not yet consumed by the animator
  }
  interface ScreenStore {
    getSnapshot(): Snapshot;
    subscribe(listener: () => void): () => void;      // for useSyncExternalStore
    start(): void;                                    // opens the subscription (idempotent)
    stop(): void;                                     // closes it; later messages are ignored
    consumeEvents(id: number): void;                  // the animator marks a batch as played
  }
  function createScreenStore(deps: { api: Api; onUnauthorized: () => void }): ScreenStore;
  function useScreen(store: ScreenStore): Snapshot;   // React hook over useSyncExternalStore
  ```
  Behavior:
  - The first screen after a (re)connect is a snapshot: its `events` are NOT queued (so a reconnect never replays animations or sounds), and neither is the first screen ever received.
  - Every later `Playing` screen with a non-empty `events` list queues one batch, in order, with a unique `id`.
  - A message with `events: []` (a presence or countdown refresh) updates the screen and queues nothing.
  - `status` is `Connecting` before the first message, `Live` after it, `Reconnecting` when the transport reports an error or a dropped connection (use tRPC's subscription callbacks, for example `onConnectionStateChange`, `onError`, `onStarted`; verify the names against the installed types), and back to `Live` on the next message.
  - A subscription error that is `UNAUTHORIZED` calls `onUnauthorized` and stops.
  - The store copies nothing it should not: the screen it holds is exactly what the server sent, converted only at the `Option` boundary.

- [ ] **Step 1: Write failing tests** with a fake `Api` whose `trpc.watch.subscribe` the test drives by hand.
  - First message becomes `Live` with the screen and no queued events; a second message with events queues one batch; a third with `events: []` queues nothing; batches keep their order and `consumeEvents` removes only the named one.
  - **Review Focus 1:** a transport error sets `Reconnecting`; the next message sets `Live`, is treated as a snapshot (its events are not queued even if non-empty), and `sequence` still increases.
  - `UNAUTHORIZED` calls `onUnauthorized` once and stops further updates; `stop()` ignores later messages and unsubscribes; `start()` twice opens one subscription.
  - `subscribe` listeners are notified once per change and not after unsubscribing; `useScreen` re-renders a test component when a message arrives (Testing Library).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): screen store`).

---

### Task 4: Words: events, phases, cards (pure text and faces)

**Files:**
- Create: `src/text/describeEvent.mts`, `describeEvent.test.mts`, `src/text/phaseHint.mts`, `phaseHint.test.mts`, `src/text/cardFace.mts`, `cardFace.test.mts`.

**Interfaces:**
- Consumes: core `Card`, `GameEvent`, `PlayerView`, `RaceResult`, `describeRejection`.
- Produces:
  ```ts
  interface CardFace { emoji: string; label: string; kind: "Distance" | "Hazard" | "Remedy" | "Safety"; blurb: string }  // blurb: one plain sentence for the long-press help
  function cardFace(card: Card): CardFace;                      // total over every Card
  function describeEvent(e: GameEvent, view: PlayerView): string;   // "Ann played Flat Tire on Team 2." ; names come from view.seats
  function topBarMessage(view: PlayerView): { text: string; tone: "MyTurn" | "Waiting" | "Alert" | "Info" };
  //   "Your turn: play or discard a card" (MyTurn); "Waiting for Bob to play" (Waiting); during a hazard window for the target team: "Flat Tire! You have 5 seconds. If anyone on your team holds Puncture Proof, play it now." (Alert); for others in a window: the plain event line (Info); Extension offer: the decider sees the stop-or-race-on prompt with the one-sentence risk, others see "Ann is deciding whether to go for 1,000" (Info/Waiting)
  function describeTeamName(view: PlayerView, team: TeamIndex): string;   // "Team 1 (you + Bob)" ; "Team 2 (Cy + Sir Honks-a-Lot)"
  ```
  Every `GameEvent` type has a plain-English line; `CardDrawn` with a null card reads "Bob drew a card." and with a card (the viewer's own draw) names it.
  Hazard names, remedies and safeties use the rulebook's names (Out of Gas, Flat Tire, Accident, Stop, Speed Limit; Gasoline, Spare Tire, Repairs, Roll, End of Speed Limit; Extra Tank, Puncture Proof, Driving Ace, Right of Way).

- [ ] **Step 1: Write failing tests.**
  - `cardFace` returns a distinct non-empty `label` and an `emoji` for every card in a full standard deck (iterate the deck from core), each with a `blurb` that is one sentence ending in a period.
  - `describeEvent` has a case for every event type (a table test over one sample of each `GameEvent`), mentions players by their view name, says "you" is not used for other players, and never prints `null` or `undefined`; a `CoupFourrePlayed` line says the player blocked the hazard with a Coup Fourre.
  - `topBarMessage`: my turn, someone else's turn (names the player), hazard window for my team vs another team, Extension offer for me vs another, `RaceOver`, `GameOver` (a short congratulatory line naming the winning team).
  - `describeTeamName` for a 1-player team ("Team 1 (you)" or "Team 3 (Cy)"), a 2-player team with me, and one without me.
  - A name containing `<b>` is returned as plain text (no escaping or markup is added by these functions; React escapes at render).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): event, phase and card text`).

---

### Task 5: Session, name entry, and lobby screens

**Files:**
- Create: `src/session/SessionProvider.tsx`, `src/screens/NameEntryScreen.tsx`, `src/screens/LobbyScreen.tsx`, `src/screens/Shell.tsx` (top bar and layout used by every screen), tests beside each, and update `src/App.tsx` and `src/styles.css`.

**Interfaces:**
- Consumes: `Api`, `CredentialStore`, `ScreenStore`, `useScreen`, the server's `Screen` (`Lobby` variant).
- Produces: `App` chooses what to render:
  - no credential, or after `onUnauthorized`: `NameEntryScreen` (one text field, a **Join** button, and a **Surprise me** button which creates the session with a `null` name; the server picks a whimsical name); the entered name is sent with `session.create`; a failed result shows its message under the field; success saves the credential and starts the store.
  - credential present: start the `ScreenStore`; `Connecting` shows a short "Connecting..." screen; a `Lobby` screen renders `LobbyScreen`.
  - a persistent small "Reconnecting..." banner while `status === "Reconnecting"`, and a "Lost connection, trying again" message after 10 s without recovery.
  `LobbyScreen`: heading, the player's name (with a **Change name** control that calls `session.rename` and shows the server's message on refusal), a list of games (`PendingSummary`: organizer name, `seatNames`, "N of 6 seats", length label "Quick" / "Short" / "Full", **Join** disabled and labeled "Full" when `isFull`), an empty-state line ("No games yet. Start one!"), a prominent **Start a new game** button (`lobby.createGame`), and the one-time `notice` (for example "The organizer ended the game.") in a dismissible box with `role="status"`.
  A failed `join`/`create` shows the server's plain message inline (for example the name-taken message), never a thrown error.

- [ ] **Step 1: Write failing component tests** (Testing Library, user-event, a fake `Api` and a fake store):
  - No credential renders name entry; typing a name and pressing Join calls `session.create` with that name; **Surprise me** calls it with `null`; a failed result renders its message and keeps the field; success starts the store.
  - A stored credential skips name entry and starts the store; `onUnauthorized` clears the credential and returns to name entry **(Review Focus 3)**.
  - Lobby: renders games with seat names; a full game's Join is disabled; Join calls `lobby.join` with that id; **Start a new game** calls `lobby.createGame`; a `notice` renders once with `role="status"` and can be dismissed; an empty list shows the empty-state line.
  - A game or player name of `<img src=x onerror=alert(1)>` renders as text (no `img` element exists in the output) **(Review Focus 4)**; a 20-character name has the truncation class and does not widen the row (assert the CSS class, since jsdom has no layout).
  - The "Reconnecting..." banner appears for `status === "Reconnecting"`, and disappears when `Live`.
  - Nothing rendered contains the token (render with a recognizable token and search the container's text and attributes).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): session, name entry and lobby`).

---

### Task 6: Waiting rooms

**Files:**
- Create: `src/screens/WaitingScreen.tsx`, `src/screens/TeamList.tsx`, tests beside them.

**Interfaces:**
- Consumes: the `Waiting` screen (`PendingView`: `seats` with `team`, `isMe`, `isOrganizer`, `kind` (organizer only), `length`, `isOrganizer`, `start`).
- Produces: `WaitingScreen` renders the organizer or joiner variant:
  - Both: the game format line ("Quick: first team to 1,000 miles" and so on, from `length`), and the seats grouped into teams (`TeamList`, using each seat's `team`; when `team` is null show a single "Players" list), the player's own seat marked "(you)".
  - Organizer: a three-way length selector (Quick / Short / Full; `pending.setLength`), robot seats marked with a robot icon **only when `kind === "Robot"`** and a **Remove** control on every other seat (`pending.removeSeat`), **Swap seats** (tap one seat then another; `pending.swapSeats`), **Add a robot** (`pending.addRobot`), **Start game** (`pending.start`) disabled with the `start.reason` text shown when `start.ok` is false, and **Cancel game** with a confirmation `<dialog>` (`pending.cancel`).
  - Joiner: "Waiting for <organizer> to start the game..." and **Leave game** (`pending.leave`).
  - Every refusal shows the server's plain message; a `Screen` change to `Playing` or `Lobby` is handled by `App` (no logic here).

- [ ] **Step 1: Write failing component tests:**
  - Organizer variant: renders teams; the robot icon appears only for seats with `kind: "Robot"`; the joiner variant never shows any robot marker even when the data contains one (`kind: null` for non-organizers is the contract; also assert nothing is rendered for seats with `kind: null`) **(Review Focus 7)**.
  - Start is disabled with the reason visible when `start.ok` is false and enabled otherwise; pressing it calls `pending.start`.
  - Add robot, Remove, length selection, and Swap (two taps) call the right procedures with the right ids; Cancel opens a `<dialog>` and only a confirm calls `pending.cancel`; the dialog closes on Escape without calling it.
  - A failed result shows its message; the buttons remain usable.
  - Joiner: Leave calls `pending.leave`; no organizer controls are rendered.
  - 6 seats and a 20-character name render without the truncation class missing (class assertion) **(Review Focus 4)**.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): waiting rooms`).

---

### Task 7: Game table (static)

**Files:**
- Create: `src/screens/GameScreen.tsx`, `src/table/TeamRow.tsx`, `src/table/Piles.tsx`, `src/table/Hand.tsx`, `src/table/CardView.tsx`, `src/table/TopBar.tsx`, `src/table/LastMove.tsx`, tests beside them, styles.

**Interfaces:**
- Consumes: the `Playing` screen (`view`, `events`, `connected`, `timer`, `isOrganizer`, `robots`), `cardFace`, `topBarMessage`, `describeEvent`, `describeTeamName`.
- Produces: the approved "scoreboard rows" layout:
  - `TopBar`: the `topBarMessage` text in an `aria-live="polite"` region; green for `MyTurn`, red for `Alert`, blue otherwise.
  - One `TeamRow` per `view.teams` entry: team name, big mile number with "of <trip distance>" (from `view.trip.distance`), a progress bar (`role="progressbar"` with `aria-valuenow`), player chips with the current player marked (a dot and bold, not only color), status chips with TEXT ("Rolling", "Needs a Roll", the hazard name, "Speed Limit: 50 max", each safety by name, a Coup Fourre count), and an active-lane highlight for the team on turn.
  - `LastMove`: the latest event line (kept in component state from the most recent non-empty `events`; initially a neutral line).
  - `Piles`: the draw pile with its count and the discard pile showing the top card face (or empty).
  - `Hand`: the viewer's cards as `CardView`s (a face from `cardFace`), a "Your hand" label, up to 7 cards at 44 px minimum target width each (the row wraps or scrolls horizontally on 320 px screens without clipping).
  - On the organizer's screen only: a robot icon on robot seats (from `robots`) and a disconnected marker on seats missing from `connected`.
  - A small **mute** button placeholder is added in Task 11; this task adds a header slot for it.

- [ ] **Step 1: Write failing component tests** with fixture screens built from core (`createGame` with a seeded deck, then `viewFor`, so the fixtures are real) :
  - A 2-team, a 3-team, and a 6-seat view render one row per team with the right mile numbers and trip distances (700 vs 1,000), statuses as text, and the player on turn marked in a non-color way.
  - The hand shows exactly `view.me.hand` (assert the labels) and no other player's cards exist anywhere in the DOM (search for a distinctive card of another seat's hand) **(Review Focus 7)**.
  - The piles show the counts; an empty discard shows the empty state.
  - Robot icons and disconnected markers appear only when `robots`/`connected` are non-null (organizer) and never otherwise.
  - Names with HTML render as text; the 6-seat fixture with 20-character names renders with the truncation classes.
  - The top bar message for my turn / another's turn / `RaceOver` matches `topBarMessage`, in an `aria-live` region.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): static game table`).

---

### Task 8: Playing cards (interaction, legal plays, hazard window, Extension offer)

**Files:**
- Create: `src/table/playController.mts`, `playController.test.mts`, `src/table/useSelection.ts`, `src/table/HazardBanner.tsx`, `src/table/ExtensionOffer.tsx`, `src/table/CardHelp.tsx`, tests beside them; modify `GameScreen`, `Hand`, `TeamRow`, `Piles`.

**Interfaces:**
- Consumes: core `legalPlays`, `candidateCommands`, `checkCommand`, `contextFromView`, `describeRejection`, `PlayerCommand`; `Api` (`game.play`); `Snapshot.screen`.
- Produces (pure first, then React):
  ```ts
  type Targets =
    | { kind: "None" }                                           // the card cannot be played; explain with `reason`
    | { kind: "Immediate"; command: PlayerCommand }              // a card that needs no target (Roll, a safety, a distance card, Coup Fourre)
    | { kind: "Choose"; teams: ReadonlyArray<{ team: TeamIndex; command: PlayerCommand }>; discard: PlayerCommand };   // an attack: pick a team, or discard
  function targetsFor(view: PlayerView, card: Card): { targets: Targets; reason: Option<string> };
  //   uses legalPlays/candidateCommands/checkCommand so the client and server agree; `reason` is describeRejection of the first refusal for a card that cannot be played
  type Selection = { kind: "Nothing" } | { kind: "Card"; card: Card };
  function reduceSelection(sel: Selection, action: { type: "TapCard"; card: Card } | { type: "TapTarget" } | { type: "Cancel" } | { type: "ScreenChanged" }): Selection;
  ```
  UI behavior:
  - Tap a card: it rises and the valid targets highlight (lanes for an attack, the discard pile for a discard; a card with an immediate play shows a **Play** button on the card, plus **Discard**); tapping the same card again, or the background, cancels.
  - A play goes through `game.play`; while a request is in flight further taps are ignored (**Review Focus 2**); a failed `Result` shows its plain message and clears the selection.
  - Unplayable cards are dimmed (`aria-disabled`, not `disabled`, so they stay tappable); tapping one shows its reason in the top bar region; **long-press** (500 ms, pointer events, cancels on move) on any card opens `CardHelp` with `cardFace().blurb`.
  - `HazardBanner`: when the phase is `HazardIncoming` and the viewer is on the target team: the red alert message with a countdown from `timer.remainingMs` (a 1 s display tick computed from a captured deadline: `Date.now() + remainingMs` at message arrival; never a per-tick network update), and the viewer's counter-safety card glows (a CSS class) if held; a Coup Fourre is played by tapping that card (command `CoupFourre`); players on other teams see only the hazard in the last-move line, **no banner and no glow** (information must not leak).
  - `ExtensionOffer`: for the decider, a dialog-style panel with **Call Extension** and **Stop here**, the one-sentence risk, and a countdown; others see the "is deciding" line.
  - The selection resets when the phase changes underneath it (`ScreenChanged`) with a short message ("That window closed" or "It is no longer your turn").

- [ ] **Step 1: Write failing tests.**
  - `targetsFor`: a Roll while `NeedsRoll` is `Immediate Remedy Roll`; a distance card that would overshoot the trip is `None` with the overshoot message; an attack card gives `Choose` with exactly the legal enemy teams and a discard option; a hazard card with no legal target gives only discard; the result agrees with `legalPlays` for every card in a sample of 200 views from a seeded simulation (`playGame` `onStep` views for each seat) **(client and engine agree)**.
  - `reduceSelection`: tap card selects; tap same card cancels; tap target clears; `ScreenChanged` clears; a second card replaces the first.
  - Component tests with a fake `Api`: tap card then target sends exactly one `game.play` with the right command; a double tap on the target sends one command **(Review Focus 2)**; a refused result shows its message and clears the selection; an unplayable card tap shows the reason and sends nothing; long-press opens the help with the blurb and sends nothing; tapping when it is not my turn sends nothing.
  - Hazard window: the target team's players see the banner with a countdown that counts down with fake timers, the counter card has the glow class, and tapping it sends `CoupFourre`; a player on another team sees neither banner nor glow **(Review Focus 7)**; when the next screen is a Turn the banner and a half-finished selection disappear **(Review Focus 2)**.
  - Extension offer: the decider's buttons send `CallExtension` / `DeclineExtension` once; others see no buttons.
  - A reconnect snapshot (new `remainingMs`) resets the countdown from the new value, not the old deadline **(Review Focus 1)**.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): playing cards`).

---

### Task 9: Race summary, game over, reveal, and leaving

**Files:**
- Create: `src/screens/RaceSummary.tsx`, `src/screens/ScoreSheet.tsx`, `src/screens/GameOverScreen.tsx`, `src/table/EndGameDialog.tsx`, tests beside them; modify `GameScreen` to switch on `view.phase.kind`.

**Interfaces:**
- Consumes: `view.phase` (`RaceOver { result }`, `GameOver { winner, result, reveal }`), `view.teams` (zones are kept after a race), `timer` (`NextRace`), `game.leave`, `game.end`.
- Produces:
  - `ScoreSheet`: a table with one column per team and one row per line of the rulebook score sheet, in the rulebook's order (total brought forward, miles, safeties, coup-fourrés, trip completed, delayed action, safe trip, shutout, extension, total for the race, combined total), reading each `RaceScore` row from `result.scores`; the winning team of the race is marked in text; the table sits in a horizontally scrollable `role="region"` with an accessible name and `tabindex="0"` at 320 px.
  - `RaceSummary` (phase `RaceOver`): the score sheet, a countdown "Next race in N s" from the `NextRace` timer, and a note that the race was won by a team or ended in a tie.
  - `GameOverScreen` (phase `GameOver`): the winning team announced, the final score sheet, the **reveal** list ("Sir Honks-a-Lot was... a robot!" for each seat from `reveal`), and **Back to lobby** (`game.leave`).
  - `EndGameDialog`: the organizer sees an **End game** control in the table header that opens a confirmation `<dialog>` ("End the game for everyone?"), then calls `game.end`; others do not see the control.

- [ ] **Step 1: Write failing tests** with real fixtures (finished races from a seeded simulation run through core):
  - The score sheet shows every row for every team, the values equal `result.scores` (spot-check each row), and is wrapped in a labeled, keyboard-focusable region.
  - `RaceSummary` shows the countdown from `timer.remainingMs` and updates with fake timers; with a `Tie` outcome it says so.
  - `GameOverScreen` lists every seat in `reveal` with its kind, announces the winning team, and **Back to lobby** calls `game.leave` once; the reveal never renders before `GameOver` (a `RaceOver` fixture contains no "robot" text for non-organizers) **(Review Focus 7)**.
  - The End game control exists only for the organizer; Escape closes the dialog without ending; confirming calls `game.end` once; a failed result shows its message **(Review Focus 6)**.
  - A name with HTML renders as text in the sheet and the reveal.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): score sheet, game over and reveal`).

---

### Task 10: Animations from the event queue

**Files:**
- Create: `src/animation/animator.mts`, `animator.test.mts`, `src/animation/useAnimator.ts`, `src/animation/FlyingCard.tsx`, `src/animation/animations.css`, tests beside them; modify `GameScreen` and the table pieces to expose animation anchors (`data-anim-anchor` attributes for each team lane, the draw pile, the discard pile, each hand card, and the viewer's hand).

**Interfaces:**
- Consumes: `ScreenStore.getSnapshot().pendingEvents`, `consumeEvents`, `describeEvent`, `cardFace`.
- Produces:
  ```ts
  type Step =
    | { kind: "Fly"; card: Card | null; from: Anchor; to: Anchor; ms: number }
    | { kind: "Pulse"; target: Anchor; tone: "Good" | "Bad"; ms: number }
    | { kind: "Pause"; ms: number };
  type Anchor = { kind: "DrawPile" } | { kind: "DiscardPile" } | { kind: "Hand" } | { kind: "Team"; team: TeamIndex };
  function stepsFor(event: GameEvent, view: PlayerView): ReadonlyArray<Step>;   // pure: Drive flies the card from the player's hand to their team lane; an Attack flies it to the target team and pulses it red; a Remedy pulses green; a SafetyPlayed shows the safety flying with a gold pulse; CoupFourrePlayed is the biggest pulse; a Discard flies to the discard pile; a CardDrawn flies from the draw pile to the drawer's hand (face shown only when the card is non-null)
  interface Animator { enqueue(batch: ReadonlyArray<GameEvent>, view: PlayerView): void; whenIdle(): Promise<void> }
  function createAnimator(deps: { play: (s: Step) => Promise<void>; reducedMotion: () => boolean }): Animator;
  //   plays batches strictly in order, one step at a time; under reduced motion skips Fly and Pulse steps (but still resolves in order)
  ```
  The `play` implementation uses the Web Animations API on a absolutely positioned `FlyingCard` (`transform` and `opacity` only, `element.animate`, resolving on `finished` or immediately when `getAnimations()` is empty or the element is missing), measuring anchors with `getBoundingClientRect`; a missing anchor skips the step rather than throwing.
  `useAnimator` feeds `pendingEvents` to the animator and calls `consumeEvents` for each batch when its steps finish, and the "last move" line updates as each batch starts so text and motion agree.
  Timing: a flight is 350 ms, a pulse 450 ms, so a typical play takes under a second; a hazard window's hit lasts as long as the window (the hazard card is shown in flight and held until the window closes) so the pause looks like animation time (design).

- [ ] **Step 1: Write failing tests.**
  - `stepsFor` for each event type (table test with one sample each): the right `Fly` anchors and a pulse where specified; `CardDrawn` with a null card has a face-down flight; every event type returns at least one step or an explicit empty list for events with no visual (`RaceDealt`, `TurnStarted` give a short pause).
  - `Animator`: batches play strictly in the order enqueued (two batches enqueued back to back never overlap; assert with a controllable fake `play`); `whenIdle` resolves after the last step; under `reducedMotion() === true` the fake `play` receives no `Fly` or `Pulse` steps and the order of the remaining steps is preserved **(Motion constraint)**.
  - A `play` that rejects never stalls the queue (the next batch still runs) and the error is swallowed.
  - Hook test: a snapshot with a pending batch triggers the animator once, calls `consumeEvents` with that id after it finishes, and does not re-run on re-render; a store reconnect (no queued events) animates nothing **(Review Focus 1)**.
  - Component test: with `getAnimations` returning `[]` (jsdom has no WAAPI) a flight resolves immediately and the final state renders (no card left hovering).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): card animations driven by events`).

---

### Task 11: Sounds, vibration, and the mute control

**Files:**
- Create: `src/sound/soundPack.mts`, `soundPack.test.mts`, `src/sound/audioEngine.mts`, `audioEngine.test.mts`, `src/sound/useSound.ts`, `src/sound/MuteButton.tsx`, tests beside them.

**Interfaces:**
- Consumes: `GameEvent`, `PlayerView`, the animator's batch start hook, `localStorage`.
- Produces:
  ```ts
  type SoundName = "roll" | "drive" | "hazard" | "remedy" | "safety" | "coupFourre" | "discard" | "draw" | "yourTurn" | "windowAlert" | "raceWon" | "gameOver" | "honk";
  const soundPack: Readonly<Record<SoundName, ReadonlyArray<Tone>>>;      // small synth recipes: oscillator type, frequency (with optional slide), gain envelope, duration, delay
  function soundsFor(event: GameEvent, view: PlayerView): ReadonlyArray<SoundName>;   // pure: which sounds an event makes for this viewer ("windowAlert" only for players on the hit team; "yourTurn" when TurnStarted names the viewer; "honk" when the player's name is Sir Honks-a-Lot plays a card; "coupFourre" the fanfare)
  interface AudioEngine { unlock(): void; play(name: SoundName): void; readonly muted: boolean; setMuted(m: boolean): void }
  function createAudioEngine(deps: { createContext: () => Option<AudioContextLike>; storage: StorageLike }): AudioEngine;
  //   no context, a throwing constructor, or a suspended context never throws; play is a no-op until unlock() succeeded (called from the first user tap) and while muted; the mute choice persists
  function vibrationFor(event: GameEvent, view: PlayerView): Option<ReadonlyArray<number>>;   // "yourTurn" and "windowAlert" patterns; used through navigator.vibrate only when it exists
  ```
  A **MuteButton** (an icon button labeled "Mute sounds" / "Unmute sounds", `aria-pressed`) goes in the table header slot from Task 7 and on the lobby header.
  Sounds and vibration start when an animation batch starts (so they line up with the motion); a snapshot after reconnect makes no sound **(Review Focus 1)**.
  Every player on the hit team gets the same `windowAlert` sound and vibration, whether or not they hold the counter (design: no information leak), and players off the team get none.

- [ ] **Step 1: Write failing tests.**
  - `soundPack` has a recipe for every `SoundName`, each tone has a finite positive duration and a gain within [0, 1].
  - `soundsFor`: table test per event type; `windowAlert` only for hit-team players and identical for holders and non-holders (compare two views of one team that differ only in hand contents) **(information must not leak)**; `yourTurn` only for the viewer's own turn; no sounds for events with a null-card draw other than `draw`.
  - `AudioEngine` with fakes: `play` before `unlock` does nothing; after `unlock` it schedules oscillators on the fake context; muted means nothing is scheduled; `setMuted` persists to storage and a new engine reads it; `createContext` returning none, throwing, or a context whose `resume()` rejects never throws and `play` stays a no-op **(Review Focus 5)**.
  - `vibrationFor` gives patterns for `yourTurn` and `windowAlert` and none otherwise; the hook calls `navigator.vibrate` only when it exists (a test with it undefined does not throw) **(Review Focus 5)**.
  - `MuteButton` toggles, announces its state via `aria-pressed` and label, and persists.
  - Reconnect snapshot (no queued events) plays nothing **(Review Focus 1)**.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS; commit** (`feat(web): sounds, vibration and mute`).

---

### Task 12: Serving, end-to-end tests, README, final gate

**Files:**
- Create: `apps/mille-bornes-web/e2e/*.spec.ts`, `playwright.config.ts`, `README.md`; modify `package.json` (`e2e` script), the game server's config default for `webRoot`, its README, and root `.gitignore` for Playwright output.

**Interfaces:**
- Produces:
  - The game server's `loadConfig` defaults `webRoot` to the web app's built directory (package-relative, `apps/mille-bornes-web/dist`) when that directory exists, still overridable with `MB_WEB_ROOT`; with the directory missing it stays `NoneOption` and the placeholder page appears (update the server's tests and README).
  - `npm run e2e -w @repo/mille-bornes-web`: builds the web app, starts the real game server (`startServer` from a small Playwright global setup or a spawned `node dist/www.mjs` with a temp `MB_DATA_DIR`, an ephemeral port, and tiny timings through environment variables if the server exposes them, otherwise real timings with the tests waiting accordingly) and runs the specs with phone-sized viewports (for example 390 x 844) in Chromium.
  - Specs (several browser contexts stand in for phones):
    1. Four players (three humans and one robot) enter names, one creates a game, the others join, the organizer adds a robot, starts, and the game is played to the end by a test helper that reads each page's visible hand and plays a legal card using the visible UI (tap card, tap target or Play or Discard), then everyone sees the score sheet, the reveal, and returns to the lobby.
    2. Reload and reconnect: one player reloads the page mid-game and lands on the same table with the same hand; closing and reopening the context's network (`context.setOffline`) shows "Reconnecting..." and recovers.
    3. Organizer ends the game: the others return to the lobby with the notice.
    4. A name with HTML is shown as text on every screen.
    5. The server restarts mid-game (stop and start on the same data dir and port): phones show the lost-connection state and recover to the same game.
  - `README.md`: how to run (`npm run build`, `npm start -w @repo/mille-bornes-game-server`, open the URL or scan the QR code on `/host`), development (`npm run dev` for the app with the proxy and the server in another terminal), the tests, the sound pack and `cardFace` as the places to customize, and a short "known gaps" list (keeping phones awake is deferred).
  - Follow the AGENTS.md Markdown rules in both READMEs (semantic line breaks, aligned tables).

- [ ] **Step 1: Write the end-to-end specs** (they fail until the app is complete and served).
- [ ] **Step 2: Run, expect FAIL for the right reasons. Step 3: Implement the serving default, the e2e wiring, and fix any real bug the specs reveal in the module that owns it, adding a pinning unit test there.** Report each such bug.
- [ ] **Step 4: Run the e2e suite three times in a row, expect PASS each time.**
- [ ] **Step 5: Start the real server by hand with the built app, open it in a browser or Playwright, and confirm the lobby renders and `/host` still works.**
- [ ] **Step 6: Run the final gate from the repo root: `npm run all && npm run type-check`, expect success (only the 2 known `mille-bornes-shared` lint warnings are acceptable); commit** (`feat(web): serve the app, end-to-end tests, readme`).

---

## Self-review notes

- Spec coverage (design "Web client"): screens (name entry, lobby, organizer and joiner waiting rooms, game table, race and game summary, reveal) are Tasks 5 to 9; the approved scoreboard-rows layout and the top bar are Task 7; tap-then-target, long-press help, dimmed cards and explained refusals are Task 8; the hazard window banner and Extension offer are Task 8; animations from the event queue are Task 10; sounds, vibration and a persisted mute are Task 11; component tests per screen are in each task and the multi-browser end-to-end run is Task 12.
- Server seams used: `watch` stream (first message is a snapshot, so the store never queues its events), `ResultWire` decoding, credential via header and connection parameter, `connected` and `robots` organizer-only, `timer.remainingMs`.
- Deliberately skipped: keeping phones awake (owner's decision), recorded sound clips, illustrated cards, spectators, chat, and internationalization.
- Risk: the biggest unknowns are the exact `@trpc/client` subscription callbacks for connection state (Task 3) and whether the server's types compile in a browser project (Task 1); both are named so the implementer resolves them early.
