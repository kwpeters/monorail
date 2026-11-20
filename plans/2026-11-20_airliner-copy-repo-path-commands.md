# New Airline Extension Commands

## Objective

Add three new commands to the Airliner VS Code extension in this monorepo:
copy repo project name, copy repo file path, and copy repo directory path.
Each lists its candidates using the Quick Input API and puts the result on the clipboard.

## Background Information

- The user would like to add the following new commands to the Airliner VS Code extension in this monorepo (`apps/airliner`).
- Copy repo project name:
  - Enumerate projects.
  - List them and allow the user to select one using the Quick Input API.
  - Put the chosen project name into the clipboard.
- Copy repo file path:
  - Enumerate all files in the repo.
  - List them and allow the user to select one using the Quick Input API.
  - Ask the user if they want an absolute or repo-relative path.
  - Put the resulting path on the clipboard.
- Copy repo directory path:
  - Enumerate all directories in the repo.
  - List them and allow the user to select one using the Quick Input API.
  - Ask the user if they want an absolute or repo-relative path.
  - Put the resulting path on the clipboard.
- The repo root directory can be identified by the presence of a `.git` directory.
- Projects should be identified by the presence of a `.csproj` file or a `package.json` file.
- The notes say, about nested repos: "I vaguely recall a feature that allows nesting of sub-repos."
- Commands are defined in `apps/airliner/src/commands.mts` as `ICommandDefinition` objects (`name`, `fn`),
  listed in the exported `commands` array,
  and declared under `contributes.commands` in `apps/airliner/package.json`.
- `openTerminalInRepoRootCommand` in `apps/airliner/src/commands.mts` already finds the repo root
  from the active editor's file using `findGitRepoRootDir` from `@repo/depot-node/gitRepo`.
- `isGitRepoDir` in `packages/depot-node/src/gitRepo.mts` already recognizes a `.git` directory
  and also a `.git` _file_ whose content starts with `gitdir:`,
  which is the form used by linked worktrees and submodules.
- `apps/airliner/src/commands.mts` has a commented-out `vscode.window.showQuickPick` example
  of prompting the user for a choice.
- `vscode.window.showQuickPick` shows the Quick Input dropdown, the same one the "find anything" bar uses.
  `showQuickPick` items can carry a `description`, a `detail` and `$(icon)` labels,
  and `matchOnDescription` extends filtering to the description.
- `vscode.env.clipboard.writeText` writes to the clipboard and is already used in `apps/airliner/src/commands.mts`.

## Implementation

The work needed to achieve the objective is defined in the following subsections.

### Task 1: Decide how the repo root is identified

Status: Done

#### Task Description

Settle the two open items from the notes.
Determine how the root of worktrees can be identified.
Determine whether other Git features need to be accounted for;
the notes vaguely recall a feature that allows nesting of sub-repos.

Done when: the Outcomes state which function finds the repo root and how it treats worktrees, submodules and nested repos.

#### Outcomes

- The user agreed ("I agree with the suggested answer.") to reuse `findGitRepoRootDir` from `@repo/depot-node/gitRepo` unchanged,
  starting from the selected workspace root folder.
- Worktrees and submodules need no new code:
  `isGitRepoDir` already accepts a `.git` _file_ whose content starts with `gitdir:`.
- Nested repos: the nearest enclosing root wins, so a folder inside a sub-repo or submodule resolves to that sub-repo.
- When no repo is found above the folder, this is not an error for these commands.
  See Task 2's Outcomes for how each command behaves without a repo root.

### Task 2: Decide which repo the commands use and how items are enumerated

Status: Done

#### Task Description

The notes do not say these things, so decide them with the user:

- Answered (see Outcomes): which repo the commands operate on.
- Answered (see Outcomes): whether enumeration honors `.gitignore`.
- Answered (see Outcomes): which directory names enumeration and project detection always skip.
- Answered (see Outcomes): what a project's name is.
- Answered (see Outcomes): what a quick pick item shows.
- Answered (see Outcomes): how the path style is prompted for, and how a copy is confirmed.
- Answered (see Outcomes): how the commands handle edge cases.
- Answered (see Outcomes): what gets unit tested.

Done when: the Outcomes record an answer to each open question above.

#### Outcomes

- Which repo: "When a multi-root workspace is open, first prompt the user to select one of the root folders.
  We should be able to identify the repo root using the selected root folder."
  So the commands start from a workspace root folder, not from the active editor's file.
  The repo root is then found from that folder.
- `.gitignore`: enumeration does not honor it, so `git ls-files` is out.
  The user's reason: "That would block the ability to enumerate files and directories in bin and other similar files.
  It is common to want the path to a .exe file or something similar."
  Instead, enumeration walks the filesystem and skips a hard-coded list of directories:
  "I definitely do not want files and directories in node_modules or .git listed.
  I think we should have a hard-coded list of directories we always want to ignore."
