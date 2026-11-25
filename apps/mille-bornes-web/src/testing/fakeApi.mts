import { FailedResult } from "@repo/depot/result";
import { discriminatedResultSchema } from "@repo/depot/schemaUtility";
import { vi, type Mock } from "vitest";
import { z } from "zod";
import type { Api } from "../api/client.mjs";


// Test support: never import this from production code.


/**
 * The wire form of a succeeded `Result`.
 * @param value - The success value
 * @returns What a mutation answers with
 */
export function okWire<TValue>(value: TValue): { succeeded: true; value: TValue } {
    return { succeeded: true, value };
}


/**
 * The wire form of a failed `Result`.
 * @param error - The plain message
 * @returns What a mutation answers with
 */
export function failWire(error: string): { succeeded: false; error: string } {
    return { succeeded: false, error };
}


/** The procedures the fake answers; every one is a mock. */
export interface FakeProcedures {
    create:     Mock<(input: { name: string | null }) => Promise<unknown>>;
    rename:     Mock<(input: { name: string }) => Promise<unknown>>;
    me:         Mock<() => Promise<unknown>>;
    join:       Mock<(input: { gameId: string }) => Promise<unknown>>;
    createGame: Mock<() => Promise<unknown>>;
}


/** An `Api` whose procedures are mocks. */
export interface FakeApi {
    api:   Api;
    procs: FakeProcedures;
}


/**
 * Makes an `Api` that runs `call()` like the real one (decoding the wire
 * answer) over mock procedures.  Every procedure succeeds until a test says
 * otherwise.
 * @returns The fake API and its mocks
 */
export function createFakeApi(): FakeApi {
    const procs: FakeProcedures = {
        create: vi.fn(() => Promise.resolve(
            okWire({ playerId: "p1", token: "tok", name: "Ann" })
        )),
        rename:     vi.fn(() => Promise.resolve(okWire(undefined))),
        me:         vi.fn(() => Promise.resolve({ playerId: "p1", name: "Ann" })),
        join:       vi.fn(() => Promise.resolve(okWire(undefined))),
        createGame: vi.fn(() => Promise.resolve(okWire(undefined)))
    };

    const trpc = {
        session: {
            create: { mutate: procs.create },
            rename: { mutate: procs.rename },
            me:     { query: procs.me }
        },
        lobby: {
            join:       { mutate: procs.join },
            createGame: { mutate: procs.createGame }
        }
    } as unknown as Api["trpc"];

    const call: Api["call"] = async (fn, valueSchema) => {
        const wire = await fn(trpc);
        const decoded = discriminatedResultSchema(valueSchema, z.string()).safeParse(wire);
        return decoded.success ? decoded.data : new FailedResult("unreadable");
    };

    return { api: { trpc, call }, procs };
}
