---
title: Plan to Create sample-composite-app-xyzzy
description: A plan to create a sample composite app consisting of a React frontend,
  an Express backend, and a shared tRPC package for type-safe API communication.
---

## Goals

This sample composite app demonstrates how to structure a full-stack web application
within this monorepo using a React frontend, an Express backend, and a shared tRPC
package for type-safe API communication. As with all "xyzzy" sample projects in this
monorepo, the name acts as a search-and-replace token, making the entire app easy to
copy and rename.

### Objectives

* Establish a reusable composite app template within a new top-level `composite-apps/` directory.
* Show how three workspace packages (backend, frontend, trpc) coexist under a single composite app directory and depend on each other.
* Demonstrate tRPC for end-to-end type-safe API calls between a React frontend and an Express backend.
* Wire up the Turbo build pipeline so packages build in the correct dependency order and the final output is a single deployable artifact.
* The running backend should statically serve the compiled frontend.

## Rough Structure

The composite app will live at `composite-apps/sample-composite-app-xyzzy/` and consist
of three workspace packages:

```text
composite-apps/
  sample-composite-app-xyzzy/
    backend/    <- @repo/sample-composite-app-xyzzy-backend
    frontend/   <- @repo/sample-composite-app-xyzzy-frontend
    trpc/       <- @repo/sample-composite-app-xyzzy-trpc
```

### trpc package

* Defines the tRPC router, procedure definitions, and shared input/output types.
* Exports TypeScript types only — no Node.js-specific runtime code — so the frontend bundler can safely import it.
* Built first; both `backend` and `frontend` declare it as a dependency.

### backend package

* Based on `apps/sample-express-xyzzy` — Express server with CORS, Morgan, and Winston logging.
* Mounts the tRPC Express adapter to expose the API.
* A post-build step copies the frontend's `dist/` output into `dist/public/`; Express serves it statically.
* Depends on `@repo/sample-composite-app-xyzzy-trpc`.

### frontend package

* Minimal React app (no state management store) built with Vite.
* Uses the tRPC React Query client to call the backend API in a type-safe way.
* Depends on `@repo/sample-composite-app-xyzzy-trpc`.

## Key Design Decisions

* The `trpc` package lives inside `composite-apps/sample-composite-app-xyzzy/` rather
  than `packages/` because it is specific to this app. Its workspace membership is
  enabled by adding `composite-apps/*/*` to the `workspaces` array in the root
  `package.json`.
* React is chosen as the frontend framework (minimal, no store).
* Build order: `trpc` builds first, then `backend` and `frontend` build in parallel,
  then an assembly step copies the frontend output into the backend output directory.
* All three packages participate in the standard monorepo scripts: `build`, `lint`,
  `test`, `type-check`, and `depcheck`.

## Implementation Plan

### Phase 1 — Monorepo scaffolding [x]

1. Create the `composite-apps/` directory at the repo root.
2. Create the `composite-apps/sample-composite-app-xyzzy/` directory.
3. Add `"composite-apps/*/*"` to the `workspaces` array in the root `package.json`.

### Phase 2 — trpc package [x]

Create `composite-apps/sample-composite-app-xyzzy/trpc/` as a minimal, browser-safe
TypeScript library package containing only Zod schemas. It has no handler code and
no Node.js-specific imports, so the frontend can safely depend on it at runtime.
The primary purpose of this package is to share input/output schema definitions
between the backend and frontend, and to break the circular build dependency that
would result if the frontend depended directly on the backend.

Files to create:

* `package.json` — name `@repo/sample-composite-app-xyzzy-trpc`; scripts: `build`
  (tsc), `lint`, `test`, `type-check`, `depcheck`; runtime dependency on `zod` only
  (no `@trpc/server`).
* `tsconfig.src.json` — extends `@repo/typescript-config/tsconfig.app.json`, outputs
  to `dist/`, excludes test files.
* `tsconfig.json` — same but includes test files (for `type-check`).
* `eslint.config.ts` — copy from `apps/sample-express-xyzzy/eslint.config.ts`.
* `jasmine.json` — copy from `apps/sample-express-xyzzy/jasmine.json`.
* `src/schemas.mts` — exports `greetingInput` (Zod schema) and `GreetingOutput`
  (TypeScript type). No router, no procedure definitions, no handler code.
* `src/sample.test.mts` — minimal passing test.

### Phase 3 — backend package [ ]

Create `composite-apps/sample-composite-app-xyzzy/backend/` based on
`apps/sample-express-xyzzy`.

Key differences from `sample-express-xyzzy`:

* `package.json` — name `@repo/sample-composite-app-xyzzy-backend`; add
  `@trpc/server`, `@trpc/express` as runtime dependencies; add
  `@repo/sample-composite-app-xyzzy-trpc` as a workspace dependency; add
  `@repo/sample-composite-app-xyzzy-frontend` as a `devDependency` so that Turbo
  builds the frontend before the backend (enabling the asset assembly step); add a
  `build-assets` script that copies `../../frontend/dist/**` to `./dist/public`.