- Ignore list, matched by directory name at any depth, accepted by the user ("Yes, use that list."):
  `.git`, `node_modules`, `.turbo`, `.vs`, `obj`, `.svn`, `.hg`, `__pycache__`, `.venv`, `.nuget`.
  It holds no build-output directory, so `bin`, `dist`, `out` and `build` stay listable.
  It applies to project detection too.
- Implementation guidance from the user:
  "I would encourage you to use glob patterns in the implementation.
  By the way, this monorepo contains utility libraries such as depot and depot-node that may be able to help.
  If there is a needed utility, I encourage you to put that reusable code into these libraries."
- Facts found: `packages/depot-node` already depends on `glob` (`^13.0.6`);
  `airliner` does not.
  `packages/depot-node/src/diffDirectories.mts` already calls `glob` with `cwd`, `dot`, `nodir` and `ignore` options.
  `Directory` in `packages/depot-node/src/directory.mts` has `walk`, `filter` and `findMatchingFiles`,
  but none takes glob patterns or an ignore list.
  Task 3 adds the missing helper to `depot-node`.
- Project name: for a `.csproj` project, the file name without `.csproj` ("I accept your rule for .csproj files.").
  For a `package.json` project, "use the name with the scope removed.
  If name is missing, use the directory name."
  So `@repo/depot-node` becomes `depot-node`.
- Quick pick items (accepted by the user: "Yes, use that."):
  files and directories use the repo-relative path with forward slashes as the label, and no description.
  Projects use the project name as the label and the project's repo-relative directory as the description.
  `matchOnDescription` is on for the project list.
- Path style prompt, from the user:
  "a second Quick Pick with the labels "Repo-relative path" and "Absolute path", repo-relative first.
  Pressing Escape on either Quick Pick cancels the command and copies nothing.
  If running on Windows, prompt again with labels "Use forward slashes" and "Use backslashes".
  This will allow all possible combinations."
  On other operating systems there is no slash prompt.
- Confirmation, from the user: "a status bar message such as `Copied: <path>`.
  It disappears on its own, so there is no modal."
