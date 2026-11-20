# Two new ideas for Airliner

## Objective

Replace the Airliner commands `copyRepoFilePathCommand` and `copyRepoDirectoryPathCommand`
with a single `copyRepoPathCommand` that shows both files and directories,
and let the user choose, after selecting an item, whether to copy a path or a permalink.

## Background Information

- Source notes: `scratch5.md` ("Two new ideas for Airliner"), a global scratchpad of the user.
- Idea 1, in the user's words:
  "I wonder if the copyRepoFilePathCommand and copyRepoDirectoryPathCommand commands could be combined into a single copyRepoPathCommand that would show both files and directories."
- Idea 2, in the user's words:
  "After selecting the file or directory, would it be possible to first prompt the user whether they want a path or a permalink?
  If the user wants a permalink, we should implement the logic contained in the `make-permalinks` skill to generate the permalink.
  I suspect a lot of the logic could be put in the depot or depot-node utility libraries."
- Both commands exist because of the finished plan `plans/2026-11-20_airliner-copy-repo-path-commands.md`.
  Its Task 5 and Task 6 Outcomes describe them.
- In `apps/airliner/src/commands.mts`,
  `copyRepoFilePathCommand` is `copyPathOfChosenItem("file", enumerateFiles)`
  and `copyRepoDirectoryPathCommand` is `copyPathOfChosenItem("directory", enumerateDirectories)`.
  Both are registered in the `commands` array and in `contributes.commands` in `apps/airliner/package.json`
  as `extension.airlinerCopyRepoFilePath` and `extension.airlinerCopyRepoDirectoryPath`.
- `copyPathOfChosenItem(itemNoun, enumerate)` in `apps/airliner/src/commands.mts` calls `chooseWorkspaceFolder()`,
  enumerates from `repoRoot ?? folder`,
  lists the items in a Quick Pick labelled with relative paths,
  asks "Repo-relative path" or "Absolute path" only when a repo root was found,
  asks "Use forward slashes" or "Use backslashes" only on Windows,
  formats with `formatPath`, copies, and shows `Copied: <path>` in the status bar.
  Escape on any Quick Pick copies nothing.
- `packages/depot-node/src/repoEnumeration.mts` (export `@repo/depot-node/repoEnumeration`)
  has `enumerateFiles`, `enumerateDirectories` and `enumerateProjects`,
  which skip a hard-coded ignore list of directory names, and the pure function `formatPath`.
  The enumerate functions resolve with paths relative to the root, with forward slashes.
- `packages/depot-node/src/gitRepo.mts` has `findGitRepoRootDir`, `isGitRepoDir` and the `GitRepo` class.
  `packages/depot-node/src/gitHelpers.mts` has `isGitUrl`, `gitUrlToProjectName` and `dirToProjectName`.
- The `make-permalinks` skill is at `C:\Users\kwpeters\.claude\skills\make-permalinks\SKILL.md`.
  Its "Convert One Path" section turns a local file path, with an optional line or range, into a GitHub or GitLab permalink:
  - find the repository with `git rev-parse --show-toplevel`;
  - find the path in the repository with `git ls-files --full-name`, and stop when the file is not tracked;
  - turn `git remote get-url origin` (SSH or HTTPS form) into `https://<host>/<project path>`,
    dropping users, tokens and `.git`, and asking the user for the web host when an SSH host has no dot;
  - decide GitHub or GitLab from the host name, and ask the user for any other host;
  - use the full 40-character `git rev-parse HEAD`;
  - check that the commit is pushed (`git branch -r --list "origin/*" --contains <hash>`, with one `git fetch origin`)
    and that the file has no uncommitted changes (`git status --porcelain`),
    asking the user whether to link anyway, stop, or leave the path unconverted when either check fails;
  - build `<web address>/blob/<hash>/<path>` for GitHub or `<web address>/-/blob/<hash>/<path>` for GitLab,
    percent-encoding each path segment, adding `?plain=1` for rendered file types when a line anchor is used,
    and never writing a token from the remote URL into a link.
