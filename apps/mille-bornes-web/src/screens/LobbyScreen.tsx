import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { PendingSummary } from "@repo/mille-bornes-core/pendingView";
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
}


/** The most seats a game has. */
const maxSeats = 6;


/** The server's name limit (20 characters), as the field enforces it. */
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
    const { screen, api } = props;
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);

    const run = async (fn: (t: Api["trpc"]) => Promise<unknown>): Promise<void> => {
        if (busy) {
            return;
        }
        setBusy(true);
        setMessage(NoneOption.get());
        const result = await api.call(fn, voidWire);
        setBusy(false);
        if (!result.succeeded) {
            setMessage(new SomeOption(result.error));
        }
    };

    return (
        <section className="screen">
            <Notice text={Option.fromNullable(screen.notice)} />
            <h2>Lobby</h2>
            <MyName api={api} />
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
    text: Option<string>;
}


// The one-time message; dismissing it is local, the server has already
// forgotten it.
function Notice(props: NoticeProps): ReactElement | null {
    const [dismissed, setDismissed] = useState<Option<string>>(NoneOption.get());
    const { text } = props;
    if (text.isNone || (dismissed.isSome && dismissed.value === text.value)) {
        return null;
    }
    return (
        <div className="notice" role="status">
            <p className="notice-text">{text.value}</p>
            <button type="button" className="button" onClick={() => setDismissed(text)}>
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
    api: Api;
}


// The player's name as the server has it, with a form to change it.  The
// server gives the new name only through `session.me`, so it is fetched on
// mount and again after a rename.
function MyName(props: MyNameProps): ReactElement {
    const { api } = props;
    const fieldId = useId();
    const [name, setName] = useState<Option<string>>(NoneOption.get());
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const latest = useRef(0);

    // Only the newest answer counts, so a slow early reply cannot undo a rename.
    const refresh = async (): Promise<void> => {
        const mine = ++latest.current;
        try {
            const decoded = meSchema.safeParse(await api.trpc.session.me.query());
            if (decoded.success && mine === latest.current) {
                setName(new SomeOption(decoded.data.name));
            }
        }
        catch {
            // The lobby works without the name; the subscription reports
            // an invalid credential.
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

    const save = async (event: FormEvent): Promise<void> => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (trimmed === "") {
            setMessage(new SomeOption("Please type a name"));
            return;
        }
        setBusy(true);
        setMessage(NoneOption.get());
        const result = await api.call((t) => t.session.rename.mutate({ name: trimmed }), voidWire);
        setBusy(false);
        if (result.succeeded) {
            setEditing(false);
            await refresh();
        }
        else {
            setMessage(new SomeOption(result.error));
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
