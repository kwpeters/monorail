import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { PendingSummary } from "@repo/mille-bornes-core/pendingView";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { pickWhimsicalName } from "@repo/mille-bornes-core/whimsicalNames";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import {
    useEffect,
    useId,
    useRef,
    useState,
    type FormEvent,
    type ReactElement
} from "react";
import { type Api } from "../api/client.mjs";
import { meSchema, voidWire } from "../api/outcomes.mjs";


/** The server's `Lobby` screen. */
export type LobbyData = Extract<Screen, { kind: "Lobby" }>;


/** What `LobbyScreen` needs. */
export interface LobbyScreenProps {
    screen: LobbyData;
    api:    Api;
    /** Returns a number from 0 (included) to 1 (excluded); tests inject one. */
    rand?:  (() => number) | undefined;
}


/** The most seats a game has. */
const maxSeats = 6;


/**
 * The server's name limit is 20 code points; `maxLength` counts UTF-16
 * units, so the field is only ever stricter than the server (an emoji counts
 * as two).
 */
const maxNameLength = 20;


/**
 * The lobby: who you are, the games waiting for players, and a button to start
 * a new one.  Names and messages from the server are always rendered as text.
 * Joining or starting a game moves this player to another screen through the
 * subscription, so success needs no handling here; a refusal shows the
 * server's message.
 * @param props - The Lobby screen and the API
 * @returns The screen
 */
export function LobbyScreen(props: LobbyScreenProps): ReactElement {
    const { screen, api, rand } = props;
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);

    // Set before the first await: two taps in the same tick send one request.
    const inFlight = useRef(false);

    const run = async (fn: (t: Api["trpc"]) => Promise<unknown>): Promise<void> => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setBusy(true);
        setMessage(NoneOption.get());
        try {
            const result = await api.call(fn, voidWire);
            if (!result.succeeded) {
                setMessage(new SomeOption(result.error));
            }
        }
        finally {
            // eslint-disable-next-line require-atomic-updates -- only cleared here
            inFlight.current = false;
            setBusy(false);
        }
    };

    return (
        <section className="screen">
            <Notice screen={screen} />
            <h2>Lobby</h2>
            <MyName api={api} games={screen.games} rand={rand} />
            <h3>Games waiting for players</h3>
            {screen.games.length === 0 ?
                <p className="empty">No games yet. Start one!</p> :
                <ul className="game-list">
                    {screen.games.map((game) => (
                        <GameRow
                            key={game.id}
                            game={game}
                            busy={busy}
                            onJoin={() => void run((t) => t.lobby.join.mutate({ gameId: game.id }))}
                        />
                    ))}
                </ul>}
            {message.isSome ? <p className="error" role="alert">{message.value}</p> : null}
            <button
                type="button"
                className="button primary big"
                disabled={busy}
                onClick={() => void run((t) => t.lobby.createGame.mutate())}
            >
                Start a new game
            </button>
        </section>
    );
}


interface NoticeProps {
    screen: LobbyData;
}


// The server sends a notice once, and the next Lobby screen (another player
// starting a game, say) carries none.  So the notice is kept here from the
// moment it arrives until the player dismisses it.  A later screen with a
// notice shows it again, even when the text is the same: the effect is keyed
// on the screen object, not on the text.
function Notice(props: NoticeProps): ReactElement | null {
    const { screen } = props;
    const [shown, setShown] = useState<Option<string>>(() => Option.fromNullable(screen.notice));

    useEffect(() => {
        const arrived = Option.fromNullable(screen.notice);
        if (arrived.isSome) {
            setShown(arrived);
        }
    }, [screen]);

    if (shown.isNone) {
        return null;
    }
    return (
        <div className="notice" role="status">
            <p className="notice-text">{shown.value}</p>
            <button type="button" className="button" onClick={() => setShown(NoneOption.get())}>
                Dismiss
            </button>
        </div>
    );
}


interface GameRowProps {
    game:   PendingSummary;
    busy:   boolean;
    onJoin: () => void;
}


function GameRow(props: GameRowProps): ReactElement {
    const { game, busy, onJoin } = props;
    const titleId = useId();
    return (
        <li className="game" aria-labelledby={titleId}>
            <div className="game-info">
                <h4 id={titleId} className="game-title truncate">{game.organizerName}'s game</h4>
                <ul className="seat-list" aria-label="Players">
                    {game.seatNames.map((seat, i) => (
                        <li key={`${i}-${seat}`} className="seat truncate">{seat}</li>
                    ))}
                </ul>
                <p className="game-meta">
                    <span className="chip">{game.length}</span>
                    {" "}
                    <span>{game.seatNames.length} of {maxSeats} seats</span>
                </p>
            </div>
            {game.isFull ?
                <button type="button" className="button" disabled>Full</button> :
                <button
                    type="button"
                    className="button primary"
                    disabled={busy}
                    aria-label={`Join ${game.organizerName}'s game`}
                    onClick={onJoin}
                >
                    Join
                </button>}
        </li>
    );
}