- The skill covered files only when this plan was written, and did not say how to link a directory.
  While Task 3 was being done it was updated to cover directories too,
  the same way Task 2 decided: `ls-files -- .` and `rev-parse --show-prefix`, `tree` in place of `blob`, no line anchor.

## Implementation

The work needed to achieve the objective is defined in the following subsections.

### Task 1: Decide how the combined command lists items

Status: Done

#### Task Description

Settle the details of idea 1 with the user.

Answered (see Outcomes): how the combined list shows files and directories.

Answered (see Outcomes): what happens to the old commands.

Answered (see Outcomes): the new command's ID and title.

Done when: the Outcomes record an answer to each open question above.

#### Outcomes

- List: one list sorted by path, with files and directories mixed ("Yes, use that.").
  Each item's label is its relative path, and a directory's label ends in `/`, for example `apps/airliner/src/`.
  Each item also has an `iconPath` icon, `file` for files and `folder` for directories.
  The copied path never includes the trailing `/`.
- Old commands: removed ("Yes, remove them.").
  `extension.airlinerCopyRepoFilePath` and `extension.airlinerCopyRepoDirectoryPath` are deleted from `apps/airliner/src/commands.mts`
  (the command definitions and their entries in the `commands` array)
  and from `contributes.commands` in `apps/airliner/package.json`.
  The shared helper `copyPathOfChosenItem` moves into the new command and takes its items from both `enumerateFiles` and `enumerateDirectories`.
- ID and title: ID `extension.airlinerCopyRepoPath`, title "Airliner copy repo path",
  and `copyRepoPathCommand` as the constant's name ("Yes, use that.").

### Task 2: Decide how permalinks work for directories and for the skill's questions

Status: Done

#### Task Description

The `make-permalinks` skill covers files only, and it asks the user questions when something is wrong.
The notes do not say how the Airliner command handles these, so decide them with the user:

Answered (see Outcomes): how a directory's permalink is built.

Answered (see Outcomes): how the command handles an unpushed commit and uncommitted changes.

Answered (see Outcomes): how the command handles the other cases where no permalink can be built.

Answered (see Outcomes): when the "path or permalink" prompt appears.

Answered (see Outcomes): whether a permalink includes a line number or range.

Done when: the Outcomes record an answer to each open question above.

#### Outcomes

- Directory permalink ("Yes, use that."):
  GitHub `<web address>/tree/<hash>/<path>`, GitLab `<web address>/-/tree/<hash>/<path>`.
  The rest of the skill's logic is unchanged: the full 40-character hash, percent-encoded path segments, no tokens in the URL.
  `?plain=1` does not apply to directories.
- Unpushed commit, or uncommitted changes in the item (a directory counts as changed when anything under it is):
  the user's answer, in place of the skill's three-way question: "Pop up a toast that describes the error and then cancel the operation."
  So the command shows an error message that describes the problem, copies nothing, and ends.
- Every other case where no permalink can be built ("Yes, handle them all that way."):
  no `origin` remote, a host that is neither GitHub nor GitLab, an SSH host with no dot in its name,
  an item that is not tracked by Git (for a directory, no tracked file under it), and no repo root.
  The command shows one error message that describes each problem found (so an unpushed commit and uncommitted changes appear together),
  copies nothing, and ends.
  It never asks a follow-up question about hosts, so the skill's "ask the user which host" steps are not implemented.
- Prompt order ("Yes, use that."):
  1. Choose the workspace folder.
  2. Pick an item.
  3. A Quick Pick with the labels "Path" and "Permalink", path first.
  4. For "Path", the existing "Repo-relative path" / "Absolute path" prompt (only when a repo root was found)
     and the Windows-only slash prompt follow.
     For "Permalink", those prompts are skipped, the permalink is built and copied, and `Copied: <url>` is shown in the status bar.
  Escape on any Quick Pick copies nothing.
  The "Path" / "Permalink" prompt appears even when there is no repo root,
  and then choosing "Permalink" shows the error message from the previous bullet.
- Line numbers ("Yes, no line numbers."):
  a permalink never includes a line number or range, so it points at the whole file or directory.
  The skill's `?plain=1` rule, which applies only with a line anchor, is therefore not needed.

### Task 3: Add permalink helpers to depot and depot-node

