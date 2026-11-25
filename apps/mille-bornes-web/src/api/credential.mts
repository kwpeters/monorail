import { NoneOption, type Option, SomeOption } from "@repo/depot/option";
import { z } from "zod";


/** The name of the one `localStorage` key that holds the credential. */
export const credentialStorageKey = "milleBornes.credential";


/** Who this phone is: sent to the server with every call. */
export interface Credential {
    playerId: string;
    token:    string;
}


/** Remembers the credential between visits. */
export interface CredentialStore {
    /** The saved credential, or none (also when the saved value is damaged). */
    load(): Option<Credential>;
    save(c: Credential): void;
    clear(): void;
}


const credentialSchema = z.object({ playerId: z.string(), token: z.string() });


/**
 * Makes a credential store that keeps one JSON value under one key.  A storage
 * that throws (private mode, quota) behaves as if it were empty.
 * @param storage - Usually `window.localStorage`
 * @returns The store
 */
export function createCredentialStore(
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
): CredentialStore {
    const clear = (): void => {
        try {
            storage.removeItem(credentialStorageKey);
        }
        catch {
            // Storage is unavailable; there is nothing to clear.
        }
    };

    const read = (): string | null => {
        try {
            return storage.getItem(credentialStorageKey);
        }
        catch {
            return null;
        }
    };

    return {
        load: (): Option<Credential> => {
            const raw = read();
            if (raw === null) {
                return NoneOption.get();
            }

            let parsed: unknown;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                parsed = undefined;
            }
            const result = credentialSchema.safeParse(parsed);
            if (!result.success) {
                clear();
                return NoneOption.get();
            }
            return new SomeOption({ playerId: result.data.playerId, token: result.data.token });
        },

        save: (c: Credential): void => {
            try {
                storage.setItem(
                    credentialStorageKey,
                    JSON.stringify({ playerId: c.playerId, token: c.token })
                );
            }
            catch {
                // Storage is unavailable; the player signs in again next visit.
            }
        },

        clear
    };
}


/**
 * Formats the `Authorization` header value the server expects.
 * @param c - The credential
 * @returns `Bearer <playerId>.<token>`
 */
export function authorizationHeader(c: Credential): string {
    return `Bearer ${c.playerId}.${c.token}`;
}
