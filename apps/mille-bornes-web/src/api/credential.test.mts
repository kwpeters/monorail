import { describe, expect, it } from "vitest";
import {
    authorizationHeader,
    createCredentialStore,
    credentialStorageKey
} from "./credential.mjs";


class FakeStorage {
    public readonly items = new Map<string, string>();

    public getItem(key: string): string | null {
        return this.items.get(key) ?? null;
    }

    public setItem(key: string, value: string): void {
        this.items.set(key, value);
    }

    public removeItem(key: string): void {
        this.items.delete(key);
    }
}


const throwingStorage = {
    getItem:    (): string | null => { throw new Error("denied"); },
    setItem:    (): void => { throw new Error("denied"); },
    removeItem: (): void => { throw new Error("denied"); }
};


describe("credential", () => {

    describe("createCredentialStore()", () => {

        it("saves and loads a credential", () => {
            const store = createCredentialStore(new FakeStorage());
            store.save({ playerId: "p1", token: "t1" });
            const loaded = store.load();
            expect(loaded.isSome).toBe(true);
            expect(loaded.isSome && loaded.value).toEqual({ playerId: "p1", token: "t1" });
        });


        it("loads none when nothing was saved", () => {
            expect(createCredentialStore(new FakeStorage()).load().isNone).toBe(true);
        });


        it("clear() removes the credential", () => {
            const storage = new FakeStorage();
            const store = createCredentialStore(storage);
            store.save({ playerId: "p1", token: "t1" });
            store.clear();
            expect(store.load().isNone).toBe(true);
            expect(storage.items.size).toBe(0);
        });


        it("uses exactly one key", () => {
            const storage = new FakeStorage();
            createCredentialStore(storage).save({ playerId: "p1", token: "t1" });
            expect([...storage.items.keys()]).toEqual([credentialStorageKey]);
        });


        const damaged: Array<[string, string]> = [
            ["an empty string", ""],
            ["truncated JSON", "{"],
            ["an array", "[]"],
            ["an object without a token", JSON.stringify({ playerId: "p1" })],
            ["a non-string playerId", JSON.stringify({ playerId: 7, token: "t" })]
        ];
        for (const [name, value] of damaged) {
            it(`loads none and clears the key for ${name}`, () => {
                const storage = new FakeStorage();
                storage.setItem(credentialStorageKey, value);
                expect(createCredentialStore(storage).load().isNone).toBe(true);
                expect(storage.items.has(credentialStorageKey)).toBe(false);
            });
        }


        it("never throws when the storage throws, and behaves as empty", () => {
            const store = createCredentialStore(throwingStorage);
            expect(() => store.save({ playerId: "p1", token: "t1" })).not.toThrow();
            expect(store.load().isNone).toBe(true);
            expect(() => store.clear()).not.toThrow();
        });

    });


    describe("authorizationHeader()", () => {

        it("has the form Bearer <playerId>.<token>", () => {
            expect(authorizationHeader({ playerId: "p1", token: "t1" })).toBe("Bearer p1.t1");
        });

    });

});
