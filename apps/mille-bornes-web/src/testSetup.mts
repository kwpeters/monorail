import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";


// "@testing-library/jest-dom/vitest" cannot be used here: it imports "vitest"
// from the hoisted copy of jest-dom, where npm cannot hoist vitest (see
// jestDomMatchers.d.mts for the matching type declarations).
expect.extend(matchers);


// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
    cleanup();
});
