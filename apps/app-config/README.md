# app-config

Interactive CLI for reviewing repository-managed config files against deployed files.

## Command

- app-config review <config-file.json>

Run help:

- app-config --help
- app-config review --help

## Config file format (JSONC)

The config file supports JSONC comments and trailing commas.

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

### Rules

- mappings must be a non-empty array.
- unknown keys are rejected at top-level and mapping-level.
- each mapping allows only repoRelativePath and deployedAbsolutePath.
- repoRelativePath must be a repository-relative single file path.
- deployedAbsolutePath must be an absolute single file path after env expansion.
- deployed env vars must use ${VAR} syntax only.
- ${VAR} lookup is case-sensitive and undefined variables fail before review starts.
- path separators may use / in config and are normalized per OS.

## Review behavior

- mappings are processed in config order.
- each pair is compared using the same FileComparer path used by difftui.
- identical files print a same-file message and auto-advance.
- different files prompt for next or VS Code diff.
- missing deployed files are treated as different.
- after closing VS Code diff, review advances to the next mapping.
- the CLI itself is read-only and does not modify either file.

## Monorepo / tooling

This app is wired for the monorepo ecosystem:

- build, lint, test, and type-check scripts for turbo workflows.
- Node.js SEA packaging using build-app-assist.
- structure and SEA flow adapted from apps/sample-app-sea-xyzzy.

## Build SEA executable

From repository root:

- npm run build --workspace @repo/app-config

Executable output:

- apps/app-config/dist/app-config.exe