Status: Done

#### Task Description

The notes say, "I suspect a lot of the logic could be put in the depot or depot-node utility libraries."
Put the reusable logic of the `make-permalinks` skill's "Convert One Path" section in the libraries,
following the decisions in Task 2's Outcomes and the split below:

- [x] In `packages/depot/src/gitPermalink.mts`, add pure functions that:
  turn an `origin` URL (SSH, `ssh://` and HTTPS forms) into a web address,
  dropping users, tokens, ports on SSH forms and a trailing `.git`,
  and reporting a problem for an SSH host with no dot in its name;
  decide GitHub or GitLab from the host name, and report a problem for any other host;
  and build the URL for a file (`/blob/`, GitLab `/-/blob/`) or a directory (`/tree/`, GitLab `/-/tree/`),
  with the full hash and percent-encoded path segments and no line anchor.
- [x] Add the `./gitPermalink` export to `packages/depot/package.json`.
- [x] Add unit tests for those functions in `packages/depot/src/gitPermalink.test.mts`,
  covering each remote URL form, a token in the URL never appearing in the result,
  both hosts, both item kinds, and percent-encoding of a space, `#`, `?` and `%`.
- [x] In `packages/depot-node/src/gitPermalink.mts`, add `makeGitPermalink(item: File | Directory)`.
  It runs the `git` commands with `-C <dir>` through `spawn2`, where `<dir>` is the file's directory or the directory itself:
  `rev-parse --show-toplevel`, `ls-files --full-name` (for a directory, `rev-parse --show-prefix` gives its path in the repo,
  and any tracked file under it makes it tracked), `remote get-url origin`, `rev-parse HEAD`,
  `branch -r --list "origin/*" --contains <hash>` (with one `git fetch origin` before giving up),
  and `status --porcelain -- <item>`.
  It resolves with a `Result` that succeeds with the URL, or fails with a list of problem strings
  covering each case in Task 2's Outcomes: no repo, untracked, no `origin`, unsupported host, unpushed commit and uncommitted changes.
- [x] Add the `./gitPermalink` export to `packages/depot-node/package.json`.
- [x] Add unit tests in `packages/depot-node/src/gitPermalink.test.mts` that use a real temporary Git repo with a local bare repo as `origin`
  (no network), covering a success for a file and a directory, and each failure case, including two problems reported together.

Done when: the new unit tests pass,
and `npm run type-check` and eslint pass for `packages/depot` and `packages/depot-node`.

#### Outcomes

- `packages/depot/src/gitPermalink.mts` (export `@repo/depot/gitPermalink`) has three pure functions:
  - `remoteUrlToWebInfo(remoteUrl): Result<{ host, webAddress }, string>`;
  - `gitHostKind(host): Result<"github" | "gitlab", string>`;
  - `buildPermalinkUrl(webAddress, host, hash, repoPath, kind: "file" | "directory"): string`.
  It also exports the types `GitHost`, `GitItemKind` and `IRemoteWebInfo`.
  14 unit tests in `gitPermalink.test.mts` pass.
- `packages/depot-node/src/gitPermalink.mts` (export `@repo/depot-node/gitPermalink`) has
  `makeGitPermalink(item: File | Directory, options?: { fetchOrigin?: boolean }): Promise<Result<string, Array<string>>>`.
  It always resolves: a succeeded result holds the URL, a failed result holds one string per problem found,
  suitable for joining into the error message of Task 5.
  `fetchOrigin` defaults to true and only matters when the commit is not on any `origin` branch;
  the tests pass false so they do not touch the network.
  All `git` calls use `git -C <dir> --literal-pathspecs`, `GIT_TERMINAL_PROMPT=0` and an ignored stdin.
  16 unit tests, using a real temporary repo whose pushes go to a local bare repo, cover:
  success for a file, a directory, the repo root and a path with spaces, a GitLab remote,
  and each failure (not in a repo, missing directory, untracked file, untracked directory, no `origin`,
  unsupported host, SSH host alias, unpushed commit, uncommitted changes to a file and under a directory, and two problems together).
