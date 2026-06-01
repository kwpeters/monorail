# TypeScript 6 Phased Migration Plan

This document is a reusable implementation checklist for migrating similar TypeScript monorepos to TypeScript 6.

## Scope

Use this plan when the repository has:
- a root TypeScript dependency
- shared tsconfig base files
- per-project emitting configs such as tsconfig.src.json
- workspace-level verification scripts (build, lint, test, type-check)

## Core Risks To Control

- TS 6 changes ambient type defaults (`types` behavior) and can remove globals previously discovered implicitly.
- TS 6 can change output layout if `rootDir` is not explicit in emitting configs.
- Inherited tsconfig relative paths resolve from the config where they are defined.

## Phase 0: Baseline And Safety

### Objectives
- Understand current compiler and config inheritance before changing files.
- Capture a known-good validation baseline.

### Actions
1. Confirm current TypeScript version in root package manifest and lockfile.
2. Map shared config hierarchy and project-level config extensions.
3. Identify which configs emit production output (usually tsconfig.src.json).
4. Run baseline verification:
   - `npm run type-check`
   - `npm run build`

### Exit Criteria
- You know exactly where to change TypeScript version, shared options, and emit settings.
- Baseline commands pass before migration edits.

## Phase 1: Compiler Upgrade

### Objectives
- Move repo compiler to TS 6 without changing behavior yet.

### Actions
1. Bump root TypeScript dependency to latest approved 6.x version.
2. Refresh lockfile.
3. Confirm only one intended TypeScript version is selected in the workspace.

### Exit Criteria
- Root manifest and lockfile are aligned on TS 6.

## Phase 2: Shared Config Compatibility

### Objectives
- Make TS 6 defaults explicit where needed.

### Actions
1. In shared compiler base config, define `compilerOptions.types` for common globals used across projects.
2. Add local overrides in variant configs where additional globals are required (for example VS Code extension host).
3. Do not set `rootDir` in a shared base if child projects have different source roots.

### Exit Criteria
- No project relies on implicit global type discovery.
- Shared base remains path-safe for inheritance.

## Phase 3: Emit Layout Stabilization

### Objectives
- Prevent output path regressions caused by TS 6 default `rootDir` behavior.

### Actions
1. For each emitting config (typically tsconfig.src.json), set:
   - `compilerOptions.rootDir`: `"src"` (or project-specific source root)
2. Do not apply this blindly to non-emitting type-check configs unless needed.
3. Spot-check representative app and package outputs that publish or run from dist.

### Exit Criteria
- Emitted file structure is unchanged relative to pre-migration expectations.

## Phase 4: Verification Gates

### Objectives
- Validate migration correctness from fastest checks to full repo validation.

### Actions
1. Run fast compile gate:
   - `npm run type-check`
2. Run build gate:
   - `npm run build`
3. Run full workspace gate:
   - `npm run all`
4. If repo policy requires, run final full check:
   - `npm run all && npm run type-check`

### Exit Criteria
- All required gates pass.
- Any new warnings are triaged as pre-existing or migration-related.

## Phase 5: Cleanup And Handoff

### Objectives
- Leave a clean, reviewable change set.

### Actions
1. Remove generated transient artifacts from verification (for example `*.tsbuildinfo`) if not tracked.
2. Add `*.tsbuildinfo` to `.gitignore` so incremental compiler caches do not pollute the working tree.
3. Confirm working tree includes only intentional migration changes.
4. Summarize migration deltas for reuse in sibling repos:
   - TS version bump
   - shared `types` strategy
   - per-emitter `rootDir` setting
   - verification results

### Exit Criteria
- Change set is minimal, intentional, and easy to port.

## Optional Rollout Strategy For Multiple Similar Repos

1. Migrate one pilot repo and record exact file-level edits.
2. Create a small reusable checklist of repo-specific knobs:
   - shared config file names
   - emitter config pattern
   - extension/Node globals needed
3. Apply the same phase order repo-by-repo.
4. Keep a short issue template for failures:
   - missing globals
   - changed dist layout
   - module resolution regressions

## Fast Triage Guide

- Error: missing global names (for example Node, Jasmine, VS Code symbols)
  - Fix: adjust `compilerOptions.types` in shared base or local variant override.
- Error: runtime cannot find expected dist path
  - Fix: ensure emitting config has explicit `rootDir` matching source root.
- Error: unexpected module resolution behavior
  - Fix: verify `module` and `moduleResolution` were preserved in variant configs.

## Recommended Commit Structure

1. `chore(ts): upgrade typescript to 6.x`
2. `chore(tsconfig): make ambient types explicit for ts6`
3. `chore(tsconfig): set rootDir on emitting tsconfig.src files`
4. `chore(verify): run full repo validation`

## Migration Summary Template

Use this after each repo migration:

- Compiler: upgraded from TS 5.x to TS 6.x
- Config defaults addressed: `types`, `rootDir`
- Shared config updates: [list files]
- Project-level updates: [list files]
- Validation run: `type-check`, `build`, `all` (pass/fail)
- Residual items: [warnings, follow-ups, none]
