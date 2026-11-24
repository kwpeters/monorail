import { type Brand } from "@repo/depot/brand";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";


const maxNameLength = 20;


/**
 * A player's display name.  Trimmed, whitespace-collapsed, 1 to 20 code points
 * and free of control characters.
 */
export type PlayerName = Brand<string, "PlayerName">;


export namespace PlayerName {

    /**
     * Creates a PlayerName from raw user input.
     * @param raw - The raw name
     * @returns A successful result containing the PlayerName or a failed result
     * containing an error message
     */
    export function tryCreate(raw: string): Result<PlayerName, string> {
        const name = raw.trim().replace(/\s+/gu, " ");
        if (name.length === 0) {
            return new FailedResult("A player name cannot be empty.");
        }
        if (/\p{Cc}/u.test(name)) {
            return new FailedResult("A player name cannot contain control characters.");
        }
        if (Array.from(name).length > maxNameLength) {
            return new FailedResult(`A player name cannot be longer than ${maxNameLength} characters.`);
        }
        return new SucceededResult(name as PlayerName);
    }


    /**
     * Determines whether two names refer to the same player name, ignoring
     * case after NFKC normalization.
     * @param a - The first name
     * @param b - The second name
     * @returns Whether the names are the same
     */
    export function isSame(a: PlayerName, b: PlayerName): boolean {
        const norm = (s: string): string => s.normalize("NFKC").toLowerCase();
        return norm(a) === norm(b);
    }

}