- Checked with a forced, uncached `npx turbo run build lint test type-check depcheck` for `@repo/depot` and `@repo/depot-node`:
  all 12 tasks succeeded, with 1588 `depot` specs and 678 `depot-node` specs passing.
- Fact: `apps/airliner` resolves `@repo/depot-node/gitPermalink` through `depot-node`'s built `dist`,
  and `depot-node` resolves `@repo/depot` the same way,
  so `npm run build` must run in `packages/depot` and then `packages/depot-node` before Task 5 imports it.
- The new `depot-node` test file takes about 15 seconds, because it runs many `git` processes.

### Task 4: Combine the two commands into copyRepoPathCommand

Status: Done

#### Task Description

Implement Task 1's decisions in `apps/airliner/src/commands.mts` and `apps/airliner/package.json`:

- [x] Add `copyRepoPathCommand` (`extension.airlinerCopyRepoPath`, "Airliner copy repo path") to `commands.mts`.
  Its Quick Pick lists the results of `enumerateFiles` and `enumerateDirectories` together, sorted by path.
  A directory's label ends in `/` and has a `folder` icon, a file has a `file` icon, and the copied path has no trailing `/`.
- [x] Move the behavior of `copyPathOfChosenItem` into it, and remove `copyPathOfChosenItem`.
- [x] Remove `copyRepoFilePathCommand` and `copyRepoDirectoryPathCommand`
  from `commands.mts` (the definitions and their entries in the `commands` array)
  and `extension.airlinerCopyRepoFilePath` and `extension.airlinerCopyRepoDirectoryPath` from `contributes.commands` in `package.json`.
- [x] Register `copyRepoPathCommand` in the `commands` array and `extension.airlinerCopyRepoPath` in `contributes.commands`.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, the extension bundles with the new command and without the old two,
and no source file refers to the old command IDs.
The hand test is part of Task 8.

#### Outcomes

- `copyRepoPathCommand` (`extension.airlinerCopyRepoPath`, "Airliner copy repo path") is in `apps/airliner/src/commands.mts`,
  in the `commands` array, and in `contributes.commands` in `apps/airliner/package.json`.
  `copyRepoFilePathCommand`, `copyRepoDirectoryPathCommand` and `copyPathOfChosenItem` are gone,
  and no source or JSON file refers to the old command IDs or names.
- The command enumerates with `enumerateFiles` and `enumerateDirectories` in parallel from `repoRoot ?? folder`,
  and builds one Quick Pick list sorted by label, so each directory sits right before its contents.
  A file item's label is its relative path with a `file` icon (`iconPath`),
  and a directory item's label is its relative path plus `/` with a `folder` icon.
  Each item also carries `relPath`, the path without the trailing `/`, which is what is passed to `formatPath`.
  The rest of the flow is unchanged: the "Repo-relative path" / "Absolute path" Quick Pick only when a repo root was found,
  the slash Quick Pick only on Windows, `Copied: <path>` in the status bar, and Escape on any Quick Pick copies nothing.
