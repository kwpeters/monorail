import { PlayerName } from "./playerName.mjs";


describe("playerName", () => {

    describe("PlayerName.tryCreate()", () => {

        it("trims and collapses whitespace", () => {
            expect(PlayerName.tryCreate("  Ann  Lee ").throwIfFailed())
            .toEqual("Ann Lee" as PlayerName);
        });


        it("rejects empty and whitespace-only names", () => {
            expect(PlayerName.tryCreate("").failed).toBeTrue();
            expect(PlayerName.tryCreate("   ").failed).toBeTrue();
        });


        it("allows exactly 20 code points and rejects 21", () => {
            expect(PlayerName.tryCreate("a".repeat(20)).succeeded).toBeTrue();
            expect(PlayerName.tryCreate("a".repeat(21)).failed).toBeTrue();
        });


        it("counts an emoji as one code point", () => {
            expect(PlayerName.tryCreate("🚗".repeat(20)).succeeded).toBeTrue();
            expect(PlayerName.tryCreate("🚗".repeat(21)).failed).toBeTrue();
        });


        it("rejects control characters", () => {
            expect(PlayerName.tryCreate("A\u0000").failed).toBeTrue();
            expect(PlayerName.tryCreate("A\u0007B").failed).toBeTrue();
        });


        it("rejects invisible format characters", () => {
            expect(PlayerName.tryCreate("A​B").failed).toBeTrue();
            expect(PlayerName.tryCreate("A‮B").failed).toBeTrue();
        });

    });


    describe("PlayerName.isSame()", () => {

        const mk = (s: string): PlayerName => PlayerName.tryCreate(s).throwIfFailed();

        it("is case-insensitive", () => {
            expect(PlayerName.isSame(mk("Zoë"), mk("ZOË"))).toBeTrue();
            expect(PlayerName.isSame(mk("Ann"), mk("ann"))).toBeTrue();
        });


        it("applies NFKC normalization", () => {
            // Decomposed "e" + combining diaeresis vs precomposed "ë".
            expect(PlayerName.isSame(mk("Zoë"), mk("Zoë"))).toBeTrue();
        });


        it("is false for different names", () => {
            expect(PlayerName.isSame(mk("Ann"), mk("Anne"))).toBeFalse();
        });

    });

});