interface MyNameProps {
    api:   Api;
    games: ReadonlyArray<PendingSummary>;
    rand?: (() => number) | undefined;
}


const noFunnyNamesMessage = "No funny names are free right now. Please type one.";


// The names that cannot be offered; a string that is no valid name is skipped.
function parseNames(raws: ReadonlyArray<string>): Array<PlayerName> {
    return raws.flatMap((raw) => PlayerName.tryCreate(raw).match(
        (parsed) => [parsed],
        () => []
    ));
}


// The player's name as the server has it, with a form to change it.  The
// server gives the new name only through `session.me`, so it is fetched on
// mount and again after a rename.
function MyName(props: MyNameProps): ReactElement {
    const { api, games, rand } = props;
    const fieldId = useId();
    const [name, setName] = useState<Option<string>>(NoneOption.get());
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const latest = useRef(0);
    const saving = useRef(false);

    // Only the newest answer counts, so a slow early reply cannot undo a rename.
    const refresh = async (): Promise<void> => {
        const mine = ++latest.current;
        // `me` answers with a plain object, so it is wrapped as a succeeded
        // wire result to go through `call`, which also handles UNAUTHORIZED
        // like every other call.  Any other failure leaves the name as it was.
        const result = await api.call(
            async (t) => ({ succeeded: true, value: await t.session.me.query() }),
            meSchema
        );
        if (result.succeeded && mine === latest.current) {
            // An empty name is not worth a "Playing as" line.
            setName(result.value.name === "" ?
                NoneOption.get() :
                new SomeOption(result.value.name));
        }
    };

    useEffect(() => {
        void refresh();
        // The first fetch happens on mount, and once per API.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api]);

    useEffect(() => {
        if (editing) {
            input.current?.focus();
            input.current?.select();
        }
    }, [editing]);

    const open = (): void => {
        setDraft(name.defaultValue(""));
        setMessage(NoneOption.get());
        setEditing(true);
    };

    // Only fills the box: no server call.  The server still refuses a name that
    // is in use, so avoiding the names in view is a convenience.
    const surprise = (): void => {
        const taken = parseNames([
            ...name.match((n) => [n], () => []),
            ...games.flatMap((g) => g.seatNames),
            draft
        ]);
        pickWhimsicalName(taken, rand).match(
            (picked) => {
                setDraft(picked);
                setMessage(NoneOption.get());
            },
            () => setMessage(new SomeOption(noFunnyNamesMessage))
        );
    };

    const save = async (event: FormEvent): Promise<void> => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (trimmed === "") {
            setMessage(new SomeOption("Please type a name"));
            return;
        }
        if (saving.current) {
            return;
        }
        saving.current = true;
        setBusy(true);
        setMessage(NoneOption.get());
        try {
            const result = await api.call(
                (t) => t.session.rename.mutate({ name: trimmed }),
                voidWire
            );
            if (result.succeeded) {
                setEditing(false);
                await refresh();
            }
            else {
                setMessage(new SomeOption(result.error));
            }
        }
        finally {
            // eslint-disable-next-line require-atomic-updates -- only cleared here
            saving.current = false;
            setBusy(false);
        }
    };

    if (!editing) {
        return (
            <div className="my-name">
                {name.isSome ?
                    <p className="truncate">
                        Playing as <strong>{name.value}</strong>
                    </p> :
                    null}
                <button type="button" className="button" onClick={open}>Change name</button>
            </div>
        );
    }
    return (
        <form className="stack" onSubmit={(e) => void save(e)}>
            <label className="field-label" htmlFor={fieldId}>New name</label>
            <div className="input-row">
                <input
                    id={fieldId}
                    ref={input}
                    className="text-field"
                    type="text"
                    autoComplete="nickname"
                    maxLength={maxNameLength}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                />
                <button type="button" className="button" disabled={busy} onClick={surprise}>
                    Surprise me
                </button>
            </div>
            {message.isSome ? <p className="error" role="alert">{message.value}</p> : null}
            <div className="button-row">
                <button type="submit" className="button primary" disabled={busy}>Save</button>
                <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => setEditing(false)}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
