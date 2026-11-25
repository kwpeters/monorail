/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";


// Adds the jest-dom matchers (for example toBeInTheDocument) to Vitest's
// `expect`.  This is what "@testing-library/jest-dom/vitest" declares.
declare module "vitest" {
    interface Assertion<T = any> extends TestingLibraryMatchers<unknown, T> {}


    interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
