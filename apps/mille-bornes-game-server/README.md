# Mille Bornes game server

The server for a Mille Bornes game night on one local network.
Players open it on their phones;
the computer that runs it shows the host page with a QR code.
It speaks tRPC over HTTP,
with one Server-Sent Events subscription per player.

## Running

From the repository root:

```powershell
npm run build -w @repo/mille-bornes-game-server
npm start -w @repo/mille-bornes-game-server
```

The server prints the URLs that phones on the network can open,
a QR code for the first one,
the data directory,
and the address of the host page.
Press Ctrl+C to stop it;
it waits for every save to finish before it exits.

## Environment variables

| Variable      | Default                              | Meaning                                                 |
| ------------- | ------------------------------------ | ------------------------------------------------------- |
| `PORT`        | `3000`                               | The port to listen on (1 to 65535), on all interfaces.  |
| `MB_DATA_DIR` | `apps/mille-bornes-game-server/data` | Where games and sessions are saved.                     |
| `MB_WEB_ROOT` | none                                 | The built web app to serve; without it `/` is a notice. |

An empty variable counts as unset.
The default data directory belongs to the package,
so the server finds its games wherever it is started from;
a relative `MB_DATA_DIR` is taken from the current directory.

## The data directory

| Path               | What it holds                                                     |
| ------------------ | ----------------------------------------------------------------- |
| `games/<id>.json`  | One pending, running or finished game.                            |
| `failed/<id>.json` | A game the server ended because it got stuck, kept for debugging. |
| `sessions.json`    | Every player's id, name and token.                                |

Each file is written to a `.tmp` file first and then renamed over the old one,
so a crash never leaves a half-written game.
At startup a leftover `.tmp` file is removed,
and a game file that cannot be read is skipped with a warning;
the other games still load.
A game's file is deleted when the game is cancelled or ended,
or when every human has left it after it is over.

## API

Everything is under `/trpc`.
Every mutation answers with a plain `Result`:
`{ succeeded: true, value }` or `{ succeeded: false, error }`,
where the error is a message to show the player.
tRPC errors are used only for a missing or bad credential (`UNAUTHORIZED`)
and malformed input (`BAD_REQUEST`).

| Procedure            | Kind         | Input                        | What it does                                   |
| -------------------- | ------------ | ---------------------------- | ---------------------------------------------- |
| `session.create`     | mutation     | `{ name }`, name may be null | Signs up; returns `{ playerId, token, name }`. |
| `session.rename`     | mutation     | `{ name }`                   | Changes the player's name.                     |
| `session.me`         | query        | none                         | Returns `{ playerId, name }`.                  |
| `lobby.createGame`   | mutation     | none                         | Opens a game with the caller as organizer.     |
| `lobby.join`         | mutation     | `{ gameId }`                 | Takes a seat in an open game.                  |
| `pending.leave`      | mutation     | none                         | Leaves the game being set up.                  |
| `pending.cancel`     | mutation     | none                         | The organizer cancels the game.                |
| `pending.addRobot`   | mutation     | none                         | The organizer adds a robot.                    |
| `pending.removeSeat` | mutation     | `{ seat }`                   | Removes a seat (the organizer, or oneself).    |
| `pending.swapSeats`  | mutation     | `{ a, b }`                   | The organizer swaps two seats.                 |
| `pending.setLength`  | mutation     | `{ length }`                 | The organizer sets Quick, Short or Full.       |
| `pending.start`      | mutation     | none                         | The organizer deals the first race.            |
| `game.play`          | mutation     | a `PlayerCommand`            | Plays a move.                                  |
| `game.end`           | mutation     | none                         | The organizer ends the game for everyone.      |
| `game.leave`         | mutation     | none                         | Goes back to the lobby after the game.         |
| `watch`              | subscription | none                         | Streams the player's `Screen`.                 |

`watch` first sends the current screen
(the lobby, a waiting room, or the game),
then each later one.
Missed events are not replayed,
so a phone that reconnects lands on the current state.

## The credential

`session.create` returns a `playerId` and a `token`.
Every later call sends them as the header
`Authorization: Bearer <playerId>.<token>`.
A browser's `EventSource` cannot set headers,
so the `watch` subscription sends the same string
as the tRPC connection parameter `authorization`.
The token never appears in a screen, a log line or an error message.

## The host page

`/host` lists the addresses with their QR codes
and every game with an End game button.
It answers only requests from the computer that runs the server:
the connection must come from a loopback address
and the `Host` header must be `localhost`, `127.0.0.1` or `[::1]`.
A phone on the network gets 403.

## Timings

The timings are the `defaultTimings` in `src/config.mts`;
change them there and rebuild.
Tests build their own `ServerConfig` with shorter ones.

| Timing              | Default | What it is                                                  |
| ------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `hazardWindowMs`    | 5,000   | How long the target team has to play a Coup Fourre.         |
| `extensionOfferMs`  | 30,000  | How long the decider has to call or decline Extension.      |
| `raceOverPauseMs`   | 20,000  | How long the scores show before the next race is dealt.     |
| `robotDelayMinMs`   | 1,000   | The shortest wait before a robot plays or answers.          |
| `robotDelayMaxMs`   | 3,000   | The longest wait before a robot plays or answers.           |
| `disconnectGraceMs` | 3,000   | How long after a dropped connection a player is shown gone. |

A robot answers a Coup Fourre window at once,
but the window always runs its full length,
so its length reveals nothing about anyone's hand.

## Tests

```powershell
npm test -w @repo/mille-bornes-game-server
```

`src/endToEnd.test.mts` runs whole games against a real server
on an ephemeral port,
using the scripted client in `src/scriptedPlayer.mts`.
