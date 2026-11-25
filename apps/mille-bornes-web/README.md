# Mille Bornes web app

The phone client for a Mille Bornes game night.
Each player opens it in a phone's browser;
the game server (`apps/mille-bornes-game-server`) serves it
and referees every game.
It is a React app built with Vite.

## Running a game night

From the repository root:

```powershell
npm run build
npm start -w @repo/mille-bornes-game-server
```

`npm run build` builds the web app together with the server,
and the server serves the built app from `apps/mille-bornes-web/dist`
without any setting.
The server prints the addresses that phones on the same network can open.
On the computer that runs it,
open `http://localhost:3000/host`:
it shows each address with a QR code for the players to scan,
and every game with an End game button.

At the table a player taps a card, then where it goes.
A long press on a card explains it,
and so does the **What's this?** button beside Play once a card is picked up
(the way in from a keyboard, too).

## Development

Start the game server in one terminal
(build it first with `npm run build` at the repository root):

```powershell
npm start -w @repo/mille-bornes-game-server
```

and the Vite dev server in another:

```powershell
npm run dev -w @repo/mille-bornes-web
```

The dev server reloads the app as you edit it
and passes `/trpc` on to the game server at `http://localhost:3000`.
To try the app on a phone on the same network,
start the dev server from this directory with `npm run dev -- --host`
and open the network address it prints.

While the game server is down,
the dev server prints `http proxy error:` with the address it could not reach.
For the game's event stream that address carries the player's credential
(a browser's event stream cannot send it in a header),
so the token shows in the dev terminal.
Only `npm run dev` does this;
the game server never logs an address.

## Tests

```powershell
npm test -w @repo/mille-bornes-web
```

runs the unit and component tests (Vitest and jsdom).

```powershell
npm run e2e -w @repo/mille-bornes-web
```

runs the end-to-end tests in `e2e/` with Playwright:
several phone-sized Chromium pages play against the real game server.
It first builds the web app, the server and what they use,
then starts a server of its own for each test,
on a free port with a temporary data directory
and timings short enough that a whole game takes seconds
(see the `MB_*_MS` variables in the server's README).
It is not part of `npm run all`.
It needs Playwright's Chromium, installed once with:

```powershell
npx playwright install chromium
```

If the download fails with `unable to get local issuer certificate`
(a network that inspects TLS with its own certificate),
let Node use the system's certificates:

```powershell
$env:NODE_OPTIONS = "--use-system-ca"; npx playwright install chromium
```

A failed test leaves a trace, the server's log and its data
in its folder under `test-results/`;
`npx playwright show-trace <trace.zip>` replays the trace.

## Customizing

- **Card faces:** `cardFace()` in `src/text/cardFace.mts` is the one place
  that maps a card to its emoji, label and help sentence.
  Replace it to draw cards another way.
- **Sounds:** `soundPack` in `src/sound/soundPack.mts` maps each named sound
  to a small Web Audio recipe.
  Change a recipe, or replace it with a recorded clip.

## Known gaps

- Phones are not kept awake during a game (deferred by the owner).
  A phone that locks reconnects when it wakes
  and shows the game as it is then.
- The synthesized sounds have not been judged by the owner yet.
- Dimmed cards are marked `aria-disabled`,
  but they can still be tapped:
  the tap explains why the card cannot be played
  and, on the player's own turn, picks it up to discard it.
  A screen reader therefore announces them as unavailable.
- On a screen shorter than the table (a 320 x 568 phone, say),
  the hand stays at the bottom while the rest scrolls under it.
  Picking up a card scrolls its Discard and lane buttons out from under the hand,
  which can scroll the top lane out of view above.
