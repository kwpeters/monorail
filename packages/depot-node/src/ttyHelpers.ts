import { repeat } from "../../depot/src/stringHelpers.js";


export function hr(str: string): string {
    const cols = process.stdout.columns ?? 80;
    const hr = repeat(str, cols);
    return hr;
}
