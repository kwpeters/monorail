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
import { MuteButton } from "./sound/MuteButton.js";
import { SoundProvider } from "./sound/SoundProvider.js";
import { useAudioEngine } from "./sound/useSound.js";
import type { AudioEngine } from "./sound/audioEngine.mjs";
import {
    SessionProvider,
    useSession,
    type SessionProviderProps
} from "./session/SessionProvider.js";
import { useScreen } from "./state/useScreen.js";
import type { ScreenStore, Snapshot } from "./state/screenStore.mjs";


/** Options for tests; the real app passes none. */
export interface AppProps {
    /** Default: a store over `window.localStorage`. */
    credentials?: CredentialStore;
    fetch?:       SessionProviderProps["fetch"];
    createStore?: SessionProviderProps["createStore"];
    /** Default: the browser's Web Audio engine over `window.localStorage`. */
    audio?:       AudioEngine;
}


/**
 * The root component of the Mille Bornes web client: name entry until the
 * player has a credential, then the screen the server sends.  One audio
 * engine serves the whole session, so the mute choice survives screens.
 * @param props - Test hooks
 * @returns The rendered app
 */
export function App(props: AppProps): ReactElement {
    const [credentials] = useState(
        () => props.credentials ?? createCredentialStore(window.localStorage)
    );
    return (
        <SoundProvider {...(props.audio === undefined ? {} : { engine: props.audio })}>
            <SessionProvider
                credentials={credentials}
                {...(props.fetch === undefined ? {} : { fetch: props.fetch })}
                {...(props.createStore === undefined ? {} : { createStore: props.createStore })}
            >
                <Routes />
            </SessionProvider>
        </SoundProvider>
    );
}


// Name entry without a credential, otherwise the followed screen.
function Routes(): ReactElement {
    const session = useSession();
    const mute = <MuteButton engine={useAudioEngine()} />;
    if (session.active.isNone) {
        return (
            <Shell controls={mute}>
                <NameEntryScreen api={session.api} onSignedIn={session.signIn} />
            </Shell>
        );
    }
    return <Following store={session.active.value.store} api={session.api} mute={mute} />;
}


interface FollowingProps {
    store: ScreenStore;
    api:   Api;
    mute:  ReactElement;
}


function Following(props: FollowingProps): ReactElement {
    const snapshot = useScreen(props.store);
    return (
        <Shell controls={props.mute} banner={<ConnectionBanner status={snapshot.status} />}>
            {snapshot.screen.isNone ?
                <section className="screen"><p>Connecting...</p></section> :
                screenFor(snapshot.screen.value, props.api, snapshot, props.store)}
        </Shell>
    );
}


// One exhaustive switch: a new kind of Screen is a compile error until it
// has a component.
function screenFor(
    screen: Screen,
    api: Api,
    snapshot: Snapshot,
    store: ScreenStore
): ReactElement {
    switch (screen.kind) {
        case "Lobby":
            return <LobbyScreen screen={screen} api={api} />;
        case "Waiting":
            return <WaitingScreen screen={screen} api={api} />;
        case "Playing":
            return (
                <GameScreen
                    screen={screen}
                    api={api}
                    pendingEvents={snapshot.pendingEvents}
                    consumeEvents={store.consumeEvents}
                />
            );
    }
}
