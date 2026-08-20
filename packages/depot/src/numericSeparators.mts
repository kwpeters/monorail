/**
 * Removes numeric separator characters from a token prior to parsing.
 *
 * This normalization is intentionally permissive: separator placement is not
 * validated before removal.
 *
 * The original separator formatting is not preserved after parsing.
 */
export function stripNumericSeparators(token: string): string {
    return token.replace(/_/g, "");
}
