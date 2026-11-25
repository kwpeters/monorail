import { NoneOption, type Option, SomeOption } from "@repo/depot/option";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
    type ReactElement,
    type ReactNode
} from "react";
import { createApi, type Api, type ApiDeps } from "../api/client.mjs";
import { type Credential, type CredentialStore } from "../api/credential.mjs";
import {
    createScreenStore,
    type ScreenStore,
    type ScreenStoreDeps
} from "../state/screenStore.mjs";


/** A signed-in player and the store that follows their screen. */
export interface ActiveSession {
    readonly credential: Credential;
    readonly store:      ScreenStore;
}


/** What `useSession()` gives a component. */
export interface Session {
    readonly api: Api;

    /** None until the player has a credential, and after UNAUTHORIZED. */
    readonly active: Option<ActiveSession>;

    /**
     * Saves a new credential and starts following the player's screen.
     * @param credential - What `session.create` answered with
     */
    signIn: (credential: Credential) => void;

    /** Forgets the credential, stops the store and returns to name entry. */
    signOut: () => void;
}


/** What `SessionProvider` needs. */
export interface SessionProviderProps {
    credentials: CredentialStore;

    /** Replaces the global `fetch`; for tests. */
    fetch?:       ApiDeps["fetch"];

    /** Replaces `createScreenStore`; for tests. */
    createStore?: (deps: ScreenStoreDeps) => ScreenStore;
    children:     ReactNode;
}


const SessionContext = createContext<Option<Session>>(NoneOption.get());


function sameCredential(a: Credential, b: Credential): boolean {
    return a.playerId === b.playerId && a.token === b.token;
}


// The credential and the one store per credential, outside React so that
// building them has no circular dependency on component state.
function createSessionController(props: SessionProviderProps) {
    // The session's own copy is the source of truth while the page is open, so
    // a storage that cannot save (private mode) still gives a working session:
    // the API sends it, and an UNAUTHORIZED answer is compared with it.  The
    // real store only carries the credential over to the next visit.
    let current = props.credentials.load();
    const credentials: CredentialStore = {
        load: () => current,
        save: (c) => {
            current = new SomeOption(c);
            props.credentials.save(c);
        },
        clear: () => {
            current = NoneOption.get();
            props.credentials.clear();
        }
    };
    const makeStore = props.createStore ?? createScreenStore;
    const listeners = new Set<() => void>();
    let active: Option<ActiveSession> = NoneOption.get();

    const setActive = (next: Option<ActiveSession>): void => {
        active = next;
        [...listeners].forEach((listener) => listener());
    };

    // Signs out, but only when `candidate` is the credential in use now.
    const signOutIfCurrent = (candidate: Credential): void => {
        const stored = credentials.load();
        if (stored.isSome && sameCredential(stored.value, candidate)) {
            credentials.clear();
            setActive(NoneOption.get());
        }
    };

    const api = createApi({
        credentials,
        ...(props.fetch === undefined ? {} : { fetch: props.fetch }),
        onUnauthorized: (used) => {
            if (used.isSome) {
                signOutIfCurrent(used.value);
            }
        }
    });

    const open = (credential: Credential): Option<ActiveSession> => {
        // The store compares with the credential it is made for.
        const store = makeStore({ api, onUnauthorized: () => signOutIfCurrent(credential) });
        return new SomeOption({ credential, store });
    };

    // A credential saved by an earlier visit starts the session at once.
    const saved = credentials.load();
    if (saved.isSome) {
        active = open(saved.value);
    }

    return {
        api,
        getSnapshot: (): Option<ActiveSession> => active,
        subscribe:   (listener: () => void): (() => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        signIn: (credential: Credential): void => {
            credentials.save(credential);
            setActive(open(credential));
        },
        signOut: (): void => {
            credentials.clear();
            setActive(NoneOption.get());
        }
    };
}


/**
 * Owns the credential and the screen store.  Exactly one store exists per
 * credential: it is created when the credential appears (not on each render),
 * started by an effect and stopped by the effect cleanup, so React
 * StrictMode's start, stop, start leaves it running.  An UNAUTHORIZED answer
 * signs out only if it concerns the credential that is stored now; a late
 * answer for an older credential is ignored.  The props are read once, at
 * the first render.
 * @param props - The credential store, the children and test hooks
 * @returns The provider
 */
export function SessionProvider(props: SessionProviderProps): ReactElement {
    const [controller] = useState(() => createSessionController(props));
    const active = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

    const store = active.isSome ? active.value.store : undefined;
    useEffect(() => {
        store?.start();
        return () => store?.stop();
    }, [store]);

    const session = useMemo((): Option<Session> => new SomeOption({
        api:     controller.api,
        active,
        signIn:  controller.signIn,
        signOut: controller.signOut
    }), [controller, active]);

    return (
        <SessionContext.Provider value={session}>
            {props.children}
        </SessionContext.Provider>
    );
}


/**
 * Gets the session of the nearest `SessionProvider`.
 * @returns The API, the active session and the sign in and out functions
 * @throws If there is no `SessionProvider` above the caller
 */
export function useSession(): Session {
    return useContext(SessionContext).throwIfNoneWith(() => "useSession needs a SessionProvider");
}
