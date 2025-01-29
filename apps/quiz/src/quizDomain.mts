import { z } from "zod";


////////////////////////////////////////////////////////////////////////////////
// Prompts
////////////////////////////////////////////////////////////////////////////////

export const schemaPromptSingleLine = z.object({
    type:   z.literal("PromptSingleLine"),
    prompt: z.string().min(1)
});
export type PromptSingleLine = z.infer<typeof schemaPromptSingleLine>;

export const schemaPromptMultiLine = z.object({
    type:   z.literal("PromptMultiLine"),
    prompt: z.array(z.string()).nonempty()
});
export type PromptMultiLine = z.infer<typeof schemaPromptMultiLine>;

export const schemaPrompt = z.discriminatedUnion("type", [schemaPromptSingleLine, schemaPromptMultiLine]);
export type Prompt = z.infer<typeof schemaPrompt>;


////////////////////////////////////////////////////////////////////////////////
// Answers
////////////////////////////////////////////////////////////////////////////////

export const schemaAnswerCandidates = z.object({
    type:             z.literal("AnswerCandidates"),
    correctCandidate: z.string().min(1),
    wrongCandidates:  z.array(z.string().min(1)).nonempty()
});
export type AnswerCandidates = z.infer<typeof schemaAnswerCandidates>;

export const schemaAnswerText = z.object({
    type:   z.literal("AnswerText"),
    answer: z.string().min(1)
});
export type AnswerText = z.infer<typeof schemaAnswerText>;

export const schemaAnswer = z.discriminatedUnion("type", [schemaAnswerCandidates, schemaAnswerText]);
export type Answer = z.infer<typeof schemaAnswer>;


////////////////////////////////////////////////////////////////////////////////
// Flashcard
////////////////////////////////////////////////////////////////////////////////

export const schemaFlashcard = z.object({
    type:   z.literal("Flashcard"),
    prompt: schemaPrompt,
    answer: schemaAnswer
});
export type Flashcard = z.infer<typeof schemaFlashcard>;


////////////////////////////////////////////////////////////////////////////////
// FlashcardDeck
////////////////////////////////////////////////////////////////////////////////

export const schemaFlashcardDeck = z.object({
    type:       z.literal("FlashcardDeck"),
    flashcards: z.array(schemaFlashcard)
});
export type FlashcardDeck = z.infer<typeof schemaFlashcardDeck>;
