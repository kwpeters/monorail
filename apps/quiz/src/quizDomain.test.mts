import {
    schemaPromptSingleLine, schemaPromptMultiLine, schemaAnswerCandidates,
    schemaAnswerText, schemaFlashcard, schemaFlashcardDeck
} from "./quizDomain.mjs";


describe("schemaPromptSingleLine", () => {

    it("fails when type field is not 'PromptSingleLine'", async () => {
        const prompt = {
            type:   "PromptSingleLineXyzzy",
            prompt: "What is the capital of France?"
        };
        const res = await schemaPromptSingleLine.safeParseAsync(prompt);
        expect(res.success).toBeFalse();
    });


    it("fails when the prompt string is empty", async () => {
        const prompt = {
            type:   "PromptSingleLine",
            prompt: ""
        };
        const res = await schemaPromptSingleLine.safeParseAsync(prompt);
        expect(res.success).toBeFalse();
    });


    it("succeeds when all fields are valid", async () => {
        const prompt = {
            type:   "PromptSingleLine",
            prompt: "What is the capital of France?"
        };
        const res = await schemaPromptSingleLine.safeParseAsync(prompt);
        expect(res.success).toBeTrue();
    });

});


describe("schemaPromptMultiLine", () => {

    it("fails when type field is not 'PromptMultiLine'", async () => {
        const prompt = {
            type:   "PromptMultiLineXyzzy",
            prompt: ["line 1", "line 2"]
        };
        const res = await schemaPromptMultiLine.safeParseAsync(prompt);
        expect(res.success).toBeFalse();
    });


    it("fails when the array of prompt lines is empty", async () => {
        const prompt = {
            type:   "PromptMultiLine",
            prompt: []
        };
        const res = await schemaPromptMultiLine.safeParseAsync(prompt);
        expect(res.success).toBeFalse();
    });


    it("succeeds when all fields are valid", async () => {
        const prompt = {
            type:   "PromptMultiLine",
            prompt: ["line 1", "line 2"]
        };
        const res = await schemaPromptMultiLine.safeParseAsync(prompt);
        expect(res.success).toBeTrue();
    });
});


describe("schemaAnswerCandidates", () => {

    it("fails when type is not 'AnswerCandidates'", async () => {
        const answer = {
            type:       "AnswerCandidatesXyzzy",
            candidates: ["Paris", "London", "Berlin"]
        };
        const res = await schemaAnswerCandidates.safeParseAsync(answer);
        expect(res.success).toBeFalse();
    });


    it("fails when the correct candidate string is empty", async () => {
        const answer = {
            type:             "AnswerCandidates",
            correctCandidate: "",
            wrongCandidates:  ["London", "Berlin"]
        };
        const res = await schemaAnswerCandidates.safeParseAsync(answer);
        expect(res.success).toBeFalse();
    });


    it("fails when any of the wrong candidate strings are empty", async () => {
        const answer = {
            type:             "AnswerCandidates",
            correctCandidate: "Paris",
            wrongCandidates:  ["London", "", "Berlin"]
        };
        const res = await schemaAnswerCandidates.safeParseAsync(answer);
        expect(res.success).toBeFalse();
    });


    it("succeeds when all fields are valid", async () => {
        const answer = {
            type:             "AnswerCandidates",
            correctCandidate: "Paris",
            wrongCandidates:  ["London", "Berlin"]
        };
        const res = await schemaAnswerCandidates.safeParseAsync(answer);
        expect(res.success).toBeTrue();
    });
});


describe("schemaAnswerText", () => {

    it("fails when type is not 'AnswerText'", async () => {
        const answer = {
            type:   "AnswerTextXyzzy",
            answer: "Paris"
        };
        const res = await schemaAnswerText.safeParseAsync(answer);
        expect(res.success).toBeFalse();
    });


    it("fails when the answer string is empty", async () => {
        const answer = {
            type:   "AnswerText",
            answer: ""
        };
        const res = await schemaAnswerText.safeParseAsync(answer);
        expect(res.success).toBeFalse();
    });


    it("succeeds when all fields are valid", async () => {
        const answer = {
            type:   "AnswerText",
            answer: "Paris"
        };
        const res = await schemaAnswerText.safeParseAsync(answer);
        expect(res.success).toBeTrue();
    });

});


describe("schemaFlashcard", () => {

    it("fails when type is not Flashcard", async () => {
        const flashcard = {
            type:   "FlashcardXyzzy",
            prompt: { type: "PromptSingleLine", prompt: "What is the capital of France?" },
            answer: { type: "AnswerText", answer: "Paris" }
        };
        const res = await schemaFlashcard.safeParseAsync(flashcard);
        expect(res.success).toBeFalse();

    });


    it("fails when prompt is invalid", async () => {
        const flashcard = {
            type:   "Flashcard",
            prompt: 0,
            answer: { type: "AnswerText", answer: "Paris" }
        };
        const res = await schemaFlashcard.safeParseAsync(flashcard);
        expect(res.success).toBeFalse();

    });


    it("fails when answer is invalid", async () => {
        const flashcard = {
            type:   "Flashcard",
            prompt: { type: "PromptSingleLine", prompt: "What is the capital of France?" },
            answer: 0
        };
        const res = await schemaFlashcard.safeParseAsync(flashcard);
        expect(res.success).toBeFalse();
    });


    it("succeeds when all fields are valid", async () => {
        const flashcard = {
            type:   "Flashcard",
            prompt: { type: "PromptSingleLine", prompt: "What is the capital of France?" },
            answer: { type: "AnswerText", answer: "Paris" }
        };
        const res = await schemaFlashcard.safeParseAsync(flashcard);
        expect(res.success).toBeTrue();
    });

});


describe("schemaFlashcardDeck", () => {

    it("fails when type is not 'FlashcardDeck'", async () => {
        const flashcardDeck = {
            type:       "FlashcardDeckXyzzy",
            flashcards: [
                {
                    type:   "Flashcard",
                    prompt: {
                        type:   "PromptSingleLine",
                        prompt: "What is the capital of France?"
                    },
                    answer: {
                        type:   "AnswerText",
                        answer: "Paris"
                    }
                },
                {
                    type:   "Flashcard",
                    prompt: {
                        type:   "PromptSingleLine",
                        prompt: "What is the capital of Germany?"
                    },
                    answer: {
                        type:   "AnswerText",
                        answer: "Berlin"
                    }
                }
            ]
        };
        const res = await schemaFlashcardDeck.safeParseAsync(flashcardDeck);
        expect(res.success).toBeFalse();
    });

    it("succeeds when all fields are valid", async () => {
        const flashcardDeck = {
            type:       "FlashcardDeck",
            flashcards: [
                {
                    type:   "Flashcard",
                    prompt: {
                        type:   "PromptSingleLine",
                        prompt: "What is the capital of France?"
                    },
                    answer: {
                        type:   "AnswerText",
                        answer: "Paris"
                    }
                },
                {
                    type:   "Flashcard",
                    prompt: {
                        type:   "PromptSingleLine",
                        prompt: "What is the capital of Germany?"
                    },
                    answer: {
                        type:   "AnswerText",
                        answer: "Berlin"
                    }
                }
            ]
        };
        const res = await schemaFlashcardDeck.safeParseAsync(flashcardDeck);
        expect(res.success).toBeTrue();
    });
});
