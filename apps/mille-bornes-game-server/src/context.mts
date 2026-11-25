import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { type PlayerId } from "@repo/mille-bornes-core/ids";
import { type Hub } from "./hub.mjs";
import { parseBearer, type SessionRegistry } from "./sessions.mjs";


/** What every procedure can see. */
export interface Context {
    hub:      Hub;
    sessions: SessionRegistry;

    /** Set only by a valid credential; none otherwise. */
    player:   Option<PlayerId>;
}


/** What `createContextFromHeader()` needs. */
export interface ContextDeps {
    hub:      Hub;
    sessions: SessionRegistry;
}


/**
 * Makes the context for one request or connection.  The player is set only
 * when the credential parses and the session registry accepts its token; a
 * bare player id is never trusted.
 * @param deps - The hub and the session registry
 * @param authorization - The `Authorization` header value, if any
 * @returns The context; `player` is none for a missing or invalid credential
 */
export function createContextFromHeader(
    deps:          ContextDeps,
    authorization: Option<string>
): Context {
    const player = parseBearer(authorization).bind((credential) => {
        return deps.sessions.authenticate(credential) ?
            new SomeOption(credential.playerId) :
            NoneOption.get();
    });
    return { hub: deps.hub, sessions: deps.sessions, player };
}


/**
 * Makes the context from an HTTP request, for the Express adapter.  The
 * `Authorization` header is used if present; otherwise the `authorization`
 * connection parameter, which is how a subscription sends it because
 * EventSource cannot set headers.
 * @param deps - The hub and the session registry
 * @param headers - The request's headers
 * @param connectionParams - The connection parameters, or null or undefined
 * @returns The context
 */
export function contextFromRequest(
    deps:             ContextDeps,
    headers:          { authorization?: string | undefined },
    connectionParams: Record<string, string | undefined> | null | undefined
): Context {
    // The header wins, even when it is empty (and then fails to parse).
    const fromParams = Option.fromNullable(connectionParams)
    .bind((params) => Option.fromNullable(params.authorization));
    return createContextFromHeader(
        deps,
        Option.fromNullable(headers.authorization).bindNone(() => fromParams)
    );
}
