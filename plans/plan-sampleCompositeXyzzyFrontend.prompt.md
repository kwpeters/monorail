## Plan: Sample Composite Frontend Setup

Create a new React frontend workspace at composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend using Vite + TypeScript, integrate tRPC via React Query, and wire workspace dependencies so Turborepo infers correct task ordering. Keep the first version intentionally small: one page, no router, no global store, direct backend URL with CORS, and explicitly demonstrate both REST and tRPC calls against the same backend domain logic.

**Steps**
- [x] Step 0a: Phase 0 - Backend preparation: Create `src/domain/itemService.mts` with in-memory Item CRUD (createItem, getItems, getItemById, updateItem).
- [x] Step 0b: Create REST route handlers in `src/routes/apiHealth.mts` (GET /api/health) and `src/routes/apiItems.mts` (GET|POST /api/items, GET|PUT /api/items/:id).
- [x] Step 0c: Extend `src/trpc/router.mts` with an `item` sub-router: item.list, item.getById (queries), item.create and item.update (mutations).
- [x] Step 0d: Wire new REST routes in `src/app.mts` and remove incomplete draft code.
- [ ] Step 1: Phase 1 - Scaffold package structure (foundation)
- [ ] Step 2: Create the new workspace folder and baseline files for a Vite React frontend app: package.json, tsconfig.json, tsconfig.src.json, eslint.config.ts, jasmine.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/vite-env.d.ts, and optional src/sample.test.mts smoke test.
- [ ] Step 3: Add package metadata and scripts aligned with repo conventions and Vite usage: `dev`, `build`, `test`, `lint`, `type-check`, and `depcheck`. Use workspace dependencies with "*" for internal packages.
- [ ] Step 4: Add frontend dependencies: react, react-dom, @trpc/client, @trpc/react-query, @tanstack/react-query, and optional zod for client-side validation. Add dev dependencies needed for the toolchain: vite, @vitejs/plugin-react, @types/react, and @types/react-dom.
- [ ] Step 5: Phase 2 - Type-safe API contract wiring (depends on Phase 1)
- [ ] Step 6: Ensure backend exposes AppRouter through a stable public entrypoint so frontend avoids deep internal imports. If missing, add or refine backend exports.
- [ ] Step 7: Add frontend dependency on @repo/sample-composite-xyzzy-backend in package.json so Turbo task graph includes backend -> frontend ordering for build and type-check.
- [ ] Step 8: Configure frontend tRPC client with an HTTP batch link pointing to http://localhost:3000/trpc, and create a shared QueryClient + tRPC provider composition in main.tsx.
- [ ] Step 9: Phase 3 - Minimal UI and validation (depends on Phase 2)
- [ ] Step 10: Implement a single-page example demonstrating both REST (GET /api/health, GET /api/items, POST /api/items) and tRPC (health, item.list, item.create) APIs side by side, with loading/error/success states for each call.
- [ ] Step 11: Keep state local to components (no global store) and avoid routing to keep the sample focused on API integration.
- [ ] Step 12: Phase 4 - Verification and polishing (parallel with minor cleanup)
- [ ] Step 13: Validate workspace scripts run for the new frontend package and then run monorepo-level checks.
- [ ] Step 14: Confirm CORS behavior from browser to backend direct URL and verify request/response flow in dev.
- [ ] Step 15: Optional follow-up: if CORS friction appears, add Vite proxy in a later iteration.

**Relevant files**
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/package.json - New frontend workspace manifest, scripts, and dependency edges.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/tsconfig.json - App-level type-check config.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/tsconfig.src.json - Build-time TypeScript config.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/eslint.config.ts - Repo-standard ESLint setup via @repo/eslint-config.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/vite.config.ts - Vite dev/build configuration for the React frontend.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/src/main.tsx - React root, providers (React Query + tRPC), app bootstrap.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/src/App.tsx - Minimal UI exercising tRPC procedures.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-frontend/src/vite-env.d.ts - Vite TypeScript ambient declarations for client code.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-backend/src/domain/itemService.mts - Shared in-memory Item domain logic called by both REST and tRPC layers.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-backend/src/routes/apiHealth.mts - REST health endpoint at GET /api/health.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-backend/src/routes/apiItems.mts - REST item CRUD endpoints at /api/items.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-backend/src/trpc/router.mts - Current source of AppRouter type, including health and item procedures.
- composite-apps/sample-composite-xyzzy/sample-composite-xyzzy-backend/package.json - Backend package entrypoint and package name used by the frontend dependency edge until a dedicated public AppRouter export is added.

**Verification**
1. Package-level checks for frontend: npm run -w @repo/sample-composite-xyzzy-frontend build, lint, test, type-check, depcheck.
2. Repo checks per project convention: npm run all && npm run type-check.
3. Manual dev check: run backend and frontend, load page, confirm REST health/items calls and tRPC health/item calls succeed against http://localhost:3000.
4. Turborepo ordering check: run turbo build filter for frontend and verify backend task executes first due to workspace dependency.

**Decisions**
- Included: React + Vite + TypeScript frontend with tRPC React Query integration.
- Included: Single-page demo without router and without global store.
- Included: Direct backend URL calls with CORS for first version.
- Excluded (for now): Authentication, SSR, advanced caching strategy, global state management, multi-page routing.

**Further Considerations**
1. Backend export surface: the backend currently exposes `AppRouter` from `src/trpc/router.mts`; add a stable package-root export before wiring the frontend to avoid deep internal imports.
2. Dev ergonomics: Vite proxy can be introduced later if direct CORS workflow becomes noisy.
3. Future scale: if multiple frontends will consume the API, consider extracting API contract types to a dedicated shared package.
