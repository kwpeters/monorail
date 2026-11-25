# Multiplayer Mille Bornes: Design

Status: draft for approval.
Date: 2026-11-24.

## Intent and why

Build a multiplayer Mille Bornes card game for family gatherings over the holidays.
Players are the owner's kids, siblings, and parents, most in the same room, and some have never played the game.
Each player uses their own phone and a browser.
One PC runs the server.

The goal is an evening of laughing and joking, not tight competitive play.
Whimsical robot names, funny sound effects, and animations that make each play easy to follow matter as much as the rules.

A first attempt exists in this monorepo
(`packages/mille-bornes-shared`, `packages/mille-bornes-engine`, `apps/mille-bornes-server`).
It stalled early:
it has data schemas, deck construction, and an initial deal, but no turn rules, scoring, bots, lobby, or UI.
This design starts over with new projects and uses the old ones only as reference.
The old projects are deleted at the end.

## Goals

- Phone-first browser play: each player opens the server URL, usually by scanning a QR code the server displays.
- A lobby listing pending games; any player can create one and becomes its organizer (and a participant).
- The organizer can add and remove robot players, arrange teams, choose the game length, and start the game.
- A game can start with 2, 3, 4, or 6 seats in total (the rulebook's player counts), counting robots, so 1 to 6 humans plus robots; the teams follow from the seat count.
- Each player sees the shared table (every team's miles, status, and safeties), whose turn it is, and their own hand.
- Official Mille Bornes rules (see "Rules baseline" and `rules.md`), including Coup Fourre, with the Coup Fourre window described below.
- An end-of-race scoreboard shown to every player: for each team, the total brought forward, miles, safeties, coup-fourrés, trip completed and the other bonuses, the total for the race, and the combined total (modeled on the rulebook score sheet).
- Beginner-friendly: it is always obvious whose turn it is and what to do, and every rejected play is explained in plain English.
- Animations that show each play, and funny sound effects, with a mute control.
- Whimsical robot names, which humans may also choose, with a reveal at the end of the game.
- Crash resilience: games survive a server restart, and no input from a client should crash the server or an engine.
- Extensive automated tests, including randomized whole-game simulation.

## Non-goals

- Hosting on the internet.
  The design must not make it hard later (relative URLs, no hard-coded addresses), but nothing is built for it now.
- Accounts, passwords, or authentication beyond a per-player token that identifies a seat.
- Spectators, joining a game after it starts, or swapping a bot into a human's seat mid-game.
  A started game is locked to the players who began it.
- A hint or "suggest a move" feature.
- In-game chat.
- House-rule options, custom race distances, or custom point goals in the UI (only the three presets below).
- Game history, statistics, or leaderboards.
- Localization and desktop-optimized layouts.

## Anti-goals

These make the project a failure even if every feature technically works.

- A crash, hang, or stuck game at a party.
- Leaking hidden information: another player's hand, the draw pile order, or any tell about who holds a Coup Fourre card.
- A new player who cannot tell whose turn it is or why a card will not play.
- Dry, silent, or slow-feeling play.

## Constraints

- npm workspaces and Turborepo monorepo; follow `AGENTS.md` and `.editorconfig` (style, naming, JSDoc, test layout).
- Use depot helpers (`Result`, `Option`, `pipe`, and so on), Zod enums, and branded types, as the rest of the repo does.
- The owner is on Windows; the server runs on a Windows PC on a home network.
  Phones must reach it over the LAN.
  Guest Wi-Fi networks often isolate clients and will not work; Windows Firewall will prompt on first start.
- Browser APIs that need a secure context (for example the Screen Wake Lock API) are unavailable over plain `http://<lan-ip>`.
  Phone screens may therefore lock mid-game, and reconnection must handle it.
- Mobile audio plays only after a user gesture (iOS Safari especially), and the Vibration API is not supported on iOS.
  Both are enhancements, never required.
- `npm run all && npm run type-check` must pass.

## Approaches considered

The decisions to keep a pure `(state, command)` engine, use Zod and tRPC, and send per-player views were made first.
What remained to decide is below.

Ruled out:

- **Extend the old state model.**
  It is the fastest path to a first playable game, but it checks legality at runtime (`refine()` rules, parallel arrays that must stay in sync, a driving zone that can be "rolling" with an active hazard).
  That contradicts the owner's "make illegal states unrepresentable" requirement.
  The owner also chose to start over.
- **Peer-to-peer.**
  Hidden hands require a server to act as referee.

Crash recovery options:

1. **Fresh core with snapshots. (Chosen.)**
   After every accepted command the server writes the full game state to a JSON file.
   On restart it reloads games and phones reconnect with their stored credentials.
   A command log may be appended alongside as a debugging aid so a buggy game can be replayed as a unit test.
2. Fresh core, event-sourced: the command log is the source of truth.
   Rejected: more moving parts (replay versioning, log compaction) than a game this small needs.
3. Fresh core, memory only: rejected because a crash or restart would end every game.

## Decisions

### Decided with the owner

- Start over with new projects; delete the old three at the end.
- A started game is locked to its original players; the organizer can end a game at any time.
- Table layout: "scoreboard rows" (each team is a row with big mile numbers, a progress bar, player names with a marker on the current player, and status pills).
  The Speed Limit pill states the limit ("Speed Limit: 50 max").
- Lobby flow: name entry, a list of pending games with Join, "Start a new game", an organizer waiting room, and a joiner waiting room (the mockups were reviewed and approved).
- Game lengths, chosen by the organizer in the waiting room; the default is Quick.
  - Quick: one race, first team to exactly 1,000 miles.
  - Short: play hands until a team reaches 2,000 points.
  - Full: play hands until a team reaches 5,000 points.
- Players have unique names within a game (case-insensitive, trimmed; duplicates are refused with a plain message).
  A player may press "Surprise me" to take a random whimsical name from the same pool the robots use; names already in the game are never offered.
- Robots are disguised: the robot icon appears only on the organizer's own screen, and a robot waits a random 1 to 3 seconds before each play.
  A player has exactly one name (the one typed, or a whimsical one picked); there is no separate real name or alias.
  A reveal screen at game end shows, for each player, whether they were a human or a robot ("Sir Honks-a-Lot was... a robot!").
  The disguise therefore works only to the extent that humans also choose whimsical names.
- Coup Fourre is included, with a leak-free response window (see "Coup Fourre window").
- Technology: tRPC and Zod; React with Vite; crash recovery by snapshots.
- Testing emphasis: extensive unit tests, because a crash would ruin the party.

### Calls made by the author (not yet confirmed by the owner)

- Projects and names (distinct from the old ones so deletion is clean):
  - `packages/mille-bornes-core`: pure and browser-safe.
    Contains domain types, Zod command, event, and view schemas, the pending-game (lobby) model, the game engine, scoring, legality and rejection messages, and the bot strategy.
    It has no Node or DOM dependencies.
    There is no separate "shared" package.
  - `apps/mille-bornes-game-server`: Express, tRPC, lobby, timers, snapshot persistence, bot driver, host page.
  - `apps/mille-bornes-web`: React and Vite client, built and served by the server on a single port.
- tRPC supplies the API contract to the client through a type-only import of the router.
  The client imports everything else (types, command schemas, legality checks, rejection messages) from core.
- Test tools: Jasmine for core and server (the repo convention); Vitest with Testing Library for the web app; `fast-check` for property-based tests; Playwright for a few multi-browser end-to-end runs.
- Automatic draw at the start of a turn, with a visible draw animation.
- Tap a card, then tap a target, as a two-step play to prevent accidental plays.
  Long-pressing any card shows a one-sentence explanation.
- Teams follow from the seat count (2 seats: 2 teams of 1; 3: 3 teams of 1; 4: 2 teams of 2; 6: 3 teams of 2).
  Turn order is seat order, and a seat's team is its position modulo the number of teams, so teams re-form as people join.
  The organizer rearranges teams by swapping two seats.
  Start is disabled with an explanation unless there are exactly 2, 3, 4, or 6 seats (for example, "Mille Bornes needs 2, 3, 4, or 6 players: add a robot").
- The lobby (pending game) is its own pure model in core, with its own commands and rejections.
- The server host page (`/host`) shows the QR code, the URL as text, and a list of games with an "End game" escape hatch.
- A disconnected player's turn simply waits, and their seat shows a disconnected indicator (robots always appear connected).
  There is no automatic takeover.
  The organizer can end the game.

## Design

### Engine model

The engine is a set of pure functions over immutable values.

- `applyCommand(state, command)` returns `Result<{ state, events }, Rejection>`.
  The engine never reads a clock and never generates randomness.
  A shuffled deck is supplied by the caller (a command carries it, or the caller passes a provider) when a race is dealt.
- `Rejection` is a typed discriminated union (for example `ThirdTwoHundred`, `NotRolling`, `SpeedLimitActive`, `NotYourTurn`, `HazardAlreadyActive`), never a bare string.
  A core function renders each rejection as a plain-English sentence for new players.
- `events` is a list of typed, public facts about what just happened (for example "Ann played Flat Tire on Team 2", "Bob played Puncture Proof as a Coup Fourre", "race over").
  Animations, sounds, and the "last move" line are driven from events, not from diffing states.
- `viewFor(state, player)` returns the per-player view: the viewer's own hand, other players' names, teams, turns and card counts, each team's public driving zone, the draw pile count, the discard pile top, and phase-specific prompts.
  It never contains other hands, the draw pile order, or any other player's credential.
- `legalPlays(view)` and the command validation share one implementation, so the client can dim unplayable cards and explain them while the server stays authoritative.
- The domain makes illegal states unrepresentable and avoids primitive obsession:
  branded types (for example `PlayerId`, `GameId`, `Miles` as a multiple of 25, `Points`, `PlayerName`), discriminated unions for a driving zone's status (a zone cannot be both rolling and hazarded) and for the game phase, and no parallel arrays whose lengths must agree.
  Zod schemas exist at the boundaries (commands in, views and snapshots out) and for enums; they are not the only line of defense inside the engine.
- A game phase is a union such as: a player's turn, a Coup Fourre window, an Extension offer, race over, game over.

### Coup Fourre window

When a hazard is played, the engine enters a "Coup Fourre window" phase.
The window is always opened and always runs its full length, whether or not anyone could respond, so its length reveals nothing.
The server owns the timer (default 5 seconds, configurable) and sends the engine a "close window" command when it expires.

- Every member of the hit team sees an identical banner and countdown, for example "Flat Tire! You have 5 seconds. If anyone on your team holds Puncture Proof, play it now."
  There is no decoy button.
  The matching safety card may glow in the holder's own hand to help new players.
  Everyone on the hit team gets the same sound and vibration.
- The Coup Fourre is played by tapping the card in the hand.
  There is no "pass" command, because passing early would also reveal information.
- Every other player sees only the hazard card animation, which lasts as long as the window, so the pause looks like animation time.
  Nobody outside the hit team is told anything about the window.
- Robots on the hit team answer after their usual 1 to 3 second delay (if they hold the card), capped so the answer still lands inside the window.
  An instant answer would give a robot away, so a quick answer never does.
  The window still runs in full.
- A Coup Fourre played in the window cancels the hazard, scores the bonus, and gives the player a replacement draw and the next turn.
  If the window closes with no Coup Fourre, the hazard lands.
- The window state must survive a snapshot and restart (the server restarts the window rather than resolving it silently).

### Extension offer

In 2-, 3-, and 6-player games the trip is 700 miles until someone calls Extension (see `rules.md`).
When a team first reaches exactly 700 miles, the engine enters an "Extension offer" phase for the player whose card reached 700.
Everyone can see who is deciding, so there is no hidden information here.

- The deciding player sees a clear prompt: stop and win the race now with the trip bonus, or call Extension and race on to 1,000.
  The prompt explains the risk in one sentence: if anyone else reaches 1,000 first, every other team scores 200.
- The player answers with a "call Extension" or "decline" command.
  The server owns the timer (default 30 seconds, configurable) and sends the engine a "close offer" command when it expires, which counts as declining.
- Robots decide with a simple rule: call Extension only when the robot's team leads every other team by at least 100 miles.
- Declining ends the race with the trip completed at 700.
  Calling raises every team's limit to 1,000 and the race continues.
- The offer state must survive a snapshot and restart (the server restarts the timer).

### Rules baseline

The rules are in `rules.md` in this folder.
It is taken from the owner's rulebook (Winning Moves / Hasbro) and is the authority for game rules.
It replaces the earlier summary that stood here, which was written from memory and was wrong in places
(for example, a Safety card that cancels an active hazard leaves the team rolling, and the trip distance varies with the number of players).

The owner decided to follow the rulebook's player-count variants in full: the trip distance (700 or 1,000 miles), the deck (101 or 106 cards), the team structure, and the Extension rule all follow from the number of seats (2, 3, 4, or 6).
If a team calls Extension and does not complete the 1,000 miles first, every other team scores the 200-point Extension bonus.
The owner also decided that Speed Limits cannot be stacked and that Safe Trip is worth 300 and Shutout 500 (the printed rulebook has the two values reversed).

Terminology: a **race** is one contest to complete the trip distance (the rulebook says "hand" or "deal"); "hand" means only the cards a player holds.
After every race all players see a score sheet for every team,
with one row per line of the rulebook's score sheet (total brought forward, miles, safeties, coup-fourrés, trip completed, delayed action, safe trip, shutout, total for the race, combined total).

### Server

- Express serves the built web app and a tRPC router.
  Commands are tRPC mutations.
  Each player's view and events stream through a tRPC subscription (server-sent events); resume after a dropped connection should use the event ids tRPC supports.
  Confirm against current tRPC documentation, including Zod 4 compatibility.
- The server holds all games in memory and snapshots each to disk after every accepted command (write a temporary file, then rename, so a crash cannot leave a half-written file).
  On startup it reloads snapshots, validating each with Zod.
  A corrupt snapshot is logged and skipped; it must never prevent startup.
- A player's identity is a seat plus a random credential stored in the browser's local storage.
  It is never included in any view.
  Returning to the app after a screen lock or reload resumes the same seat.
- A bot driver issues robot commands with random 1 to 3 second delays, and answers Coup Fourre prompts after the same delay, capped so the answer lands inside the window.
- On startup the server finds the PC's LAN address(es), prints the URL and a QR code in the terminal, and serves them on `/host`.
  Machines with several adapters (VPN, WSL, Hyper-V) are common, so show every plausible private IPv4 address.
- The organizer can end the game at any time (with a confirmation).
  Everyone returns to the lobby with a message.

### Web client

- React and Vite, portrait phone layout, tap targets large enough for any hand, no hover-only interactions.
- Screens: name entry, lobby, organizer and joiner waiting rooms, game table, race and game summary, reveal.
- Game table: the approved "scoreboard rows" layout.
  A top bar says exactly what to do ("Your turn: play or discard a card") and turns green on your turn; for everyone else it says who is playing.
  Your phone plays a sound and a short vibration (where supported) on your turn.
- Unplayable cards are dimmed; tapping one explains why using the rejection text.
- Animations are driven from the event stream through a queue, so back-to-back events play in order.
- Sound effects: a sound per card kind or event (for example roll, flat tire, accident, Coup Fourre fanfare, your-turn chime, a honk for Sir Honks-a-Lot), unlocked by the first tap, with a persisted mute control.

## Testing

- Core: example-based unit tests for every rule and every rejection, scoring tables, pending-game rules, view redaction (no hand or deck leakage), and legality previews matching validation.
- Core: property-based tests with `fast-check`.
  Play thousands of random legal games to completion with invariants: the card count is conserved, miles never go negative or overshoot, no input makes the engine throw, a race always ends, and views never contain hidden cards.
- A soak script plays many bot-only games and reports any failure.
- Server: tests through an in-process tRPC caller covering the lobby flow, per-player view streaming, the Coup Fourre timer (using an injected clock), snapshot save and reload (including a corrupt file), and reconnection.
- Web: component tests for each screen and for the turn and rejection prompts.
- A few Playwright end-to-end runs with several browser contexts standing in for phones, ending with a complete game.
- Follow the `AGENTS.md` test layout (one `describe` per class or module, with `static` and `instance` blocks where they apply).

## Milestones

1. **Core.** Domain types, the pending-game model, the engine, scoring, views, legality and rejection messages, the bot strategy, and the full test suite including simulation.
2. **Server.** tRPC routes, lobby, persistence, timers, bot driver, `/host` page with the QR code.
   A text or scripted client can play a whole game against it.
3. **Web.** Screens, then animations and sounds.
4. **Rehearsal and cleanup.** Play a full game with several real phones, then remove the three old projects after confirming nothing depends on them.

## Left to the builder

- Exact type and file names inside the projects.
- Exact rules and scoring numbers, from the authoritative source.
- Robot strategy (a reasonable heuristic is enough, so long as it never makes an illegal play).
- The animation approach and library, the visual styling, and the sound assets (royalty-free clips or synthesized sounds; the owner should hear and approve the funny ones).
- The robot name pool (the owner can veto weak names).
- Snapshot file layout and where the data directory lives (it must be git-ignored).
