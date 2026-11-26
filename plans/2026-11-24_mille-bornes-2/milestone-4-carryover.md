# Carry-over from milestone 3 (web client) into milestone 4 (rehearsal and cleanup)

Milestone 3 is complete:
`apps/mille-bornes-web`, branch `mille-bornes-2`.
Everything below is for the rehearsal with real phones and for later polish.

## Before the party

- Play a full game with several real phones on the home network.
  The web app has only ever run in desktop Chromium with phone-sized windows, never on iOS Safari or a real Android phone.
  Things to watch:
  - the 320 px layout and the pinned hand with the Discard button;
  - card animations and the hazard card hold;
  - long-press card help and the "What's this?" button;
  - audio unlock on iOS (the unlock listeners stay for the whole session);
  - phones locking mid-game and reconnecting.
- Listen to the synthesized sounds and say which are not funny enough.
  The recipes live in `apps/mille-bornes-web/src/sound/soundPack.mts`; any one can be replaced by a recorded clip later.
- Start the server and open it from a phone: `npm run build`, then `npm start -w @repo/mille-bornes-game-server`, then scan the QR code on `http://localhost:3000/host`.
- Delete the three old projects (`packages/mille-bornes-shared`, `packages/mille-bornes-engine`, `apps/mille-bornes-server`) once nothing depends on them, and update the root README if it mentions them.

## Small follow-ups from the last review (all minor)

- Move the root error boundary to `main.tsx`, around `<App />` inside `StrictMode`.
  Today `App` reads `window.localStorage` in a `useState` initializer outside the boundary, so blocked site storage would still give a white page.
- In `api.call`, create the timer first and call `fn(trpc)` inside the `try`, so a synchronous throw becomes a failed `Result` instead of an unhandled rejection.
- Add `gap: var(--space-2)` to `.hand-actions`, so a mis-tap on Play (which cannot be undone) is less likely.
- Re-run the Discard uncover scroll when the playing batch changes (`started`), because the last-move line can re-wrap after a pick-up.
- The `ErrorBoundary` JSDoc says "Nothing is logged", but React 18 logs caught errors itself; it should also say that errors in event handlers and async code are not caught.
- One layout e2e check failed once in 23 repeats (Discard under the hand at y=488) and was never reproduced; its failure message now includes the hand position and scroll state, so a repeat will say what happened.

## Deferred earlier (unchanged)

- Keeping phones awake: the Screen Wake Lock API needs HTTPS; a muted hidden looping video (the NoSleep.js technique) is the fallback on plain HTTP.
- Card labels and the "Blocks it!" badge stay at about 10 px because bigger labels break mid-word in the 320 px cards; bigger labels need wider cards.
- No e2e covers the Extension offer or "Stop here" (unit tests with real engine states do).
- Score sheet rows show points only (counts such as "2 × 100" would be clearer); `EndGameDialog` duplicates the waiting-room cancel dialog; events say "Team N" instead of "your team".
- Server: the deferred minors listed in `milestone-3-carryover.md` still apply.

## Added after the first phone tests

- Sound in iOS Safari: the owner later reported it works now, and wants to come back to it.
  If it fails again, try starting the silent looping `<audio>` element in addition to `navigator.audioSession.type = "playback"`.
- Animations were reworked (stable layout, longer eased flights, the table shows a card's result when its card lands).
  Measured only in desktop Chromium, also with 4x CPU throttling.
  Judge it on a real phone, especially the cost of one synchronous render per landing (`flushSync` in `useAnimator`).
- The Coup Fourre window is now 8 seconds, and a hazard whose safety is already played lands at once.
- The hand is docked in two rows with the buttons in a right column; with large system text or zoom it needs more rows than before.
- The hazard banner overlays the top bar, and the pinned hazard card covers the hit team's miles during the window.
- Known small gaps:
  a status chip wrapping in a lane still shifts the table by about 21 px;
  a drawn card can flicker back into hiding if a hazard window ends before its flight lands;
  the first batch of a game or a race is shown live.