- Input for Task 5: the list items do not yet record whether they are a file or a directory.
  Task 5 needs that to build a `File` or a `Directory` for `makeGitPermalink`, so it must add a `kind` to the items.
  The flow currently ends at the `formatPath` call near the end of `fn`, which is where the "Path" / "Permalink" prompt goes, before it.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`,
  and `npm run esbuild-dev` bundles `extension.airlinerCopyRepoPath` and neither old ID.
- Not checked: the command in the Extension Development Host; Task 8 covers it.

### Task 5: Add the path or permalink prompt

Status: Done

#### Task Description

Add the prompt to `copyRepoPathCommand` and generate permalinks using the Task 3 helpers,
following the prompt order in Task 2's Outcomes:

- [x] After an item is picked, ask a Quick Pick with the labels "Path" and "Permalink", path first.
  Escape copies nothing.
- [x] For "Path", continue with the existing "Repo-relative path" / "Absolute path" prompt (only when a repo root was found)
  and the Windows-only slash prompt.
- [x] For "Permalink", skip those prompts and call `makeGitPermalink` with the picked item as a `File` or a `Directory`.
- [x] When `makeGitPermalink` fails, show one error message that describes every problem it reports, copy nothing, and end.
- [x] When it succeeds, copy the URL and show `Copied: <url>` in the status bar.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, and the extension bundles.
The hand test is part of Task 8.

#### Outcomes

- `copyRepoPathCommand` in `apps/airliner/src/commands.mts` now asks a "Path" / "Permalink" Quick Pick (path first, title "Copy as")
  right after an item is picked.
  Escape copies nothing.
  "Path" continues with the unchanged relative/absolute and slash prompts and `formatPath`.
  "Permalink" builds a `File` or a `Directory` from `baseDir` and the item's `relPath`,
  calls `makeGitPermalink`, and on success copies the URL and shows `Copied: <url>` for 3 seconds.
  On failure it shows one error message, `Could not make a permalink for <relPath>: <problems>`,
  with the problems joined by two spaces, copies nothing, and ends.
  With no repo root the prompt still appears, and "Permalink" then ends in that error message (Task 2's decision).
- The list items carry `itemKind: "file" | "directory"` for this.
  It is not named `kind`, because `vscode.QuickPickItem` already has a `kind` property and the clash collapses the item type to `never`.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`,
  and `npm run esbuild-dev` bundles the command with `makeGitPermalink`.
  `makeGitPermalink` also ran against real items in this repo and failed as designed:
  the current commit is not on any `origin` branch, and the directory and the plan file have uncommitted changes.
  Each call took about 1.7 seconds, including the one `git fetch origin`.
- Not checked: the prompt in the Extension Development Host, and a permalink that succeeds in a real repo; Task 8 covers both.
  The success path is covered by the `depot-node` unit tests.

### Task 6: Show progress while a permalink is being made

Status: Done

#### Task Description

The `git fetch origin` makes a permalink take a second or two, and `copyRepoPathCommand` shows nothing meanwhile.
In `apps/airliner/src/commands.mts`:

- [x] Wrap the `makeGitPermalink` call in `vscode.window.withProgress` with `location: vscode.ProgressLocation.Notification`
  and the title "Making permalink...", so the progress shows as a toast and not in the status bar.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, the extension bundles,
and the `makeGitPermalink` call is wrapped by `withProgress`.
The hand test is part of Task 8.

#### Outcomes

- In `copyRepoPathCommand` in `apps/airliner/src/commands.mts`, the `makeGitPermalink(item)` call is now
  `vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Making permalink..." }, () => makeGitPermalink(item))`.
  The progress toast disappears when `makeGitPermalink` resolves, and the success and error handling after it are unchanged.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`,
  and `npm run esbuild-dev` bundles the command with "Making permalink...".
- Not checked: the progress toast in the Extension Development Host; Task 8 covers it.

### Task 7: Show copy confirmations as toasts

Status: Done

#### Task Description

Messages in the status bar are extremely easy to overlook.
In `apps/airliner/src/commands.mts`:

- [x] Replace the three `vscode.window.setStatusBarMessage("Copied: ...", 3000)` calls
  (one in `copyRepoProjectNameCommand`, and two in `copyRepoPathCommand`, for a path and for a permalink)
  with `vscode.window.showInformationMessage("Copied: ...")`.
  Every other informational message in `apps/airliner/src` is already a toast.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, the extension bundles,
and no `setStatusBarMessage` call remains in `apps/airliner/src`.
The hand test is part of Task 8.

#### Outcomes

- The three `Copied: ...` confirmations in `apps/airliner/src/commands.mts`
  (`copyRepoProjectNameCommand`, and the path and permalink branches of `copyRepoPathCommand`)
  now use `vscode.window.showInformationMessage`, so they are toasts with no 3-second timeout.
  No `setStatusBarMessage` call remains in `apps/airliner/src`, or in the bundled `dist/extension.js`.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`, and `npm run esbuild-dev` bundles.
- Not checked: the toasts in the Extension Development Host; Task 8 covers it.
- The Outcomes of Tasks 4 and 5, and of the earlier plan, still say "status bar" for `Copied:`;
  they describe what was done at the time and are not changed.

### Task 8: Verify the build

Status: Done

#### Task Description

Run the repo's full verification command from the repo root:

