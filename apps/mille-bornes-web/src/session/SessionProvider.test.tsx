import { NoneOption, SomeOption } from "@repo/depot/option";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { type ApiDeps } from "../api/client.mjs";
import {
    createCredentialStore,
    type Credential,
    type CredentialStore
} from "../api/credential.mjs";
import { voidWire } from "../api/outcomes.mjs";
import { type ScreenStoreDeps } from "../state/screenStore.mjs";
import { createFakeStore, type FakeStore } from "../testing/fakeStore.mjs";
import { createMemoryCredentials } from "../testing/memoryCredentials.mjs";
import { SessionProvider, useSession } from "./SessionProvider.js";


const ann: Credential = { playerId: "pA", token: "tokenA" };
const bob: Credential = { playerId: "pB", token: "tokenB" };


function Probe(): ReactElement {
    const session = useSession();
    return (
        <div>
            <p>
                {session.active.match(
                    (a) => `signed in as ${a.credential.playerId}`,
                    () => "nobody"
                )}
            </p>
            <button onClick={() => session.signIn(ann)}>sign in A</button>
            <button onClick={() => session.signIn(bob)}>sign in B</button>
            <button onClick={session.signOut}>sign out</button>
        </div>
    );
}


interface Created {
    store: FakeStore;
    deps:  ScreenStoreDeps;
}


// The unauthorized answer the server gives a credential it does not know.
function unauthorized(): Response {
    return Response.json([{
        error: { message: "x", code: -32001, data: { code: "UNAUTHORIZED", httpStatus: 401 } }
    }], { status: 401 });
}


type Respond = (input: string, init?: RequestInit) => Promise<Response>;


function setup(
    initial?: Credential,
    respond: Respond = () => Promise.resolve(unauthorized()),
    persisted?: CredentialStore
) {
    const credentials = persisted ?? createMemoryCredentials(initial);
    const created: Created[] = [];
    const createStore = (deps: ScreenStoreDeps): FakeStore => {
        const store = createFakeStore();
        created.push({ store, deps });
        return store;
    };
    const fetch = respond as unknown as ApiDeps["fetch"];
    const tree = (
        <SessionProvider credentials={credentials} createStore={createStore} fetch={fetch}>
            <Probe />
        </SessionProvider>
    );
    return { credentials, created, tree, user: userEvent.setup() };
}


