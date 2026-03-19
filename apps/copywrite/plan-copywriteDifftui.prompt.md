## Plan: Copywrite Difftui Command

Build a new copywrite command named difftui that keeps behavioral parity with diff (same DiffDirFileItem actions plus VS Code diff) while replacing the item-by-item prompt loop with an Ink-driven TUI file list and details/actions panel. The command will accept only leftDir and rightDir on the CLI; all other diff settings will be configured interactively, applied on explicit refresh, and optionally exported to difftui.json.

**Steps**
1. Phase 1: Command surface and data contracts
2. Add the new command module in apps/copywrite/src next to commandDiff.mts, exporting command/describe/builder/handler with command string difftui <leftDir> <rightDir>; builder should validate the two directories only (depends on existing Directory/path validation pattern used by commandDiff.mts).
3. Register the new command in apps/copywrite/src/index.mts by importing the new module and adding .command(...) in yargs setup (depends on step 2).
4. Define a typed settings model for interactive options (action priority, includeIdentical, includeLeftOnly, includeRightOnly, includePatterns, excludePatterns) with defaults matching current diff behavior; add parsing/normalization helpers for comma-separated pattern text fields (parallel with step 3).
5. Phase 2: Config file import/export (strict schema)
6. Add a strict Zod schema for difftui.json (interactive options only) and loader/exporter helpers. Startup behavior: if difftui.json exists in current working directory, parse strictly; on any missing/invalid/unknown value, print error and exit. If not present, use defaults (depends on step 4).
7. Implement settings export action in the settings panel, triggered by Enter on Export control and Ctrl+E shortcut, writing the current interactive settings to working-directory difftui.json (depends on step 6).
8. Phase 3: Ink UI composition and interaction model
9. Add Ink dependencies for copywrite and build a TUI app component tree with: file list pane (selected row + compact status badge), details/action pane, and hidden-by-default settings panel toggled with s (depends on steps 2, 4, 6).
10. Implement keyboard controls: Up/Down selection, Enter action menu, d open VS Code diff for selected item, s toggle settings panel, r apply/refresh recomputation, q quit, Ctrl+E export config (depends on step 9).
11. Implement action flow parity: fetch current item actions from DiffDirFileItem.actions(actionPriority), include all execute actions and diff action, require per-action confirmation, execute and then refresh status while preserving selection when possible (nearest-next fallback when selection disappears) (depends on steps 9-10).
12. Implement recomputation policy: update settings inputs immediately in UI state but only recompute diff list on explicit Apply/Refresh; preserve returned ordering from diffDirectories; if no matching files, show empty state in TUI and keep settings accessible (depends on steps 9-11).
13. Phase 4: Testable non-UI logic and verification
14. Extract non-UI logic into focused functions (settings normalization, schema parse/validation, selection retention after refresh, action mapping) and add unit tests for these helpers (depends on steps 4, 6, 11, 12).
15. Run project and monorepo verification commands to ensure no regressions (depends on step 14).

**Relevant files**
- apps/copywrite/src/commandDiff.mts — parity source for diff behavior, defaults, action execution semantics, summary/status patterns.
- apps/copywrite/src/index.mts — command registration for difftui.
- apps/copywrite/package.json — add Ink-related dependencies for the app.
- apps/copywrite/src — add new difftui command module and supporting state/config helpers.
- apps/copywrite/src/sample.test.mts — existing test baseline; expand with new focused tests in this folder.
- packages/depot/src/zodHelpers.mts — safeParse and error-string utilities for strict config parsing.
- packages/depot/src/schemaUtility.mts — reusable schema helpers and strict-object style examples.

**Verification**
1. Targeted command build/test during development: npm run build --workspace @repo/copywrite, npm run test --workspace @repo/copywrite, npm run lint --workspace @repo/copywrite.
2. Manual smoke checks for difftui:
3. Launch difftui with valid leftDir/rightDir and verify startup defaults.
4. Verify keyboard controls (Up/Down, Enter, d, s, r, q, Ctrl+E).
5. Change settings without apply and verify list does not recompute until apply/refresh.
6. Execute each available action type with confirmation and verify post-action refresh + selection retention behavior.
7. Validate empty-state behavior and recovery via settings changes.
8. Validate config export creates difftui.json in cwd.
9. Validate strict config import failures (unknown key, missing required value, invalid enum/type) produce error and exit.
10. Full monorepo verification before completion: npm run all && npm run type-check.

**Decisions**
- Command name: difftui, with only positional arguments leftDir and rightDir.
- UI model: single-pane list with details/actions panel; file list uses status badge per row.
- Diff parity: include all DiffDirFileItem action choices plus diff action.
- No next/end actions: list navigation and quit controls replace these.
- Settings changes require explicit apply/refresh to recompute results.
- Ordering uses diffDirectories returned order (no additional sorting).
- Confirmation required for every execute action in v1.
- Persistence model: optional export/import via difftui.json in working directory; strict schema validation with hard-fail on invalid file.

**Further Considerations**
1. Keep Ink-specific UI/state logic local to copywrite for v1, then evaluate extracting shared TUI primitives only after behavior stabilizes.
2. Prefer a thin orchestration handler in the command module and isolate pure state transitions into helper modules to keep tests deterministic.
