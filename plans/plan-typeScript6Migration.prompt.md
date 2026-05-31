## Plan: TypeScript 6 Migration

Upgrade the monorepo from TypeScript 5.9.3 to TypeScript 6.0.3 with a config-first pass that preserves current output layout and restores the global types the repo currently gets implicitly from 5.9. The main risk is not the package version bump itself, but TypeScript 6.0’s new defaults: `rootDir` now defaults to `.` and `types` now defaults to `[]`, which will change emitted file paths and remove ambient globals unless we make them explicit.

**Steps**
1. Update the root TypeScript dependency in [package.json](package.json) to 6.0.3 and refresh the lockfile, then confirm the workspace still resolves one compiler version for all packages.
2. Centralize the 6.0-safe defaults in [packages/typescript-config/tsconfig.compileroptions.json](packages/typescript-config/tsconfig.compileroptions.json). Add an explicit `types` baseline for the common Jasmine globals, then layer project-specific `types` overrides where Node or VS Code globals are also required. Do not try to place `rootDir` in the shared base, because inherited relative paths resolve from the base config file rather than the consuming project.
3. Audit the variant configs that extend the shared base, especially [packages/typescript-config/tsconfig.vsc-extension.json](packages/typescript-config/tsconfig.vsc-extension.json), [packages/typescript-config/tsconfig.sea-app.json](packages/typescript-config/tsconfig.sea-app.json), and representative app/package configs such as [apps/airliner/tsconfig.json](apps/airliner/tsconfig.json) and [packages/depot/tsconfig.json](packages/depot/tsconfig.json). Confirm their `outDir`, `module`, and `moduleResolution` choices still align with TypeScript 6.0 and that no project is accidentally depending on now-deprecated behavior.
4. Reconcile repo-specific globals and ambient types. The current workspace mostly relies on implicit `@types/*` discovery, so add `node` only to the workspaces that already declare it and keep the VS Code extension on `vscode` plus Jasmine. If a single shared `types` list would be too broad, keep the overrides local instead of widening the whole repo.
5. Validate emitted file paths and declaration output for packages with `main` or `types` entry points, with special attention to [apps/airliner/package.json](apps/airliner/package.json) and any library packages that publish `dist` files. The rootDir change is the main thing that could silently break runtime resolution even if type-checking passes, so it must be verified in each emitting `tsconfig.src.json`.
6. Run repo-wide verification and fix any TypeScript 6.0 fallout. Start with the cheapest checks that can fail fast, then use the full monorepo verification command once the compiler upgrade is stable.

**Relevant files**
- [package.json](package.json) — bump the root `typescript` devDependency and keep the workspace on one compiler version.
- [packages/typescript-config/tsconfig.compileroptions.json](packages/typescript-config/tsconfig.compileroptions.json) — main migration surface for `rootDir`, `types`, and any follow-up compatibility flags.
- [packages/typescript-config/tsconfig.app.json](packages/typescript-config/tsconfig.app.json) — app-specific inheritance point for source compiles.
- [packages/typescript-config/tsconfig.package.json](packages/typescript-config/tsconfig.package.json) — library/package inheritance point for declaration emit.
- [packages/typescript-config/tsconfig.vsc-extension.json](packages/typescript-config/tsconfig.vsc-extension.json) — extension-host variant to verify against Node16/VS Code behavior.
- [packages/typescript-config/tsconfig.sea-app.json](packages/typescript-config/tsconfig.sea-app.json) — SEA-specific Node16 variant that should be checked for module-resolution compatibility.
- [apps/airliner/tsconfig.json](apps/airliner/tsconfig.json) and [apps/airliner/package.json](apps/airliner/package.json) — high-risk output-path check because its entrypoint points into `dist`.
- [packages/depot/tsconfig.json](packages/depot/tsconfig.json) and [packages/depot/package.json](packages/depot/package.json) — representative library package with declaration output.

**Verification**
1. Run the narrowest TypeScript compile checks first on representative projects that exercise each shared config variant.
2. Run `npm run type-check` after the config changes to catch workspace-wide type fallout from the new `types` default.
3. Run `npm run build` and then `npm run all` if the initial checks pass, so output layout, lint, tests, and dependency checks all get exercised.
4. Inspect any new diagnostics for missing globals, changed module resolution, or shifted output paths before considering the migration complete.

**Decisions**
- Prefer fixing the repo’s config to match the current behavior instead of relying on `ignoreDeprecations` as the long-term solution.
- Do not plan on changing module format wholesale; the repo already uses modern `NodeNext`/`Node16` settings, so the migration should focus on preserving behavior rather than re-architecting module strategy.
- Keep the shared test-globals baseline centralized, but allow local overrides for Node- or VS Code-specific workspaces.

**Further Considerations**
1. If you want, the upgrade can be staged with `ignoreDeprecations: "6.0"` as a temporary bridge, but that should be treated as a short-lived fallback rather than the target state.
2. If the type-check reveals noisy new errors from stricter inference or declaration emit ordering, the follow-up should be to fix the affected code paths locally instead of loosening the compiler globally.