describe("SessionProvider", () => {

    describe("without a saved credential", () => {

        it("is signed out and creates no store", () => {
            const { tree, created } = setup();
            render(tree);
            expect(screen.getByText("nobody")).toBeInTheDocument();
            expect(created).toHaveLength(0);
        });


        it("saves the credential, creates one store and starts it on signIn", async () => {
            const { tree, created, credentials, user } = setup();
            render(tree);
            await user.click(screen.getByRole("button", { name: "sign in A" }));
            expect(screen.getByText("signed in as pA")).toBeInTheDocument();
            expect(credentials.load()).toEqual(new SomeOption(ann));
            expect(created).toHaveLength(1);
            expect(created[0]!.store.start).toHaveBeenCalledTimes(1);
        });

    });


    describe("with a saved credential", () => {

        it("creates the store once, starts it, and stops it on unmount", () => {
            const { tree, created } = setup(ann);
            const view = render(tree);
            expect(screen.getByText("signed in as pA")).toBeInTheDocument();
            expect(created).toHaveLength(1);
            const { store } = created[0]!;
            expect(store.start).toHaveBeenCalledTimes(1);
            expect(store.stop).not.toHaveBeenCalled();

            view.unmount();
            expect(store.stop).toHaveBeenCalledTimes(1);
        });


        it("does not create another store when something re-renders", () => {
            const { tree, created } = setup(ann);
            const view = render(tree);
            view.rerender(tree);
            act(() => created[0]!.store.set({ status: "Live" }));
            expect(created).toHaveLength(1);
            expect(created[0]!.store.start).toHaveBeenCalledTimes(1);
        });


        it("leaves exactly one store running under StrictMode", () => {
            const { tree, created } = setup(ann);
            render(<StrictMode>{tree}</StrictMode>);
            const running = created.filter((c) => {
                return c.store.start.mock.calls.length > c.store.stop.mock.calls.length;
            });
            expect(running).toHaveLength(1);
            expect(screen.getByText("signed in as pA")).toBeInTheDocument();
        });


        it("replaces the store when a different player signs in", async () => {
            const { tree, created, user } = setup(ann);
            render(tree);
            await user.click(screen.getByRole("button", { name: "sign in B" }));
            expect(created).toHaveLength(2);
            expect(created[0]!.store.stop).toHaveBeenCalledTimes(1);
            expect(created[1]!.store.start).toHaveBeenCalledTimes(1);
            expect(created[1]!.store.stop).not.toHaveBeenCalled();
        });

    });


    describe("signOut", () => {

        it("clears the credential, stops the store and goes back to nobody", async () => {
            const { tree, created, credentials, user } = setup(ann);
            render(tree);
            await user.click(screen.getByRole("button", { name: "sign out" }));
            expect(screen.getByText("nobody")).toBeInTheDocument();
            expect(credentials.load()).toEqual(NoneOption.get());
            expect(created[0]!.store.stop).toHaveBeenCalledTimes(1);
        });

    });


    describe("the subscription reporting UNAUTHORIZED", () => {

        it("signs out when it is the current credential", () => {
            const { tree, created, credentials } = setup(ann);
            render(tree);
            act(() => created[0]!.deps.onUnauthorized());
            expect(screen.getByText("nobody")).toBeInTheDocument();
            expect(credentials.load()).toEqual(NoneOption.get());
            expect(created[0]!.store.stop).toHaveBeenCalled();
        });


        it("leaves alone the new credential another tab saved since", async () => {
            // Two tabs share one storage.  Tab A signs in as Bob; tab B, still
            // on Ann, then hears that Ann's credential is no longer valid.
            const shared = createMemoryCredentials(ann);
            const tabA = setup(undefined, undefined, shared);
            const tabB = setup(undefined, undefined, shared);
            const a = render(tabA.tree);
            const b = render(tabB.tree);
            await tabA.user.click(within(a.container).getByRole("button", { name: "sign in B" }));
            act(() => tabB.created[0]!.deps.onUnauthorized());
            expect(within(b.container).getByText("nobody")).toBeInTheDocument();
            expect(within(a.container).getByText("signed in as pB")).toBeInTheDocument();
            expect(shared.load()).toEqual(new SomeOption(bob));
        });


        it("ignores a late report from a store of an older credential", async () => {
            const { tree, created, credentials, user } = setup(ann);
            render(tree);
            await user.click(screen.getByRole("button", { name: "sign in B" }));
            act(() => created[0]!.deps.onUnauthorized());
            expect(screen.getByText("signed in as pB")).toBeInTheDocument();
            expect(credentials.load()).toEqual(new SomeOption(bob));
            expect(created[1]!.store.stop).not.toHaveBeenCalled();
        });

    });


    describe("when the credential cannot be saved", () => {

        // Like a browser in private mode: reads find nothing, writes throw.
        function unsavable(): CredentialStore {
            return createCredentialStore({
                getItem: () => null,
                setItem: () => {
                    throw new Error("The storage is full.");
                },
                removeItem: () => undefined
            });
        }


        it("still signs in for this visit, and sends the credential", async () => {
            const respond = vi.fn<Respond>(() => Promise.resolve(unauthorized()));
            const { tree, created, user } = setup(undefined, respond, unsavable());
            render(tree);
            await user.click(screen.getByRole("button", { name: "sign in A" }));
            expect(screen.getByText("signed in as pA")).toBeInTheDocument();
            expect(created[0]!.store.start).toHaveBeenCalledTimes(1);

            await created[0]!.deps.api.call((t) => t.session.me.query(), voidWire);
            expect(new Headers(respond.mock.calls[0]?.[1]?.headers).get("authorization"))
            .toBe("Bearer pA.tokenA");
        });


        it("returns to name entry when the subscription reports UNAUTHORIZED", async () => {
            const { tree, created, user } = setup(undefined, undefined, unsavable());
            render(tree);
            await user.click(screen.getByRole("button", { name: "sign in A" }));
            act(() => created[0]!.deps.onUnauthorized());
            expect(screen.getByText("nobody")).toBeInTheDocument();
            expect(created[0]!.store.stop).toHaveBeenCalled();
        });


        it("returns to name entry when a call is answered with UNAUTHORIZED", async () => {
            const { tree, created, user } = setup(undefined, undefined, unsavable());
            render(tree);
            await user.click(screen.getByRole("button", { name: "sign in A" }));
            await created[0]!.deps.api.call(
                (t) => t.session.rename.mutate({ name: "x" }),
                voidWire
            );
            await waitFor(() => {
                expect(screen.getByText("nobody")).toBeInTheDocument();
            });
        });

    });


    describe("a call answered with UNAUTHORIZED", () => {

        it("signs out when the call started under the current credential", async () => {
            const { tree, created, credentials } = setup(ann);
            render(tree);
            const result = await created[0]!.deps.api.call(
                (t) => t.session.rename.mutate({ name: "x" }),
                voidWire
            );
            expect(result.failed).toBe(true);
            await waitFor(() => {
                expect(screen.getByText("nobody")).toBeInTheDocument();
            });
            expect(credentials.load()).toEqual(NoneOption.get());
            expect(created[0]!.store.stop).toHaveBeenCalled();
        });


        it("ignores a late reply to a call that started under an older credential", async () => {
            let reply: () => void = () => undefined;
            const gate = new Promise<void>((resolve) => {
                reply = resolve;
            });
            const { tree, created, credentials, user } = setup(
                ann,
                async () => {
                    await gate;
                    return unauthorized();
                }
            );
            render(tree);
            // The call starts under A, then B signs in before the reply arrives.
            const pending = created[0]!.deps.api.call(
                (t) => t.session.rename.mutate({ name: "x" }),
                voidWire
            );
            await user.click(screen.getByRole("button", { name: "sign in B" }));
            reply();
            await pending;
            expect(screen.getByText("signed in as pB")).toBeInTheDocument();
            expect(credentials.load()).toEqual(new SomeOption(bob));
            expect(created[1]!.store.stop).not.toHaveBeenCalled();
        });

    });

});
