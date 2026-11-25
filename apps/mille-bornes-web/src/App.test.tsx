import { NoneOption, SomeOption } from "@repo/depot/option";
import { GameId } from "@repo/mille-bornes-core/ids";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App, type AppProps } from "./App.js";
import { type Credential } from "./api/credential.mjs";
import { createScreenStore, type ScreenStoreDeps } from "./state/screenStore.mjs";
import { okWire } from "./testing/fakeApi.mjs";
import { createFakeStore, type FakeStore } from "./testing/fakeStore.mjs";
import { createMemoryCredentials } from "./testing/memoryCredentials.mjs";
import { pendingViewForSeats } from "./testing/pendingFixtures.mjs";
import { annPlays } from "./testing/engineBatches.mjs";
import { createFakeEngine } from "./testing/fakeAudio.mjs";
import type { AudioEngine } from "./sound/audioEngine.mjs";
import { viewForSeats } from "./testing/viewFixtures.mjs";


const secretToken = "SECRET-TOKEN-12345";
const ann: Credential = { playerId: "p1", token: secretToken };


function lobby(notice: string | null = null): Screen {
    const dad = PlayerName.tryCreate("Dad").throwIfFailed();
    return {
        kind:  "Lobby",
        notice,
        games: [{
            id:            GameId.create(),
            length:        "Quick",
            organizerName: dad,
            seatNames:     [dad],
            isFull:        false
        }]
    };
}


function waiting(viewer: number): Screen {
    const { view } = pendingViewForSeats([{ name: "Ann" }, { name: "Bob" }], { viewer });
    return { kind: "Waiting", pending: view };
}


const playing: Screen = {
    kind:        "Playing",
    view:        viewForSeats(2),
    events:      [],
    connected:   null,
    timer:       null,
    isOrganizer: false,
    robots:      null
};


// Answers a tRPC batch request by the procedure named in its URL; an answer
// that is a Response is sent as it is.
type Answers = ReadonlyArray<readonly [procedure: string, answer: unknown]>;


type Fetch = (input: string, init?: RequestInit) => Promise<Response>;


function stubFetch(answers: Answers = []): Fetch {
    const byProcedure = new Map<string, unknown>([
        ["session.me", { playerId: "p1", name: "Ann" }],
        ...answers
    ]);
    return (input) => {
        for (const [procedure, answer] of byProcedure) {
            if (input.includes(procedure)) {
                return Promise.resolve(answer instanceof Response ?
                    answer :
                    Response.json([{ result: { data: answer } }]));
            }
        }
        return Promise.resolve(new Response("no such procedure", { status: 404 }));
    };
}


// The mock only uses the URL and the body, so the narrower signature is enough.
function forApi(fetch: Fetch): NonNullable<AppProps["fetch"]> {
    return fetch as unknown as NonNullable<AppProps["fetch"]>;
}


interface Created {
    store: FakeStore;
    deps:  ScreenStoreDeps;
}


function setup(initial?: Credential, answers?: Answers, audio?: AudioEngine) {
    const credentials = createMemoryCredentials(initial);
    const created: Created[] = [];
    const createStore = (deps: ScreenStoreDeps): FakeStore => {
        const store = createFakeStore();
        created.push({ store, deps });
        return store;
    };
    const fetch = vi.fn(stubFetch(answers));
    const props: AppProps = {
        credentials,
        createStore,
        fetch: forApi(fetch),
        ...(audio === undefined ? {} : { audio })
    };
    const view = render(<App {...props} />);
    const current = (): FakeStore => created[created.length - 1]!.store;
    return { credentials, created, current, fetch, props, view, user: userEvent.setup() };
}


afterEach(() => {
    vi.useRealTimers();
});


