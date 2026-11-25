# Carry-over from milestone 1 (core package) into milestone 2

Findings from the milestone 1 reviews that the server milestone should pick up.
Milestone 1 itself is complete:
`packages/mille-bornes-core`, branch `mille-bornes-2`.

## Server must-haves surfaced by the final review

- Add a redacted lobby view, for example `pendingViewFor(pending, viewer)`.
  `PendingGame.seats[].kind` reveals which seats are robots,
  so the server must never send a `PendingGame` to clients as-is.
- Export one "who may act now" helper (for example `nextActors(game)` or `robotMoves(game)`),
  extracted from the driver logic in `simulation.mts`.
  The server's timers and robot driver should reuse it instead of copying it.
- Add a single `broadcast(game, applied)` that returns, per player, the view and the redacted events.
  `Applied.events` is unredacted by default (`CardDrawn.card` is plaintext),
  so the server should only ever send what `broadcast` returns.
- Timers are driven by `phase`:
  run the full 5 s hazard-window timer even when nobody can answer
  (otherwise a fast close reveals that nobody holds the counter),
  then send `CloseHazardWindow`; send `CloseExtensionOffer` on the 30 s timeout; send `StartNextRace`.
- There is no single `applyCommand`; route to `applyPlayerCommand` or `applySystemCommand`.
- `ViewSeat` has no connected flag; the server must track presence.
- `Rejection` is plain JSON and safe to send over tRPC.

## Deferred minors worth revisiting

- `readiness` returns a bare `MalformedCommand` and drops `validateGameConfig`'s message (lobby UI may want the reason).
- Accent variants ("Zoe" and "Zoë") count as different names; `PlayerName.isSame` folds case and compatibility forms only.
- `contextFromView` / `contextFromGame` use `!` on a seat-name lookup;
  safe for engine states, throws for a hand-built view.
- Zod schemas for `PlayerView`, `GameEvent` and `Rejection` do not exist (only needed for tRPC `.output()` validation).
- `engine.mts` is about 470 lines; split the race lifecycle from the hazard-window and Extension handling if it grows.
- The `closeHazardWindow` fallback (discard an unlandable hazard) is not asserted unused in simulation;
  add an assertion that every simulated `CloseHazardWindow` emits `HazardLanded`.
- Deep-frozen random-policy game volume was reduced to keep the test suite near 20 s; the soak does not deep-freeze.
- Two validators describe a valid command (`schemas.mts` and `isWellFormed` in `rules.mts`); add a parity test.
- The score sheet of a decoded finished race is not cross-checked against the zones (display only).
- Commit trailers on several commits say `Claude Opus 5.5` (the model that did the work); the rest say `Claude Sonnet 5.5`.
