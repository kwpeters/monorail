## Plan: app-config

Build a new CLI application in this monorepo that interactively reviews repository-managed configuration files against their deployed versions. The app will read a JSONC configuration file, iterate through its file entries in order, compare each repository file to its deployed file, automatically skip identical pairs with a message, and prompt the user to either open a VS Code diff or move on when files differ. The CLI itself will be read-only, although the user may edit files inside the VS Code diff window.

**Concrete requirements**
1. The app must read a JSON configuration file and validate it with a strict Zod schema.
2. The config parser must support JSONC-style comments and trailing commas.
3. The app must expose a `review` sub-command with invocation shape `app-config review <config-file.json>`.
4. The config file path must always be supplied explicitly on the command line.
5. The configuration must contain a non-empty array of file mappings.
6. Unknown keys at both the top level and mapping level must be rejected.
7. Each mapping must include `repoRelativePath` and `deployedAbsolutePath`.
8. V1 mapping schema is limited to those two fields only.
9. `repoRelativePath` must be a repository-relative file path.
10. `deployedAbsolutePath` must be an absolute file path.
11. Repository and deployed paths must be explicit single file paths; glob patterns are not allowed.
12. Config paths may use forward slashes (`/`) as directory separators on all operating systems.
13. Before filesystem operations, configured paths must be normalized to the current OS separator.
14. Repository file paths must exist before execution; missing repository files are fatal errors.
15. Deployed file paths may or may not already exist.
16. Missing deployed files must be treated as `different` and handled by the normal prompt flow.
17. Deployed paths may use environment-variable placeholders, and they must be expanded before validation.
18. Deployed environment-variable placeholders must use `${VAR}` syntax only.
19. `${VAR}` placeholder resolution is case-sensitive; exact variable names must exist.
20. Repository file paths must not use environment-variable expansion.
21. The app must evaluate all referenced environment variables before execution and exit immediately with a clear error if any are undefined.
22. All enumerations must be case-sensitive.
23. Any enumerations introduced in the config schema must use Zod-based enums.
24. Mappings must be processed in the exact order they appear in the config file.
25. For each mapping, the app must compare the repository file and deployed file by using the same comparison implementation path used by `difftui` for identical/different determination.
26. If the repository file and deployed file are determined to be identical, the app must print a message stating that they are the same and continue to the next mapping.
27. If the files are determined to be different, the app must prompt the user to either show a VS Code diff or move to the next mapping.
28. If the deployed file is missing and the user chooses diff, the app must still launch VS Code diff.
29. After showing a VS Code diff, closing the diff must automatically continue to the next mapping.
30. Choosing to continue must skip only the current mapping and continue with the next mapping.
31. The CLI itself must be read-only and must not modify repository or deployed files.
32. The VS Code diff must be launched in the same way `difftui` launches diffs.
33. Runtime execution must stop on the first runtime failure.
34. The app must use one default output style with per-item progress messages.
35. No status-summary output is required in v1.
36. No `--verbose` or `--quiet` flags are supported in v1.
37. Prefer shared utilities from `packages/depot` and `packages/depot-node` wherever practical.
38. Interactive prompting must use `packages/depot-node/src/prompts.mts` and `packages/depot-node/src/promptAutocomplete.mts`.
39. VS Code diff launching should use the same underlying helper used by `difftui`.
40. Operating-system handling must use `packages/depot-node/src/os.mts` where needed.
41. Path and directory-separator normalization must use helpers from `packages/depot/src/schemaUtility.mts`.
42. Result/Option and pipeline composition should prefer `packages/depot/src/result.mts`, `packages/depot/src/option.mts`, `packages/depot/src/pipe2.mts`, and `packages/depot/src/pipeAsync2.mts`.
43. Filesystem operations should prefer `packages/depot-node/src/directory.mts` and `packages/depot-node/src/file.mts`.
44. The package must follow the existing monorepo naming pattern (`@repo/<app-name>`).
45. The app should be considered stable from the initial release.
46. Command-line parsing and command wiring must use `yargs` in the same sub-command pattern used by `apps/copywrite`.
47. The app must provide explicit `--help` output that documents command usage, required positional arguments, and option descriptions.
48. Implementation must be test-driven, writing failing tests first for each behavior before production code changes.
49. If needed helper behavior is missing from `packages/depot` or `packages/depot-node`, add or improve those utilities rather than duplicating logic in the app.
50. Any utility additions or modifications in shared packages must include focused tests in the same package.
51. The app must integrate cleanly with the monorepo ecosystem and tooling conventions (workspace scripts, `turbo` pipelines, linting, testing, and type checking).
52. The app must be implemented as a Node.js SEA (single executable application).
53. SEA packaging/build setup should follow the established pattern used by `apps/sample-app-sea-xyzzy`.
54. App-level scripts and configuration should match monorepo conventions so the app participates in shared root commands (`build`, `lint`, `test`, `type-check`, `all`) without special handling.

