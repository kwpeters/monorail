import { PlayerName } from "./playerName.mjs";
import { pickWhimsicalName, whimsicalNames } from "./whimsicalNames.mjs";


function nameOf(raw: string): PlayerName {
    return PlayerName.tryCreate(raw).throwIfFailed();
}


describe("whimsicalNames", () => {

    describe("whimsicalNames", () => {

        it("has at least 30 names", () => {
            expect(whimsicalNames.length).toBeGreaterThanOrEqual(30);
        });


        it("holds only valid player names, already in canonical form", () => {
            for (const name of whimsicalNames) {
                expect(PlayerName.tryCreate(name).throwIfFailed()).toBe(name);
            }
        });


        it("holds names that are all distinct under PlayerName.isSame", () => {
            for (const [i, name] of whimsicalNames.entries()) {
                for (const other of whimsicalNames.slice(i + 1)) {
                    expect(PlayerName.isSame(name, other)).withContext(`${name} / ${other}`).toBeFalse();
                }
            }
        });


        it("includes the signature names", () => {
            expect(whimsicalNames).toContain(nameOf("Sir Honks-a-Lot"));
            expect(whimsicalNames).toContain(nameOf("Gary the Flat Tire"));
        });

    });


    describe("pickWhimsicalName()", () => {

        it("picks the name selected by the random number", () => {
            expect(pickWhimsicalName([], () => 0).throwIfFailed()).toBe(whimsicalNames[0]!);
            expect(pickWhimsicalName([], () => 0.999999).throwIfFailed()).toBe(whimsicalNames.at(-1)!);
        });


        it("never returns a taken name", () => {
            const taken = whimsicalNames.slice(0, 5);
            for (let i = 0; i < 200; i++) {
                const picked = pickWhimsicalName(taken).throwIfFailed();
                expect(taken).not.toContain(picked);
            }
        });


        it("treats case, whitespace and accent variants as taken", () => {
            const variants = ["sir honks-a-lot", "SIR HONKS-A-LOT", "Ｓir Honks-a-Lot"].map(nameOf);
            const rest = whimsicalNames.filter((n) => n !== nameOf("Sir Honks-a-Lot"));
            for (const variant of variants) {
                // Whatever the random number, the taken name is not offered.
                for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
                    const picked = pickWhimsicalName([variant], () => r).throwIfFailed();
                    expect(rest).toContain(picked);
                }
            }
        });


        it("fails only when every name in the pool is taken", () => {
            const [last, ...others] = [...whimsicalNames].reverse();
            expect(pickWhimsicalName(others).throwIfFailed()).toBe(last!);
            expect(pickWhimsicalName([...others, last!]).failed).toBeTrue();
        });


        it("clamps a random number that is out of range", () => {
            expect(pickWhimsicalName([], () => 1).succeeded).toBeTrue();
        });

    });

});
