# Offer a path relative to the active document

## Objective

When the user is prompted to choose between an absolute path and a repo root relative path,
and there is an active document,
offer an additional option that gives the path relative to the active document.

## Background Information

- Source notes, from the user's request:
  "I would like to improve this extension command in the following way.
  When the user is prompted to choose whether they want an absolute path or a repo root relative path,
  if there is an active document there should be an additional option to get the path relative to the current active document."
  The user had `const copyRepoPathCommand = {` in `apps/airliner/src/commands.mts` selected when making the request.
- `copyRepoPathCommand` (`extension.airlinerCopyRepoPath`) lets the user pick a file or directory in the repo,
  then calls the shared helper `copyPathOrPermalink(baseDir, repoRoot, relPath, itemKind, lineChoice?)` in `apps/airliner/src/commands.mts`.
  `copyCurrentFilePathCommand` (`extension.airlinerCopyCurrentFilePath`) calls the same helper for the active editor's file.
- The prompt the user means is in `copyPathOrPermalink`, in the "Path" branch:
  a "Path to copy" Quick Pick with the items "Repo-relative path" (`"relative"`) and "Absolute path" (`"absolute"`),
  placeholder "Relative to the repo root, or absolute?".
  It is shown only when `repoRoot` is defined; with no repo root the path is absolute without asking.
  It is followed by a "Path separator" Quick Pick, shown only on Windows.
  Escape on any Quick Pick copies nothing.
- The text is made by `formatPath(baseDir.absPath(), relPath, base, slashStyle)`,
  where `PathBase = "absolute" | "relative"` and `SlashStyle = "forward" | "backward"`,
  in `packages/depot-node/src/repoEnumeration.mts`.
  `formatPath` is a pure string function; it has 7 references in `packages/depot-node/src/repoEnumeration.test.mts`.
  `relPath` is relative to `baseDir`, which is the repo root when there is one.
- The active document is `vscode.window.activeTextEditor?.document`.
  `copyCurrentFilePathCommand` already requires `document.uri.scheme === "file"` and uses `new File(document.uri.fsPath)`.
- `plans/2026-11-20_airliner-permalink-line-range.md`, Task 5, still waits for the user's hand test of these commands.
  This plan changes the same helper function.

## Implementation

The work needed to achieve the objective is defined in the following subsections.

### Task 1: Decide how the new option works

Status: Done

#### Task Description

The request does not say these things, so decide them with the user:

Answered (see Outcomes): which command or commands get the new option.

Answered (see Outcomes): what counts as "the active document", and what the option's base is.

Answered (see Outcomes): what happens when the picked item is the active document itself.

Answered (see Outcomes): the option's label and its position in the Quick Pick.

Answered (see Outcomes): what form the relative path takes.

Answered (see Outcomes): what happens when there is no repo root.

Answered (see Outcomes): what happens when the active document is not a file on disk,
or lies on a different drive than the item.

Done when: the Outcomes record an answer to each open question above.

#### Outcomes

- Which commands ("Yes, that's what I expected."): the check lives in the shared helper `copyPathOrPermalink`.
  The new option is shown only when there is an active file document
  and the picked item is not that document itself.
  In practice only `copyRepoPathCommand` shows it;
  `copyCurrentFilePathCommand` keeps its two options as they are.
- Picked item is the active document: the new option is hidden (same answer as above).
- Active document and base ("Yes, that's what I expected."): the active document is
  `vscode.window.activeTextEditor?.document`, and it counts only when `uri.scheme === "file"`.
  For any other editor (untitled, output panel, diff view) there is no active document and the option is hidden.
  The path is relative to the directory that holds the active document, not to the file itself,
  so for the active document `src/a/foo.ts` and the picked item `src/b/bar.ts` the result is `../b/bar.ts`.
- Label and position ("Yes, that's what I expected."): the new item "Path relative to active document" is the third item,
  after "Repo-relative path" and "Absolute path".
  The placeholder becomes "Relative to the repo root, absolute, or relative to the active document?"
  only when the item is shown; otherwise it stays "Relative to the repo root, or absolute?".
- Form ("Yes, that's what I expected."): the path is what `path.relative` gives, with no `./` prefix:
  `b/bar.ts` below the document's directory, `bar.ts` in the same directory, `../b/bar.ts` elsewhere.
  The slash style follows the existing separator prompt, and a directory item has no trailing slash.
- No repo root ("Yes, that's what I expected."): the "Path to copy" prompt shows only the items that apply.
  "Repo-relative path" needs a repo root;
  "Path relative to active document" needs an active file document that is not the picked item;
  "Absolute path" always applies.
  The prompt is skipped, and the path is absolute, when "Absolute path" is the only item.
- Non-file document or different drive ("Yes, that's what I expected."): a document whose scheme is not `file` is not an active document (see above).
  When `path.relative` from the document's directory to the picked item returns an absolute path
  (Windows, different drives), no relative path exists and the item "Path relative to active document" is hidden.

### Task 2: Add a relative-path helper to depot-node

Status: Cancelled

#### Task Description

`apps/airliner` imports `vscode`, so its logic cannot be unit-tested (its only test file is `sample.test.mts`).
Put the testable part in `packages/depot-node/src/repoEnumeration.mts`, next to `formatPath`, following Task 1's Outcomes:

- [ ] Add and export `relativePathFromDir(fromDir: string, toPath: string): string | undefined`,
  with JSDoc.
  It returns what `path.relative(fromDir, toPath)` gives, with no `./` prefix,
  or `undefined` when that result is absolute (no relative path exists, such as on different Windows drives).