**Example config (JSONC)**

```jsonc
{
    // app-config review app-config.review.json
    "mappings": [
        {
            "repoRelativePath": "configs/git/.gitconfig",
            "deployedAbsolutePath": "${USERPROFILE}/.gitconfig"
        },
        {
            "repoRelativePath": "configs/vscode/settings.json",
            "deployedAbsolutePath": "${APPDATA}/Code/User/settings.json"
        }
    ]
}
```

**Steps**
- [ ] Implement CLI entrypoint with `yargs` command registration matching `apps/copywrite` sub-command structure.
- [ ] Implement `review` command as `app-config review <config-file.json>` with required positional argument handling.
- [ ] Implement explicit `--help` content and verify it includes usage, required positional arguments, and option/flag descriptions.
- [ ] Write failing tests first for command parsing and help output behavior.
- [ ] Reuse strict Zod config-loading pattern from `apps/mm` and define a strict mappings schema with only `repoRelativePath` and `deployedAbsolutePath`.
- [ ] Write failing tests first for JSONC parsing, strict key rejection, and schema validation errors.
- [ ] Implement preflight validation for `${VAR}` expansion on deployed paths, forward-slash acceptance with OS-specific normalization, missing environment variables, and missing repository files.
- [ ] Write failing tests first for environment-variable expansion rules, case sensitivity, slash normalization, and preflight fatal errors.
- [ ] Implement ordered iteration over mappings.
- [ ] Implement same/different comparison by reusing the same comparison implementation path as `difftui`.
- [ ] Write failing tests first for identical auto-skip and different-file prompt behavior.
- [ ] Implement prompt flow for different files: show VS Code diff or continue to next mapping.
- [ ] Implement diff launch through the same helper path used by `difftui` (currently `@repo/depot-node/fileDiff`).
- [ ] Ensure missing deployed files are treated as different and still support launching diff.
- [ ] Keep CLI behavior read-only with no file writes, copies, links, merges, or backups.
- [ ] Add default per-item progress output with no final status summary.
- [ ] When app logic needs missing shared primitives, add or improve utilities in `packages/depot` or `packages/depot-node`.
- [ ] Add/extend tests in shared utility packages for every utility addition or change.
- [ ] Scaffold the new app by adapting `apps/sample-app-sea-xyzzy` structure and SEA build pattern.
- [ ] Configure app package scripts and project wiring so it participates in monorepo `turbo` build/lint/test/type-check workflows.
- [ ] Implement and verify Node.js SEA packaging/build for the new app.
- [ ] Update repository docs for config format, help output, and interactive review workflow.

**Relevant files**
- `apps/mm/src/cliConfig.mts` — reference for command-line configuration resolution.
- `apps/mm/src/subjectConfiguration.mts` — reference for Zod-based JSON/JSONC config parsing.
- `apps/copywrite/src/index.mts` — reference for `yargs` command registration and `--help` behavior.
- `apps/sample-app-sea-xyzzy/*` — template for Node.js SEA app structure, scripts, and packaging flow.
- `packages/depot/src/zodHelpers.mts` — shared safe-parse helpers for Zod validation.
- `packages/depot/src/schemaUtility.mts` — path-related normalization helpers.
- `packages/depot/src/result.mts` — shared Result utilities and types.
- `packages/depot/src/option.mts` — shared Option utilities and types.
- `packages/depot/src/pipe2.mts` — synchronous pipeline composition helpers.
- `packages/depot/src/pipeAsync2.mts` — asynchronous pipeline composition helpers.
- `packages/depot-node/src/file.mts` — shared file abstraction and helpers.
- `packages/depot-node/src/directory.mts` — shared directory abstraction and helpers.
- `packages/depot-node/src/prompts.mts` — shared interactive prompt utilities.
- `packages/depot-node/src/promptAutocomplete.mts` — shared autocomplete prompt support.
- `packages/depot-node/src/os.mts` — operating-system helper APIs and enums.
- `packages/depot-node/src/fileDiff.mts` — helper that launches a VS Code diff and is already used by `difftui`.
- `apps/difftui/src/diffTuiApp.tsx` — reference for current VS Code diff launching behavior via `showVsCodeDiff(...)`.
- `apps/<new-app>/src/*` — new CLI entry points, config schema, comparison flow, and tests.

