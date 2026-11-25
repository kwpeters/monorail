import { NoneOption, type Option, SomeOption } from "@repo/depot/option";
import { useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { type Api } from "../api/client.mjs";
import { type Credential } from "../api/credential.mjs";
import { sessionCreatedSchema } from "../api/outcomes.mjs";


/**
 * The server's name limit is 20 code points; `maxLength` counts UTF-16
 * units, so the field is only ever stricter than the server (an emoji counts
 * as two).
 */
const maxNameLength = 20;


/** Shown when Join is tapped with nothing typed. */
const emptyNameMessage = "Please type a name or tap Surprise me";


/** What `NameEntryScreen` needs. */
export interface NameEntryScreenProps {
    api: Api;

    /**
     * Called with the credential once the server has created the session.
     * @param credential - The new player id and token
     */
    onSignedIn: (credential: Credential) => void;
}


/**
 * Asks who is playing: a name for Join, or Surprise me for a name the server
 * picks.  A refusal shows under the field and keeps what was typed.
 * @param props - The API and the sign-in callback
 * @returns The screen
 */
export function NameEntryScreen(props: NameEntryScreenProps): ReactElement {
    const { api, onSignedIn } = props;
    const fieldId = useId();
    const messageId = useId();
    const [name, setName] = useState("");
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);

    // Set before the first await: two submits in the same tick send one request.
    const inFlight = useRef(false);

    // A name of None asks the server to pick one.
    const createSession = async (chosen: Option<string>): Promise<void> => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setBusy(true);
        setMessage(NoneOption.get());
        try {
            const result = await api.call(
                (t) => t.session.create.mutate({ name: chosen.toNullable(null) }),
                sessionCreatedSchema
            );
            if (result.succeeded) {
                onSignedIn({ playerId: result.value.playerId, token: result.value.token });
            }
            else {
                setMessage(new SomeOption(result.error));
            }
        }
        finally {
            // eslint-disable-next-line require-atomic-updates -- only cleared here
            inFlight.current = false;
            setBusy(false);
        }
    };

    const join = (event: FormEvent): void => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed === "") {
            setMessage(new SomeOption(emptyNameMessage));
            return;
        }
        void createSession(new SomeOption(trimmed));
    };

    return (
        <section className="screen">
            <h2>Welcome!</h2>
            <form className="stack" onSubmit={join}>
                <label className="field-label" htmlFor={fieldId}>Your name</label>
                <input
                    id={fieldId}
                    className="text-field"
                    type="text"
                    autoComplete="nickname"
                    maxLength={maxNameLength}
                    value={name}
                    aria-invalid={message.isSome}
                    aria-describedby={message.isSome ? messageId : undefined}
                    onChange={(e) => setName(e.target.value)}
                />
                {message.isSome ?
                    <p id={messageId} className="error" role="alert">{message.value}</p> :
                    null}
                <button type="submit" className="button primary" disabled={busy}>Join</button>
                <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => void createSession(NoneOption.get())}
                >
                    Surprise me
                </button>
            </form>
        </section>
    );
}
