import { standardGameConfig } from "@repo/mille-bornes-shared/gameConfig";
import { newGame } from "./gameStateFns.mjs";
import { createDeck, standardCardCountFn, type MilleBornesShuffledDeck } from "./milleBornesDeck.mjs";


const mockShuffledDeckProvider = () => {
    const deck = createDeck(standardCardCountFn).throwIfFailed();
    // The returned deck will not be shuffled.  This will help the tests be deterministic.
    return deck as unknown as MilleBornesShuffledDeck;
};


describe("newGame()", () => {

    it("returns a game state that has a copy of the provided configuration", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.gameConfig).toEqual(standardGameConfig);
    });


    it("returns a game state where each player has a hand containing 6 cards", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.playerHands.length).toEqual(2);
        for (const hand of gameState.playerHands) {
            expect(hand.length).toEqual(6);
        }
    });


    it("returns a game state where there is a non-empty draw pile", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.drawPile.length).toEqual(106 - 2 * 6);
    });


    it("returns a game state that has an empty discard pile", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.discardPile.length).toEqual(0);
    });


    it("returns a game state that has one driving zone per team", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.drivingZones.length).toEqual(2);
    });


    it("returns a game state in which player index 0 is the first dealer", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.currentRoundDealerIndex).toEqual(0);
    });


    it("returns a game state in which the last move is that player 0 has dealt.", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.lastMove).toEqual("Player 1 has dealt the cards.");
    });


    it("returns a game state where each team has no scores yet", () => {
        const gameState = newGame(standardGameConfig, mockShuffledDeckProvider).throwIfFailed();
        expect(gameState.teamScores.length).toEqual(2);
        for (const teamScores of gameState.teamScores) {
            expect(teamScores).toEqual([]);
        }
    });

});
