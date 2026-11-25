# Carry-over from milestone 2 (game server) into milestone 3 (web client)

Milestone 2 is complete:
`apps/mille-bornes-game-server`, branch `mille-bornes-2`.
Findings from its reviews that the web milestone, or later cleanup, should pick up.

## Contract the web client builds against

- Import the router type only:
  `import type { AppRouter } from "@repo/mille-bornes-game-server/router"`,
  and `Screen` from `@repo/mille-bornes-game-server/screens`.
- Credential: `Authorization: Bearer <playerId>.<token>` for HTTP calls.
  A subscription cannot set headers, so `httpSubscriptionLink` sends the same string as the connection parameter `authorization`.
  Store the credential in `localStorage`.
- Mutations return `ResultWire` (`{ succeeded: true } | { succeeded: false; error }`).
  Decode with `discriminatedResultSchema` from `@repo/depot/schemaUtility` to get a real `Result`.
- `watch` is one stream per player.
  The first message is always the current screen; missed events are not replayed.
  `events` drive the animation queue; a message with `events: []` just updates the screen.
- `timer.remainingMs` is computed when the message is sent, so count down locally.
- tRPC reconnects on its own after a phone sleeps (ping every 2 s, reconnect after 6 s of silence).
- `session.me` returns `UNAUTHORIZED` for an unknown credential;
  treat that as "enter your name again".

## Keeping phones awake (decision for milestone 3)

The Screen Wake Lock API (`navigator.wakeLock.request("screen")`) needs a secure context,
so it does not exist on a plain `http://<lan-ip>` page.
Plan: feature-detect it, and fall back to a hidden, muted, looping, `playsinline` video started from the tap that joins a game (the NoSleep.js technique).
Re-request the lock when the page becomes visible again, because the browser releases it when the tab is hidden.
Run in the browser tab, not as a home-screen app (an iOS bug disabled the API there until iOS 18.4).
How the fallback behaves over plain HTTP is unconfirmed: test it on the family's real phones at the rehearsal.
HTTPS with a self-signed certificate would make the real API work but shows a certificate warning on every phone.
If a phone locks anyway, the stream reconnects and shows the current state.

## Design observations for the owner

- `connected` is organizer-only now (`null` for everyone else), so players cannot spot robots by elimination.
  The web client should show the disconnected indicator on the organizer's screen only.
- The organizer sees robot seats (intended).
- `session.create` is unauthenticated and unbounded; fine on a home network.

## Deferred minors

- Core: `robotMoves` drops a seat whose `viewFor` fails (unreachable);
  `maxSeats = 6` is duplicated in three core files;
  `readiness` drops `validateGameConfig`'s message.
- Table: a scheduling throw on the human `submit` path escapes after the game advanced (wrap `schedule()` in `commit`);
  `submit()` before `start()` double-schedules; some JSDoc gaps.
- Hub: a player seated in two games after a restore gets split lookups;
  a failed `deleteGame` on cancel returns the game after a restart;
  `persist` logs "Saving game" for deletes and quarantines too;
  the first screen of an iterator returned before its first `next()` keeps its listener until the signal aborts.
- Store: no size cap on game files;
  `sessions.json.tmp` is not swept at startup;
  the quarantine rename has no lock retry;
  a transient lock on `sessions.json` at startup can still lose sessions (read and `.bad` rename both fail).
- Server: `lanUrls` shows one address per interface (a depot-node limitation);
  the SPA fallback answers 500 when `index.html` is missing;
  `scriptedPlayer` never exposes refused plays;
  the end-to-end `afterAll` waits 100 ms to dodge a Windows libuv abort at exit.
- Docs: `README.md` timings table delimiter row is mis-padded;
  the plan's Task 6 hazard paragraph still says "delay-0".
- Tests: a raw U+200B literal in `sessions.test.mts`;
  a few lines over 100 columns;
  some single-seed or breadth gaps listed in the per-task reviews.