describe("App", () => {

    describe("without a credential", () => {

        it("shows the title and the name entry screen and creates no store", () => {
            const { created } = setup();
            expect(screen.getByRole("heading", { name: "Mille Bornes", level: 1 }))
            .toBeInTheDocument();
            expect(screen.getByLabelText("Your name")).toBeInTheDocument();
            expect(screen.getByRole("main")).toBeInTheDocument();
            expect(created).toHaveLength(0);
        });


        it("creates the session over the real API, saves the credential and starts the store",
           async () => {
               const { created, credentials, fetch, user } = setup(undefined, [
                   ["session.create", okWire({ playerId: "p1", token: secretToken, name: "Ann" })]
               ]);
               await user.type(screen.getByLabelText("Your name"), "Ann");
               await user.click(screen.getByRole("button", { name: "Join" }));

               await screen.findByText("Connecting...");
               expect(credentials.load()).toEqual(new SomeOption(ann));
               expect(created).toHaveLength(1);
               expect(created[0]!.store.start).toHaveBeenCalledTimes(1);
               expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();

               const request = fetch.mock.calls.find((c) => c[0].includes("session.create"));
               expect(request?.[1]?.body).toContain("Ann");
           });


        it("shows the server's refusal and stays on name entry", async () => {
            const { created, user } = setup(undefined, [
                ["session.create", { succeeded: false, error: "That name is taken." }]
            ]);
            await user.type(screen.getByLabelText("Your name"), "Ann");
            await user.click(screen.getByRole("button", { name: "Join" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("That name is taken.");
            expect(screen.getByLabelText("Your name")).toHaveValue("Ann");
            expect(created).toHaveLength(0);
        });

    });


    describe("with a stored credential", () => {

        it("skips name entry, starts the store and shows Connecting...", () => {
            const { created } = setup(ann);
            expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
            expect(screen.getByText("Connecting...")).toBeInTheDocument();
            expect(created).toHaveLength(1);
            expect(created[0]!.store.start).toHaveBeenCalledTimes(1);
        });


        it("shows the lobby when the server sends a Lobby screen", async () => {
            const { current } = setup(ann);
            act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
            expect(screen.getByRole("heading", { name: "Lobby" })).toBeInTheDocument();
            expect(screen.getByRole("listitem", { name: "Dad's game" })).toBeInTheDocument();
            expect(await screen.findByText("Ann")).toBeInTheDocument();
            expect(screen.queryByText("Connecting...")).not.toBeInTheDocument();
        });


        it("shows the waiting room for a Waiting screen, then the lobby with its notice", async () => {
            const { current } = setup(ann);
            act(() => current().set({ screen: new SomeOption(waiting(0)), status: "Live" }));
            expect(screen.getByRole("heading", { name: "Your game" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Start game" })).toBeEnabled();

            act(() => current().set({
                screen: new SomeOption(lobby("The organizer ended the game.")),
                status: "Live"
            }));
            expect(screen.getByRole("heading", { name: "Lobby" })).toBeInTheDocument();
            expect(screen.queryByRole("heading", { name: "Your game" })).not.toBeInTheDocument();
            expect(within(screen.getByRole("main")).getByRole("status"))
            .toHaveTextContent("The organizer ended the game.");
            await screen.findByText("Ann");
        });


        it("shows the joiner's waiting room for a joiner", () => {
            const { current } = setup(ann);
            act(() => current().set({ screen: new SomeOption(waiting(1)), status: "Live" }));
            expect(screen.getByText(/waiting for/iu))
            .toHaveTextContent("Waiting for Ann to start the game...");
            expect(screen.getByRole("button", { name: "Leave game" })).toBeInTheDocument();
        });


        it("shows the game table for a Playing screen", () => {
            const { current } = setup(ann);
            act(() => current().set({ screen: new SomeOption(playing), status: "Live" }));
            const main = within(screen.getByRole("main"));
            expect(main.getByRole("region", { name: "Your hand" })).toBeInTheDocument();
            expect(main.getByText("Your turn: play or discard a card")).toBeInTheDocument();
            expect(main.getAllByRole("progressbar")).toHaveLength(2);
        });


        it("animates the store's pending batch and consumes it", async () => {
            const { current } = setup(ann);
            const { view, events } = annPlays({ type: "Drive", card: "50" });
            act(() => current().set({
                screen:        new SomeOption({ ...playing, view, events }),
                status:        "Live",
                pendingEvents: [{ id: 3, events }]
            }));
            await waitFor(() => expect(current().consumeEvents).toHaveBeenCalledWith(3));
            expect(screen.getByText("You drove 50 miles.")).toBeInTheDocument();
        });


        it("shows the lobby notice and nothing else leaks the credential", async () => {
            const { current, view } = setup(ann);
            act(() => current().set({
                screen: new SomeOption(lobby("The organizer ended the game.")),
                status: "Live"
            }));
            await screen.findByText("Ann");
            // The connection banner's status region is outside `main`.
            expect(within(screen.getByRole("main")).getByRole("status"))
            .toHaveTextContent("The organizer ended the game.");

            expect(view.container.textContent).not.toContain(secretToken);
            for (const element of view.container.querySelectorAll("*")) {
                for (const attribute of element.attributes) {
                    expect(attribute.value).not.toContain(secretToken);
                }
            }
        });

    });


    describe("when the server says the credential is not valid", () => {

        it("clears it and returns to name entry when the subscription reports it", () => {
            const { created, credentials } = setup(ann);
            act(() => created[0]!.deps.onUnauthorized());
            expect(screen.getByLabelText("Your name")).toBeInTheDocument();
            expect(credentials.load()).toEqual(NoneOption.get());
            expect(created[0]!.store.stop).toHaveBeenCalled();
        });


        it("clears it when a call is answered with UNAUTHORIZED", async () => {
            const unauthorized = Response.json([{
                error: {
                    message: "x",
                    code:    -32001,
                    data:    { code: "UNAUTHORIZED", httpStatus: 401 }
                }
            }], { status: 401 });
            const { created, credentials, current, user } = setup(
                ann,
                [["lobby.createGame", unauthorized]]
            );
            act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
            await user.click(screen.getByRole("button", { name: "Start a new game" }));
            expect(await screen.findByLabelText("Your name")).toBeInTheDocument();
            expect(credentials.load()).toEqual(NoneOption.get());
            expect(created[0]!.store.stop).toHaveBeenCalled();
        });

    });


    describe("a name lookup answered with UNAUTHORIZED", () => {

        it("returns to name entry like any other call", async () => {
            const unauthorized = Response.json([{
                error: {
                    message: "x",
                    code:    -32001,
                    data:    { code: "UNAUTHORIZED", httpStatus: 401 }
                }
            }], { status: 401 });
            const { credentials, current } = setup(ann, [["session.me", unauthorized]]);
            act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
            expect(await screen.findByLabelText("Your name")).toBeInTheDocument();
            expect(credentials.load()).toEqual(NoneOption.get());
        });

    });


    describe("the connection banner", () => {

        it("has a status region before any outage, fills it while reconnecting, then empties it",
           () => {
               const { current } = setup(ann);
               act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
               const region = screen.getByRole("status");
               expect(region).toBeEmptyDOMElement();

               act(() => current().set({ status: "Reconnecting" }));
               expect(region).toHaveTextContent("Reconnecting...");

               act(() => current().set({ status: "Live" }));
               expect(region).toBeEmptyDOMElement();
           });


        it("appears while reconnecting and goes away when live", () => {
            const { current } = setup(ann);
            act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
            expect(screen.queryByText("Reconnecting...")).not.toBeInTheDocument();

            act(() => current().set({ status: "Reconnecting" }));
            expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
            // The lobby stays on screen under the banner.
            expect(screen.getByRole("heading", { name: "Lobby" })).toBeInTheDocument();

            act(() => current().set({ status: "Live" }));
            expect(screen.queryByText("Reconnecting...")).not.toBeInTheDocument();
        });


        it("says the connection was lost after 10 seconds, and clears on recovery", () => {
            vi.useFakeTimers();
            const { current } = setup(ann);
            act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
            act(() => current().set({ status: "Reconnecting" }));

            act(() => void vi.advanceTimersByTime(9_999));
            expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
            expect(screen.queryByText("Lost connection, trying again")).not.toBeInTheDocument();

            act(() => void vi.advanceTimersByTime(1));
            expect(screen.getByText("Lost connection, trying again")).toBeInTheDocument();
            expect(screen.queryByText("Reconnecting...")).not.toBeInTheDocument();

            act(() => current().set({ status: "Live" }));
            expect(screen.queryByText("Lost connection, trying again")).not.toBeInTheDocument();

            // A second outage starts the 10 seconds again.
            act(() => current().set({ status: "Reconnecting" }));
            expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
        });


        it("stops its timer when the app goes away", () => {
            vi.useFakeTimers();
            const { current, view } = setup(ann);
            act(() => current().set({ status: "Reconnecting" }));
            expect(vi.getTimerCount()).toBeGreaterThan(0);
            view.unmount();
            expect(vi.getTimerCount()).toBe(0);
        });


        it("also shows over the Connecting screen before any screen arrived", () => {
            const { current } = setup(ann);
            act(() => current().set({ status: "Reconnecting" }));
            expect(screen.getByText("Connecting...")).toBeInTheDocument();
            expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
        });

    });


    describe("sound", () => {

        const muteButton = (): HTMLElement => within(screen.getByRole("banner"))
        .getByRole("button", { name: /mute sounds$/iu });


        it("puts the mute button in the header of every screen", () => {
            const { current, view } = setup(ann);
            act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
            expect(muteButton()).toBeInTheDocument();
            act(() => current().set({ screen: new SomeOption(waiting(0)), status: "Live" }));
            expect(muteButton()).toBeInTheDocument();
            act(() => current().set({ screen: new SomeOption(playing), status: "Live" }));
            expect(muteButton()).toBeInTheDocument();
            view.unmount();
            setup();
            expect(muteButton()).toBeInTheDocument();
        });


        it("keeps the mute choice and the one engine across screens", async () => {
            const audio = createFakeEngine();
            const { current, user } = setup(ann, undefined, audio);
            act(() => current().set({ screen: new SomeOption(lobby()), status: "Live" }));
            await user.click(muteButton());
            expect(audio.muted).toBe(true);
            act(() => current().set({ screen: new SomeOption(playing), status: "Live" }));
            expect(muteButton()).toHaveAccessibleName("Unmute sounds");
        });


        it("unlocks the audio on the first tap anywhere", () => {
            const audio = createFakeEngine();
            setup(ann, undefined, audio);
            expect(audio.unlocks).not.toHaveBeenCalled();
            fireEvent.pointerUp(document.body);
            expect(audio.unlocks).toHaveBeenCalled();
        });


        it("plays a pending batch's sounds, and none for a screen that brings no batch", async () => {
            const audio = createFakeEngine();
            const { current } = setup(ann, undefined, audio);
            const { view, events } = annPlays({ type: "Drive", card: "50" });
            act(() => current().set({
                screen: new SomeOption({ ...playing, view, events }),
                status: "Live"
            }));
            expect(audio.played).not.toHaveBeenCalled();
            act(() => current().set({
                screen:        new SomeOption({ ...playing, view, events }),
                status:        "Live",
                pendingEvents: [{ id: 3, events }]
            }));
            await waitFor(() => expect(audio.played).toHaveBeenCalledWith("drive"));
            expect(audio.played).toHaveBeenCalledTimes(1);
        });

    });


    describe("under StrictMode", () => {

        it("starts, stops and starts the real store and then shows the lobby", async () => {
            interface Callbacks {
                onData: (s: Screen) => void;
            }
            const callbacks: Callbacks[] = [];
            const unsubscribe = vi.fn();
            const subscribe = vi.fn((_input: unknown, cb: Callbacks) => {
                callbacks.push(cb);
                return { unsubscribe };
            });
            const props: AppProps = {
                credentials: createMemoryCredentials(ann),
                fetch:       forApi(stubFetch()),
                createStore: (deps) => createScreenStore({
                    ...deps,
                    api: {
                        ...deps.api,
                        trpc: { watch: { subscribe } }
                    } as unknown as typeof deps.api
                })
            };
            render(<StrictMode><App {...props} /></StrictMode>);

            expect(screen.getByText("Connecting...")).toBeInTheDocument();
            // Every subscription but the newest one has been closed.
            const live = subscribe.mock.calls.length - unsubscribe.mock.calls.length;
            expect(live).toBe(1);

            act(() => callbacks[callbacks.length - 1]!.onData(lobby()));
            await waitFor(() => {
                expect(screen.getByRole("heading", { name: "Lobby" })).toBeInTheDocument();
            });
        });

    });

});
