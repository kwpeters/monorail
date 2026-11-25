import { FailedResult, type Result } from "@repo/depot/result";
import { discriminatedResultSchema } from "@repo/depot/schemaUtility";
import type { AppRouter } from "@repo/mille-bornes-game-server/router";
import {
    createTRPCClient,
    getFetch,
    httpBatchLink,
    httpSubscriptionLink,
    isTRPCClientError,
    splitLink
} from "@trpc/client";
import { z } from "zod";
import { authorizationHeader, type CredentialStore } from "./credential.mjs";
import {
    failedMessage,
    malformedMessage,
    networkMessage,
    unauthorizedMessage
} from "./outcomes.mjs";


/** What `createApi()` needs. */
export interface ApiDeps {
    credentials:    CredentialStore;

    /** Where the tRPC endpoint is; relative so any host works. */
    baseUrl?:       string;

    /** Replaces the global `fetch`; for tests. */
    fetch?:         Parameters<typeof getFetch>[0];

    /** Called once for each call the server answers with UNAUTHORIZED. */
    onUnauthorized: () => void;
}


/** The typed client plus result decoding. */
export interface Api {
    readonly trpc: ReturnType<typeof createTRPCClient<AppRouter>>;

    /**
     * Runs a mutation that answers with a `ResultWire` and decodes it.  A
     * network failure, a rejected credential or an unreadable answer becomes
     * a failed Result with a plain-English message.
     * @param fn - Makes the call, for example `(t) => t.session.rename.mutate(...)`
     * @param valueSchema - The schema of the success value
     * @returns The decoded Result
     */
    call<TOut>(
        fn:          (t: Api["trpc"]) => Promise<unknown>,
        valueSchema: z.ZodType<TOut>
    ): Promise<Result<TOut, string>>;
}


/**
 * Makes the API: one tRPC client that sends the stored credential on every
 * request (read per request, so a new sign-in takes effect at once).
 * @param deps - The credential store, the unauthorized hook and options
 * @returns The API
 */
export function createApi(deps: ApiDeps): Api {
    const url = deps.baseUrl ?? "/trpc";

    // The credential is never cached here: sign-in and sign-out change it.
    const authorization = (): Record<string, string> => {
        const credential = deps.credentials.load();
        return credential.isSome ? { authorization: authorizationHeader(credential.value) } : {};
    };

    const trpc = createTRPCClient<AppRouter>({
        links: [
            splitLink({
                condition: (op) => op.type === "subscription",

                // The native EventSource cannot set headers.
                true: httpSubscriptionLink({ url, connectionParams: authorization }),

                false: httpBatchLink({ url, headers: authorization, fetch: getFetch(deps.fetch) })
            })
        ]
    });

    async function call<TOut>(
        fn:          (t: Api["trpc"]) => Promise<unknown>,
        valueSchema: z.ZodType<TOut>
    ): Promise<Result<TOut, string>> {
        let wire: unknown;
        try {
            wire = await fn(trpc);
        }
        catch (err) {
            if (isUnauthorized(err)) {
                deps.onUnauthorized();
                return new FailedResult(unauthorizedMessage);
            }
            return new FailedResult(plainMessage(err));
        }

        const decoded = discriminatedResultSchema(valueSchema, z.string()).safeParse(wire);
        return decoded.success ? decoded.data : new FailedResult(malformedMessage);
    }

    return { trpc, call };
}


function isUnauthorized(err: unknown): boolean {
    // A TRPCClientError carries the server's error shape in `data`.
    return isTRPCClientError<AppRouter>(err) && err.data?.code === "UNAUTHORIZED";
}


function plainMessage(err: unknown): string {
    if (!isTRPCClientError<AppRouter>(err)) {
        return failedMessage;
    }
    if (err.data !== undefined && err.data !== null) {
        // The server answered with an error; its own text is not shown.
        return failedMessage;
    }
    // No server data: the request failed, or the body was not tRPC at all.
    return err.cause instanceof SyntaxError ? malformedMessage : networkMessage;
}
