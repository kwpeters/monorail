import { createCredentialStore, type CredentialStore } from "./api/credential.mjs";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { useState, type ReactElement } from "react";
import { type Api } from "./api/client.mjs";
import { ConnectionBanner } from "./screens/ConnectionBanner.js";
import { GameScreen } from "./screens/GameScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { NameEntryScreen } from "./screens/NameEntryScreen.js";
import { Shell } from "./screens/Shell.js";
import { WaitingScreen } from "./screens/WaitingScreen.js";
import {
    SessionProvider,
    useSession,
    type SessionProviderProps
} from "./session/SessionProvider.js";
import { useScreen } from "./state/useScreen.js";
import type { ScreenStore } from "./state/screenStore.mjs";


/** Options for tests; the real app passes none. */
export interface AppProps {
    /** Default: a store over `window.localStorage`. */
    credentials?: CredentialStore;
    fetch?:       SessionProviderProps["fetch"];
    createStore?: SessionProviderProps["createStore"];
}


/**
 * The root component of the Mille Bornes web client: name entry until the
 * player has a credential, then the screen the server sends.
 * @param props - Test hooks
 * @returns The rendered app
 */
export function App(props: AppProps): ReactElement {
    const [credentials] = useState(
        () => props.credentials ?? createCredentialStore(window.localStorage)
    );
    return (
        <SessionProvider
            credentials={credentials}
            {...(props.fetch === undefined ? {} : { fetch: props.fetch })}
            {...(props.createStore === undefined ? {} : { createStore: props.createStore })}
        >
            <Routes />
        </SessionProvider>
    );
}


// Name entry without a credential, otherwise the followed screen.
function Routes(): ReactElement {
    const session = useSession();
    if (session.active.isNone) {
        return (
            <Shell>
                <NameEntryScreen api={session.api} onSignedIn={session.signIn} />
            </Shell>
        );
    }
    return <Following store={session.active.value.store} api={session.api} />;
}


interface FollowingProps {
    store: ScreenStore;
    api:   Api;
}


function Following(props: FollowingProps): ReactElement {
    const snapshot = useScreen(props.store);
    return (
        <Shell banner={<ConnectionBanner status={snapshot.status} />}>
            {snapshot.screen.isNone ?
                <section className="screen"><p>Connecting...</p></section> :
                screenFor(snapshot.screen.value, props.api)}
        </Shell>
    );
}


// One exhaustive switch: a new kind of Screen is a compile error until it
// has a component.
function screenFor(screen: Screen, api: Api): ReactElement {
    switch (screen.kind) {
        case "Lobby":
            return <LobbyScreen screen={screen} api={api} />;
        case "Waiting":
            return <WaitingScreen screen={screen} api={api} />;
        case "Playing":
            return <GameScreen screen={screen} api={api} />;
    }
}
