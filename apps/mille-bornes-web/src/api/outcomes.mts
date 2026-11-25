import { z } from "zod";


/** Shown when the request never got an answer. */
export const networkMessage = "We could not reach the game. Check the Wi-Fi.";

/** Shown when the server no longer knows this phone's credential. */
export const unauthorizedMessage = "Please enter your name again.";

/** Shown when the server answered with something this app cannot read. */
export const malformedMessage = "The game sent an answer we could not read. Please try again.";

/** Shown when the server refused the call for any other reason. */
export const failedMessage = "Something went wrong. Please try again.";


/** The value schema for mutations that return `Result<void, string>`. */
export const voidWire: z.ZodType<void> = z.void();
