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

Status: Not started

#### Task Description

Implement Task 1's decisions in `apps/airliner/src/commands.mts` and `apps/airliner/package.json`:

- [ ] Add `copyRepoPathCommand` (`extension.airlinerCopyRepoPath`, "Airliner copy repo path") to `commands.mts`.
  Its Quick Pick lists the results of `enumerateFiles` and `enumerateDirectories` together, sorted by path.
  A directory's label ends in `/` and has a `folder` icon, a file has a `file` icon, and the copied path has no trailing `/`.
- [ ] Move the behavior of `copyPathOfChosenItem` into it, and remove `copyPathOfChosenItem`.
- [ ] Remove `copyRepoFilePathCommand` and `copyRepoDirectoryPathCommand`
  from `commands.mts` (the definitions and their entries in the `commands` array)
  and `extension.airlinerCopyRepoFilePath` and `extension.airlinerCopyRepoDirectoryPath` from `contributes.commands` in `package.json`.
- [ ] Register `copyRepoPathCommand` in the `commands` array and `extension.airlinerCopyRepoPath` in `contributes.commands`.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, the extension bundles with the new command and without the old two,
and no source file refers to the old command IDs.
The hand test is part of Task 6.

#### Outcomes

None yet.

### Task 5: Add the path or permalink prompt

Status: Not started

#### Task Description

Add the prompt to `copyRepoPathCommand` and generate permalinks using the Task 3 helpers,
following the prompt order in Task 2's Outcomes:

- [ ] After an item is picked, ask a Quick Pick with the labels "Path" and "Permalink", path first.
  Escape copies nothing.
- [ ] For "Path", continue with the existing "Repo-relative path" / "Absolute path" prompt (only when a repo root was found)
  and the Windows-only slash prompt.
- [ ] For "Permalink", skip those prompts and call `makeGitPermalink` with the picked item as a `File` or a `Directory`.
- [ ] When `makeGitPermalink` fails, show one error message that describes every problem it reports, copy nothing, and end.
- [ ] When it succeeds, copy the URL and show `Copied: <url>` in the status bar.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, and the extension bundles.
The hand test is part of Task 6.

#### Outcomes

None yet.

### Task 6: Verify the build

Status: Not started

#### Task Description

Run the repo's full verification command from the repo root:

```powershell
npm run all && npm run type-check
```

Then the user tries `copyRepoPathCommand` by hand in the Extension Development Host:
a file and a directory, as a path and as a permalink, in a repo and in a folder that is not in a repo,
and a permalink for an item with uncommitted changes, which should show the error message and copy nothing.

Done when: the command exits with code 0, and the user confirms the hand test.

#### Outcomes

None yet.
