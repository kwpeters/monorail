import { NoneOption, SomeOption } from "@repo/depot/option";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";
import { createApi, type Api, type ApiDeps } from "./client.mjs";
import { type CredentialStore } from "./credential.mjs";
import {
    failedMessage,
    malformedMessage,
    networkMessage,
    unauthorizedMessage,
    voidWire
} from "./outcomes.mjs";


const secretToken = "SECRET-TOKEN-12345";


function storeWith(token: string | undefined): CredentialStore {
    return {
        load: () => token === undefined ?
            NoneOption.get() :
            new SomeOption({ playerId: "p1", token }),
        save:  () => undefined,
        clear: () => undefined
    };
}


// A tRPC batch response with a single procedure call, without a transformer.
function batchResponse(body: unknown, status = 200): Response {
    return Response.json([body], { status });
}


function data(value: unknown): Response {
    return batchResponse({ result: { data: value } });
}


type FetchMock = Mock<(input: string, init?: RequestInit) => Promise<Response>>;


interface Harness {
    api:            Api;
    fetchMock:      FetchMock;
    onUnauthorized: Mock<() => void>;
}


function makeApi(
    respond:     () => Promise<Response>,
    credentials: CredentialStore = storeWith(secretToken)
): Harness {
    const fetchMock: FetchMock = vi.fn(respond);
    const onUnauthorized = vi.fn<() => void>();
    // The mock only inspects the headers, so the narrower signature is enough.
    const fetch = fetchMock as unknown as NonNullable<ApiDeps["fetch"]>;
    const api = createApi({ credentials, fetch, onUnauthorized });
    return { api, fetchMock, onUnauthorized };
}


function sentHeaders(fetchMock: FetchMock): Headers {
    return new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
}


const rename = (t: Api["trpc"]): Promise<unknown> => t.session.rename.mutate({ name: "Kim" });


describe("client", () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });


    describe("createApi()", () => {

        it("sends the stored credential as an authorization header", async () => {
            const { api, fetchMock } = makeApi(() => Promise.resolve(data({ succeeded: true })));
            await api.call(rename, voidWire);
            expect(sentHeaders(fetchMock).get("authorization")).toBe(`Bearer p1.${secretToken}`);
        });


        it("sends no authorization header without a credential", async () => {
            const { api, fetchMock } = makeApi(
                () => Promise.resolve(data({ succeeded: true })),
                storeWith(undefined)
            );
            await api.call(rename, voidWire);
            expect(sentHeaders(fetchMock).has("authorization")).toBe(false);
        });

    });


    describe("Api.call()", () => {

        it("decodes a succeeded wire to a successful Result", async () => {
            const { api } = makeApi(() => Promise.resolve(data({ succeeded: true })));
            const result = await api.call(rename, voidWire);
            expect(result.succeeded).toBe(true);
        });


        it("decodes a succeeded wire value with its schema", async () => {
            const { api } = makeApi(() => Promise.resolve(
                data({ succeeded: true, value: { n: 3 } })
            ));
            const result = await api.call(rename, z.object({ n: z.number() }));
            expect(result.succeeded && result.value).toEqual({ n: 3 });
        });


        it("decodes a failed wire to a failed Result with the message", async () => {
            const { api } = makeApi(() => Promise.resolve(
                data({ succeeded: false, error: "It is not your turn." })
            ));
            const result = await api.call(rename, voidWire);
            expect(result.failed && result.error).toBe("It is not your turn.");
        });


        it("gives the plain network message when the fetch rejects", async () => {
            const { api, onUnauthorized } = makeApi(() => Promise.reject(new TypeError("offline")));
            const result = await api.call(rename, voidWire);
            expect(result.failed && result.error).toBe(networkMessage);
            expect(onUnauthorized).not.toHaveBeenCalled();
        });


        it("calls onUnauthorized once and asks for the name again on UNAUTHORIZED", async () => {
            const { api, onUnauthorized } = makeApi(() => Promise.resolve(batchResponse({
                error: {
                    message: "Your session is not valid.",
                    code:    -32001,
                    data:    { code: "UNAUTHORIZED", httpStatus: 401 }
                }
            }, 401)));
            const result = await api.call(rename, voidWire);
            expect(result.failed && result.error).toBe(unauthorizedMessage);
            expect(onUnauthorized).toHaveBeenCalledTimes(1);
        });


        it("gives a plain message for other server errors", async () => {
            const { api, onUnauthorized } = makeApi(() => Promise.resolve(batchResponse({
                error: {
                    message: "Boom",
                    code:    -32603,
                    data:    { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 }
                }
            }, 500)));
            const result = await api.call(rename, voidWire);
            expect(result.failed && result.error).toBe(failedMessage);
            expect(onUnauthorized).not.toHaveBeenCalled();
        });


        it("fails with a plain message for a wire that is not a Result", async () => {
            const { api } = makeApi(() => Promise.resolve(data({ hello: "world" })));
            const result = await api.call(rename, voidWire);
            expect(result.failed && result.error).toBe(malformedMessage);
        });


        it("fails with a plain message for a body that is not JSON", async () => {
            const { api } = makeApi(() => Promise.resolve(new Response("<html>oops</html>")));
            const result = await api.call(rename, voidWire);
            expect(result.failed && result.error).toBe(malformedMessage);
        });


        it("never reveals the token in a message or a log line", async () => {
            const logs = [
                vi.spyOn(console, "log"),
                vi.spyOn(console, "warn"),
                vi.spyOn(console, "error"),
                vi.spyOn(console, "info"),
                vi.spyOn(console, "debug")
            ];
            const responders: Array<() => Promise<Response>> = [
                () => Promise.reject(new TypeError(`offline ${secretToken}`)),
                () => Promise.resolve(batchResponse({
                    error: { message: "x", code: -32001, data: { code: "UNAUTHORIZED" } }
                }, 401)),
                () => Promise.resolve(data({ hello: "world" })),
                () => Promise.resolve(new Response("not json")),
                () => Promise.resolve(data({ succeeded: false, error: "It is not your turn." }))
            ];
            for (const respond of responders) {
                const { api } = makeApi(respond);
                const result = await api.call(rename, voidWire);
                expect(JSON.stringify(result)).not.toContain(secretToken);
            }
            for (const log of logs) {
                expect(JSON.stringify(log.mock.calls)).not.toContain(secretToken);
            }
        });

    });

});
