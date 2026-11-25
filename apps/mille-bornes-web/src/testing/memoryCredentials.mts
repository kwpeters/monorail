import {
    createCredentialStore,
    type Credential,
    type CredentialStore
} from "../api/credential.mjs";


// Test support: never import this from production code.


/**
 * Makes a real credential store over an in-memory storage.
 * @param initial - A credential saved before the test starts, if any
 * @returns The store
 */
export function createMemoryCredentials(initial?: Credential): CredentialStore {
    const items = new Map<string, string>();
    const store = createCredentialStore({
        getItem:    (key) => items.get(key) ?? null,
        setItem:    (key, value) => void items.set(key, value),
        removeItem: (key) => void items.delete(key)
    });
    if (initial !== undefined) {
        store.save(initial);
    }
    return store;
}