```powershell
npm run all && npm run type-check
```

Then the user tries `copyRepoPathCommand` by hand in the Extension Development Host:
a file and a directory, as a path and as a permalink, in a repo and in a folder that is not in a repo,
and a permalink for an item with uncommitted changes, which should show the error message and copy nothing.
Also check that each `Copied:` confirmation appears as a toast, and that making a permalink shows a "Making permalink..." progress toast.

Done when: the command exits with code 0, and the user confirms the hand test.

#### Outcomes

- `npm run all && npm run type-check` exited with code 0 from the repo root.
  Each Turborepo phase reported 45 of 45 tasks successful,
  with 44 of 45 replayed from the cache in the phases whose summary I read, so the one changed package, `airliner`, was run for real.
  The new code in `depot` and `depot-node` was already checked by a forced, uncached run in Task 3:
  1588 `depot` specs and 678 `depot-node` specs pass, and they passed again here.
- The hand test passed: the user ran the checks listed for this task in the Extension Development Host and reported "All the test work great."
  The report did not itemize the individual checks.

### Task 9: Add a command that copies the path or permalink of the current file

Status: Done

#### Task Description

Add a command that does essentially what `copyRepoPathCommand` does,
except that the active editor's file is the target, instead of prompting the user to pick an item.
In `apps/airliner/src/commands.mts` and `apps/airliner/package.json`:

- [x] Add the command, with no item Quick Pick; its target is the active editor's file.
- [x] Move the steps that follow picking an item out of `copyRepoPathCommand` into a helper shared by both commands:
  the "Path" / "Permalink" Quick Pick, the relative/absolute and slash prompts, `formatPath`,
  `makeGitPermalink` with its progress toast, the clipboard, and the `Copied:` toast.
  Neither command copies that code.
- [x] Register the command in the `commands` array and in `contributes.commands`.
- [x] Have the user try both `copyRepoPathCommand` and the new command by hand in the Extension Development Host,
  since the shared helper changes `copyRepoPathCommand` too.

The new command's ID is `extension.airlinerCopyCurrentFilePath`, its title is "Airliner copy current file path",
and its constant is `copyCurrentFilePathCommand` ("Yes, use that.").

When there is no active editor, the command shows the error message "There is no active editor." and stops.
When the editor has no file (not a `file:` document, such as an untitled document), it shows "Current editor has no associated file." and stops.
Otherwise the repo root comes from the file's own directory, using `findGitRepoRootDir`, as `openTerminalInRepoRootCommand` does, with no workspace folder prompt.
When the file is not in a repo, the "Repo-relative path" prompt is skipped and "Path" copies the absolute path
("Yes, copy that behavior.").

Done when: `npm run type-check` and eslint pass for `apps/airliner`, the extension bundles,
and the user confirms the hand test.

#### Outcomes

- `copyCurrentFilePathCommand` (`extension.airlinerCopyCurrentFilePath`, "Airliner copy current file path") is in
  `apps/airliner/src/commands.mts`, in the `commands` array, and in `contributes.commands` in `apps/airliner/package.json`.
  It shows "There is no active editor." or "Current editor has no associated file." and stops, as decided above.
  Otherwise it finds the repo root with `findGitRepoRootDir` from the file's directory,
  uses `repoRoot ?? <the file's directory>` as the base,
  computes the file's path relative to that base with `path.relative` (forward slashes),
  and calls the shared helper.
- The shared helper is `copyPathOrPermalink(baseDir, repoRoot, relPath, itemKind)` in the Helper Functions section of `commands.mts`.
  It holds, unchanged, everything that used to follow picking an item in `copyRepoPathCommand`:
  the "Path" / "Permalink" Quick Pick, the permalink branch with its progress toast and error message,
  the relative/absolute prompt (only with a repo root), the Windows slash prompt, `formatPath`, the clipboard and the `Copied:` toast.
  `copyRepoPathCommand` now ends with a call to it.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`,
  and `npm run esbuild-dev` bundles `extension.airlinerCopyCurrentFilePath`.
- The hand test passed: the user tried both commands in the Extension Development Host and reported "all tests pass".
  The report did not itemize the individual checks.