* `src/router.mts` — creates `initTRPC.create()`, defines the `greeting` procedure
  using `greetingInput` from `@repo/sample-composite-app-xyzzy-trpc/schemas`, and
  exports `AppRouter = typeof router`. Handler code may freely use Node.js built-in
  packages.
* `src/app.mts` — mount the tRPC Express adapter at `/trpc`; update the static
  files path; update CORS origin to allow `http://localhost:5173` (Vite dev server).
* `src/www.mts`, `src/logger.mts`, `src/morganMiddleware.mts` — copy verbatim from
  `apps/sample-express-xyzzy`.
* `src/routes/` — copy verbatim from `apps/sample-express-xyzzy`.
* `tsconfig.src.json`, `tsconfig.json`, `eslint.config.ts`, `jasmine.json` — copy
  from `apps/sample-express-xyzzy`.
* `src/sample.test.mts` — minimal Jasmine test (same pattern as
  `apps/sample-express-xyzzy`). The `test` script runs Jasmine via
  `tsx ../../../node_modules/jasmine/bin/jasmine.js --color --config=./jasmine.json`.

Build script order: `build-tsc` runs first, then `build-assets` copies the compiled
frontend output. These run sequentially (not in parallel) because the asset copy
depends on frontend having already finished building.

### Phase 4 — frontend package [ ]

Create `composite-apps/sample-composite-app-xyzzy/frontend/` as a Vite + React
app.

Files to create:

* `package.json` — name `@repo/sample-composite-app-xyzzy-frontend`; dependencies:
  `react`, `react-dom`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`,
  `@repo/sample-composite-app-xyzzy-trpc`; devDependencies: `vite`,
  `@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8`, `jsdom`,
  `@testing-library/react`, `@testing-library/user-event`,
  `@testing-library/jest-dom`, TypeScript types; scripts: `build` (`vite build`),
  `dev` (`vite`), `test` (`vitest run`), `lint`, `type-check`, `depcheck`. Note: the
  backend package is NOT listed as a dependency — the `AppRouter` type is resolved
  via a relative TypeScript import that is erased at compile time.
* `vite.config.ts` — standard React plugin config; configure `build.outDir` to
  `dist`; add a `test` block setting `environment: "jsdom"` and
  `setupFiles: ["./src/setupTests.ts"]` so Vitest picks up `@testing-library/jest-dom`
  matchers.
* `tsconfig.json` — standard Vite React TypeScript config (target DOM, bundler
  module resolution).
* `eslint.config.ts` — same pattern as other packages but with `browserGlobals: true`
  and `nodeGlobals: false` in `getJsConfig()`.
* `src/setupTests.ts` — imports `@testing-library/jest-dom` to register custom
  matchers globally for all Vitest tests.
* `src/main.tsx` — React entry point; wraps app in `TRPCProvider` and
  `QueryClientProvider`.
* `src/App.tsx` — calls the `greeting` tRPC query and renders the result.
* `src/App.test.tsx` — Vitest + React Testing Library test that renders `<App />`,
  mocks the tRPC client, and asserts the greeting message is displayed.
* `src/trpc.ts` — creates the tRPC client pointed at `/trpc`; uses
  `import type { AppRouter } from "../../backend/src/router.mjs"` to obtain the
  router type. This is a type-only import and is fully erased before Vite processes
  the file, so no backend code enters the browser bundle.
* `index.html` — Vite entry HTML file.

### Phase 5 — Turbo pipeline wiring [ ]

No changes to the root `turbo.json` are needed. The build ordering is enforced
entirely through `package.json` dependencies:

1. `trpc` has no workspace dependencies — it builds first.
2. `frontend` depends on `trpc` — it builds after `trpc`.
3. `backend` depends on `trpc` and has `frontend` as a `devDependency` — it builds
   last, after both `trpc` and `frontend` are complete.

This order guarantees that when the backend's `build-assets` step copies
`frontend/dist/` into `backend/dist/public/`, the frontend output already exists.

The dependency graph (no cycles):

```text
trpc  <--  backend
trpc  <--  frontend
frontend  <--  backend (devDependency, for build ordering only)
```

### Phase 6 — Verification [ ]

1. Run `npm install` from the repo root to pick up the new workspace packages.
2. Run `npm run build` to confirm all three packages build in the correct order and
   the backend `dist/public/` directory contains the compiled frontend.
3. Start the backend with `node dist/www.mjs` from the backend directory and confirm
   the browser loads the React app at `http://localhost:3000`.
4. Run `npm run all` from the repo root to confirm `build`, `lint`, `test`,
   `type-check`, and `depcheck` all pass.