- [ ] Add unit tests in `packages/depot-node/src/repoEnumeration.test.mts` for an item below the directory,
  in the same directory, elsewhere (`../`), and, on Windows only, on a different drive.

`formatPath` is not changed:
Task 3 calls it with `base` `"relative"`, the result of `relativePathFromDir` as `relPath`, and the chosen slash style.

Done when: the new unit tests pass, and `npm run type-check` and eslint pass for `packages/depot-node`.

#### Outcomes

Cancelled, with the user's agreement, because `depot-node` already has what this task would add:
`File.relative(from: Directory, to: File): File` in `packages/depot-node/src/file.mts`
and `Directory.relative(from: Directory, to: Directory): Directory` in `packages/depot-node/src/directory.mts`.
Both return `path.relative(from.toString(), to.toString())` wrapped in a `File` or `Directory`, so there is no `./` prefix.
Neither handles different drives: on Windows the result is then an absolute path,
and `File` and `Directory` have no `isAbsolute` method, so the caller tests `path.isAbsolute(result.toString())`.
That check has no unit test, because `apps/airliner` cannot import `vscode`-free code for testing; the hand test in Task 4 covers it.
The task keeps its number, so the later tasks are not renumbered.

### Task 3: Offer the option in copyPathOrPermalink

Status: Done

#### Task Description

In `apps/airliner/src/commands.mts`, following Task 1's Outcomes and Task 2's Outcomes
(use `File.relative` and `Directory.relative` rather than a new helper).

- [x] Find the active document in `copyPathOrPermalink`:
  `vscode.window.activeTextEditor?.document`, counted only when `uri.scheme === "file"`.
- [x] Build the picked item as `new File(baseDir, relPath)` or `new Directory(baseDir, relPath)` by `itemKind`, as the permalink branch does.
  Compute its path relative to the active document's `Directory` with `File.relative` or `Directory.relative`.
  The item is the active document when their absolute paths are the same.
- [x] Build the "Path to copy" items from those that apply:
  "Repo-relative path" when `repoRoot` is defined,
  "Absolute path" always,
  "Path relative to active document" third, when there is an active document, the picked item is not that document,
  and `path.isAbsolute` of the relative result is false.
  Use the longer placeholder only when the third item is shown.
  Skip the prompt, with an absolute path, when "Absolute path" is the only item.
  Answered ("Show it, copying \".\""): a directory item that is the active document's own directory
  stays offered, and copies `.` (what `Directory.relative` gives for the same directory).
- [x] Format the third choice with `formatPath(documentDir, relativePath, "relative", slashStyle)`.
- [x] Update the JSDoc of every function whose parameters change.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, and the extension bundles.

#### Outcomes

- In `apps/airliner/src/commands.mts`, the "Path" branch of `copyPathOrPermalink` now builds the "Path to copy" items from those that apply:
  "Repo-relative path" (needs `repoRoot`), "Absolute path" (always),
  and "Path relative to active document" third, with the longer placeholder only when that item is shown.
  The prompt is skipped, with an absolute path, when "Absolute path" is the only item.
  A new private function `pathRelativeToActiveDocument(baseDir, relPath, itemKind)` returns `{ documentDir, relativePath }` or `undefined`.
  It returns `undefined` when the active editor's document is not a `file`-scheme document,
  when the picked file is the active document (`File.equals`),
  or when `File.relative` or `Directory.relative` gives an absolute path (different Windows drives, tested with `path.isAbsolute`).
  A directory that is the document's own directory gives `.`, as the user chose.
  The third choice is formatted with `formatPath(documentDir.absPath(), relativePath, "relative", slashStyle)`,
  and the other choices as before.
  The unused `PathBase` import was removed.
- `copyPathOrPermalink`'s parameters did not change, so its JSDoc is unchanged; the new function has JSDoc.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`, and `npm run esbuild-dev` bundles.
- Not checked: the prompts in the Extension Development Host, and the "hide when absolute" and "same file" branches; Task 4 covers them.

### Task 4: Verify the build

Status: Done

#### Task Description

Run the repo's full verification command from the repo root:

```powershell
npm run all && npm run type-check
```

Then the user tries both commands by hand in the Extension Development Host:
`copyRepoPathCommand` with an active file document (the third item appears, and gives `b/bar.ts`, `bar.ts` and `../b/bar.ts` for items below, beside and elsewhere than the document),
with the active document picked as the item (the third item is hidden),
with a non-file editor active such as the Output panel (the third item is hidden),
and in a workspace folder with no repo (the prompt shows only the items that apply);
and `copyCurrentFilePathCommand` once (it keeps its two items).

Answered (see Outcomes): whether the hand test worked.
The cases to try were, with "Airliner copy repo path" and "Path":
an active file document, picking an item below it, beside it and elsewhere (the third item gives `b/bar.ts`, `bar.ts` and `../b/bar.ts`);
the active document itself as the item (the third item is hidden);
the document's own directory as the item (the third item copies `.`);
a non-file editor active, such as the Output panel (the third item is hidden);
a workspace folder with no repo (the prompt shows only the items that apply);
and "Airliner copy current file path" once (it keeps its two items).

Done when: the command exits with code 0, and the user confirms the hand test.

#### Outcomes

- `npm run all && npm run type-check` exited with code 0 from the repo root:
  45 of 45 Turborepo tasks successful in each run, with 44 cached,
  and 0 test failures, including 1597 `depot` specs and 682 `depot-node` specs.
  `airliner` type-checks.
- Hand test: the user reported "It worked perfectly."
  The user did not itemise which cases were tried,
  and the different-drive case (the third item hidden when `path.isAbsolute` is true) has no unit test and was not reported separately.
