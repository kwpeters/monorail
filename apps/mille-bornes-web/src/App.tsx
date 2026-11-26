import { createCredentialStore, type CredentialStore } from "./api/credential.mjs";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { useLayoutEffect, useState, type ReactElement } from "react";
import { type Api } from "./api/client.mjs";
import { ConnectionBanner } from "./screens/ConnectionBanner.js";
import { ErrorBoundary } from "./screens/ErrorBoundary.js";
import { GameScreen, hidesShellBar } from "./screens/GameScreen.js";
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
    // The last resort: anything that throws outside a screen gets a page with
    // words and a Reload button, not a blank one.
    return (
        <ErrorBoundary>
            <SoundProvider {...(props.audio === undefined ? {} : { engine: props.audio })}>
                <SessionProvider
                    credentials={credentials}
                    {...(props.fetch === undefined ? {} : { fetch: props.fetch })}
                    {...(props.createStore === undefined ? {} : { createStore: props.createStore })}
                >
                    <Routes />
                </SessionProvider>
            </SoundProvider>
        </ErrorBoundary>
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


// Which screen is up, as far as scrolling goes: the table is one place
// through all its moves, and a race or game summary is another.
function placeOf(screen: Screen): string {
    if (screen.kind !== "Playing") {
        return screen.kind;
    }
    const phase = screen.view.phase.kind;
    return phase === "RaceOver" || phase === "GameOver" ? phase : "Table";
}


function Following(props: FollowingProps): ReactElement {
    const snapshot = useScreen(props.store);
    const place = snapshot.screen.match(placeOf, () => "Connecting");

    // One document shows every screen, so a new one would open where the
    // last one was scrolled to (the table under Start game, say).  Before
    // paint, so the new screen is never drawn once at the old position.
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [place]);

    return (
        <Shell
            controls={props.mute}
            banner={<ConnectionBanner status={snapshot.status} />}
            hideBar={snapshot.screen.match(hidesShellBar, () => false)}
        >
            {/* A screen that throws keeps the header (if it has one) and the
                banner; the next screen from the server tries again. */}
            <ErrorBoundary resetKey={snapshot.screen}>
                {snapshot.screen.isNone ?
                    <section className="screen"><p>Connecting...</p></section> :
                    screenFor(snapshot.screen.value, props.api, snapshot, props.store)}
            </ErrorBoundary>
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