- Edge cases, accepted by the user except where noted:
  - No workspace folder open: show the error message "There is no open workspace folder." and stop.
  - A single workspace folder: use it without prompting.
    Prompt for a root folder only when more than one is open.
  - Escape on the root-folder Quick Pick cancels the command.
  - No projects found: show the information message "No projects found in this repo." and stop.
  - No repo found above the folder (the user's change to the suggestion):
    "Projects and their names can still be enumerated, so this case should not affect the project name command.
    For the file and directory commands, a failure to find the repo root just means that relative paths cannot be an option.
    Only absolute paths make sense.
    The Quick Picks should adjust accordingly."
    So without a repo root, the project name command is unaffected,
    and the file and directory commands skip the "Repo-relative path" / "Absolute path" Quick Pick and copy absolute paths only.
    The Windows slash Quick Pick still applies.
  - Not stated by the user, so assumed from the answer above:
    the base for enumeration and for "repo-relative" labels is the repo root when one is found,
    and the chosen workspace folder when none is found.
- Testing ("I agree."):
  the enumeration helpers get unit tests in Task 3.
  One pure path-formatting function in `depot-node` takes the item path, the base, absolute or relative, and the slash style,
  and returns the string to copy; it gets unit tests in Task 3 covering all four combinations and the absolute-only (no repo) case.
  The command code that calls the `vscode` API has no unit tests;
  Task 7 runs the full verification command and the user tries the three commands by hand in the Extension Development Host.

### Task 3: Add repo enumeration helpers to depot-node

Status: Done

#### Task Description

Add reusable helpers to `packages/depot-node`, built on its existing `glob` dependency,
so that the three commands share them:

- [x] Enumerate the files and the directories under a given root, skipping the Task 2 ignore list at any depth, with `dot: true` so dot-directories such as `.github` are listed.
- [x] Enumerate projects under a given root: the `package.json` and `*.csproj` matches, skipping the same ignore list, each with its name as decided in Task 2 (scope removed from a `package.json` name; directory name when `name` is missing).
- [x] Add a pure path-formatting function that takes the item path, the base, absolute or repo-relative, and the slash style (forward or backslashes), and returns the string to copy.
- [x] Add unit tests, using a temporary directory tree that includes an ignored directory and a `bin` directory, and covering all four path-format combinations.

Done when: the new unit tests pass and show that `node_modules` contents are skipped, `bin/*.exe` is listed, and the path-formatting function returns the right string for all four combinations.

#### Outcomes

- New module `packages/depot-node/src/repoEnumeration.mts`, exported as `@repo/depot-node/repoEnumeration`
  (export added to `packages/depot-node/package.json`), with 15 passing unit tests in `repoEnumeration.test.mts`.
  `npm run type-check` and eslint on the two files are clean.
- API, for Tasks 4 to 6:
  - `defaultIgnoredDirNames`: the Task 2 ignore list.
  - `enumerateFiles(root: Directory, ignoredDirNames?)` and `enumerateDirectories(root, ignoredDirNames?)`:
    resolve with paths relative to `root`, forward slashes, sorted;
    directories exclude `root` itself.
  - `enumerateProjects(root, ignoredDirNames?)`:
    resolves with `{ name, kind: "node" | "dotnet", relDir }`, sorted by name then directory;
    `relDir` is relative to `root`, forward slashes, and `""` when the project is `root` itself.
  - `nodeProjectName(packageJson: File, removeScope: boolean, fallbackName: string)`:
    reads the `name` of a `package.json`, removing the `@scope/` prefix only when `removeScope` is true;
    resolves with `fallbackName` when there is no usable `name`; never rejects.
    `enumerateProjects` calls it with `removeScope` true.
  - `formatPath(baseDir, relPath, base: "absolute" | "relative", slashStyle: "forward" | "backward")`:
    pure string function; `baseDir` is the absolute path of the directory the relative path is relative to.
  - Each enumerate function rejects if `root` cannot be read, so the commands should catch that.
- Detail: `glob` matches the root itself as `.` for directories, which `enumerateDirectories` filters out.
  A malformed or unreadable `package.json` still counts as a project, named by its directory.

### Task 4: Implement the copy repo project name command

Status: Not started

#### Task Description

Add the command in `apps/airliner/src/commands.mts`, register it in the `commands` array and in `contributes.commands` in `apps/airliner/package.json`:

- [ ] Choose the workspace root folder and find the repo root from it, handling the edge cases as decided in Tasks 1 and 2.
- [ ] Enumerate projects using the Task 3 helper, from the repo root, or from the chosen folder when no repo root is found.
- [ ] List them and allow the user to select one using the Quick Input API.
- [ ] Put the chosen project name into the clipboard.

Done when: running the command in a repo containing both kinds of project lists them, and the chosen name is on the clipboard.

#### Outcomes

None yet.

### Task 5: Implement the copy repo file path command

Status: Not started

#### Task Description

Add the command in `apps/airliner/src/commands.mts`, register it in the `commands` array and in `contributes.commands` in `apps/airliner/package.json`:

- [ ] Choose the workspace root folder and find the repo root from it, handling the edge cases as decided in Tasks 1 and 2.
- [ ] Enumerate all files using the Task 3 helper, from the repo root, or from the chosen folder when no repo root is found.
- [ ] List them and allow the user to select one using the Quick Input API.
- [ ] When a repo root was found, ask the user if they want an absolute or repo-relative path, using a second Quick Pick with the labels "Repo-relative path" and "Absolute path", repo-relative first.
  When no repo root was found, skip this Quick Pick and use the absolute path.
- [ ] On Windows only, ask a third Quick Pick with the labels "Use forward slashes" and "Use backslashes", so all four combinations are possible.
- [ ] Format the path with the Task 3 path-formatting function and put it on the clipboard.
- [ ] Show a status bar message such as `Copied: <path>`.

Done when: running the command copies the absolute path or the repo-relative path of the chosen file, with the chosen slash style, and pressing Escape on any Quick Pick copies nothing.

#### Outcomes

None yet.

### Task 6: Implement the copy repo directory path command

Status: Not started

#### Task Description

Add the command in `apps/airliner/src/commands.mts`, register it in the `commands` array and in `contributes.commands` in `apps/airliner/package.json`.
Reuse the path-style prompt and clipboard code from Task 5.

- [ ] Choose the workspace root folder and find the repo root from it, handling the edge cases as decided in Tasks 1 and 2.
- [ ] Enumerate all directories using the Task 3 helper, from the repo root, or from the chosen folder when no repo root is found.
- [ ] List them and allow the user to select one using the Quick Input API.
- [ ] When a repo root was found, ask the user if they want an absolute or repo-relative path, using a second Quick Pick with the labels "Repo-relative path" and "Absolute path", repo-relative first.
  When no repo root was found, skip this Quick Pick and use the absolute path.
- [ ] On Windows only, ask a third Quick Pick with the labels "Use forward slashes" and "Use backslashes", so all four combinations are possible.
- [ ] Format the path with the Task 3 path-formatting function and put it on the clipboard.
- [ ] Show a status bar message such as `Copied: <path>`.

Done when: running the command copies the absolute path or the repo-relative path of the chosen directory, with the chosen slash style, and pressing Escape on any Quick Pick copies nothing.

#### Outcomes

None yet.

### Task 7: Verify the build

Status: Not started

#### Task Description

Run the repo's full verification command from the repo root:

```powershell
npm run all && npm run type-check
```

Then the user tries the three commands by hand in the Extension Development Host:
a project name, a file path and a directory path, in a repo, and in a folder that is not in a repo.

Done when: the command exits with code 0, and the user confirms the hand test.

#### Outcomes

None yet.