**Verification**
1. Confirm JSONC parsing accepts comments and trailing commas.
2. Confirm unknown keys are rejected at both the top level and mapping level.
3. Confirm empty mappings arrays are rejected.
4. Confirm repository file paths must be repository-relative and deployed file paths must be absolute.
5. Confirm forward-slash separators are accepted in config paths on all OSes and normalized before filesystem use.
6. Confirm deployed path parsing accepts `${VAR}` and rejects `$VAR` and `%VAR%`.
7. Confirm `${VAR}` resolution is case-sensitive and fails when the variable exists only with different casing.
8. Confirm missing environment variables fail before iteration begins.
9. Confirm missing repository files fail before iteration begins.
10. Confirm mappings execute in config order.
11. Confirm file identity is determined by the same comparison implementation path used by `difftui`.
12. Confirm pairs determined identical print a same-file message and advance automatically.
13. Confirm pairs determined different prompt the user to either show a diff or continue.
14. Confirm choosing to continue skips only the current mapping.
15. Confirm missing deployed files are treated as `different` and follow the normal prompt/diff flow.
16. Confirm selecting diff for a missing deployed file still launches VS Code diff.
17. Confirm after showing and closing a diff, the app automatically advances to the next mapping.
18. Confirm VS Code diffs are launched through the same helper path used by `difftui`.
19. Confirm the CLI itself performs no file writes.
20. Confirm runtime execution stops on the first runtime failure.
21. Confirm default output includes per-item progress and does not include a final status summary.
22. Confirm no `--verbose` or `--quiet` flags are accepted in v1.
23. Confirm `yargs` command wiring follows the same sub-command style used by `apps/copywrite`.
24. Confirm `--help` output documents usage, required positional argument, and available options/flags.
25. Confirm tests are written first (failing before implementation) for each major behavior area.
26. Confirm any shared utility changes in `packages/depot` or `packages/depot-node` include corresponding tests in those packages.
27. Confirm the app is fully wired into monorepo tooling and runs correctly under root `turbo` build/lint/test/type-check workflows.
28. Confirm SEA packaging/build follows the `apps/sample-app-sea-xyzzy` pattern and successfully produces the executable artifact.

**Decisions**
- The app scope has been simplified from restore/setup into interactive file review.
- The command surface is `app-config review <config-file.json>` and the config file path is always required.
- V1 compares files only, not directories.
- Each mapping identifies one repository file via `repoRelativePath` and one deployed file via `deployedAbsolutePath`.
- V1 mapping schema contains only `repoRelativePath` and `deployedAbsolutePath`.
- Deployed paths are absolute and may use `${VAR}` placeholders.
- Config paths can use forward slashes regardless of OS and are normalized to OS separators before filesystem operations.
- Repository paths are repository-relative and do not support variable expansion.
- The CLI compares each pair before prompting by using the same comparison implementation path as `difftui`.
- Files determined identical are reported and skipped automatically.
- Files determined different prompt for either VS Code diff or continue.
- Missing deployed files are treated as `different` and use the same prompt flow.
- Choosing diff for a missing deployed file still launches VS Code diff.
- After a diff is shown and closed, the app automatically advances to the next mapping.
- Output behavior is a single default style with per-item progress and no final status summary.
- No `--verbose` or `--quiet` flags are supported in v1.
- There is no restore, copy, symlink, merge, or backup behavior in v1.
- The CLI itself is read-only.
- VS Code diff launching should match `difftui`, which currently uses `showVsCodeDiff(...)` from `@repo/depot-node/fileDiff`.
- Shared `depot` and `depot-node` utilities should be used wherever practical.
- CLI command parsing and command registration should follow the `yargs` sub-command pattern used by `apps/copywrite`.
- The command must provide explicit `--help` usage details.
- Development should follow a TDD-first workflow for app behaviors.
- Shared utility improvements are preferred over app-local duplication and must include utility-level tests.
- The new app should fit monorepo tooling conventions so it works with shared root scripts and `turbo` pipelines without custom exceptions.
- Node.js SEA support is a first-class requirement and should follow the existing `apps/sample-app-sea-xyzzy` template pattern.

**Future considerations**
1. Consider a future write-capable workflow only if review-only proves insufficient.
2. Consider future backup or merge-back behavior as a separate subcommand rather than part of the initial review flow.
