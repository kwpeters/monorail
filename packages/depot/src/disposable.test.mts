import { makeAsyncDisposable, makeDisposable } from "./disposable.mjs";


describe("makeDisposable()", () => {

    it("returns an object with the original object's properties", () => {
        const person = {first: "Daenerys", last: "Targaryen"};
        const disposable = makeDisposable(person, () => {});

        expect(disposable.first).toEqual("Daenerys");
        expect(disposable.last).toEqual("Targaryen");
    });


    it("calls the dispose function when disposed", () => {
        let disposed = false;

        // Invoke an IIFE to create a scope for `disposable`.
        (function (): void {
            using disposable = makeDisposable(
                {value: 42},
                (x) => { x.value = 43; disposed = true; }
            );
        })();       // `disposable` will be disposed here.

        // Since disposable is no longer in scope, we cannot make any assertions
        // on it, but we can check that the closed over variables were updated.
        expect(disposed).toBeTrue();
    });

});


describe("makeAsyncDisposable()", () => {

    it("returns an object with the original object's properties", () => {
        const person = {first: "Daenerys", last: "Targaryen"};
        const disposable = makeDisposable(person, () => {});

        expect(disposable.first).toBe("Daenerys");
        expect(disposable.last).toBe("Targaryen");
    });


    it("calls the async dispose function when disposed", async () => {
        let disposed = false;

        // Invoke an IIFE to create a scope for `disposable`.
        await (async function (): Promise<void> {
            await using disposable = makeAsyncDisposable(
                {value: 42},
                async (x) => { await Promise.resolve(0);  x.value = 43; disposed = true; }
            );
        })();       // `disposable` will be disposed here.

        // Since disposable is no longer in scope, we cannot make any assertions
        // on it, but we can check that the closed over variables were updated.
        expect(disposed).toBeTrue();
    });

});
