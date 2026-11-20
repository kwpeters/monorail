# Link a permalink to the current line or selected range

## Objective

Let the user of `copyCurrentFilePathCommand` choose, when producing a permalink,
whether the link points to the file or to the current line or selected range of the active editor.

## Background Information

- Source notes, pasted by the user in the chat:
  "I would like to improve this command [copyCurrentFilePathCommand in apps/airliner/src/commands.mts] in the following way:
  If the user chooses to produce a permalink, the user should be prompted whether they want to link to the file or to the current line/selected range.
  Whether the choice is line or selected range is determined by whether or not the user has a selection in the active editor."
- `copyCurrentFilePathCommand` (`extension.airlinerCopyCurrentFilePath`, "Airliner copy current file path") is in `apps/airliner/src/commands.mts`.
  It finds the active editor's file and its repo root,
  then calls the shared helper `copyPathOrPermalink(baseDir, repoRoot, relPath, itemKind)`,
  which `copyRepoPathCommand` also calls.
- `copyPathOrPermalink` asks a "Path" / "Permalink" Quick Pick.
  For "Permalink" it builds a `File` or `Directory`, calls `makeGitPermalink(item)` inside a "Making permalink..." progress toast,
  shows one error message when it fails, and otherwise copies the URL and shows a `Copied:` toast.
- `makeGitPermalink(item, options?: { fetchOrigin?: boolean })` is in `packages/depot-node/src/gitPermalink.mts`.
  It resolves with a `Result` holding the URL, or a list of problems.
  It calls `buildPermalinkUrl(webAddress, host, hash, repoPath, kind)` from `packages/depot/src/gitPermalink.mts`,
  which builds URLs with no line anchor.
- `plans/2026-11-20_airliner-combined-path-and-permalink.md` decided that a permalink never includes a line number or range.
  That plan covered `copyRepoPathCommand`, which picks items from a list.
  This plan changes it only for `copyCurrentFilePathCommand`, which is the command the notes name.
- The `make-permalinks` skill (`C:\Users\kwpeters\.claude\skills\make-permalinks\SKILL.md`) already has the line rules:
  a line anchor is `#L10` on GitHub and GitLab, and a range is `#L10-L20` on GitHub and `#L10-20` on GitLab.
  Both sites show a rendered view of files such as `.md`, `.rst` and `.adoc`, where line anchors do nothing,
  so for such a file with a line anchor, `?plain=1` goes before the `#`.
  A directory never has a line anchor.
- In the VS Code API, `vscode.window.activeTextEditor.selection` has `isEmpty`, `start`, `end` and `active`,
  and line numbers are 0-based, so a link needs `line + 1`.

## Implementation

The work needed to achieve the objective is defined in the following subsections.

### Task 1: Decide how the line or range choice works

Status: Done

#### Task Description

The notes do not say these things, so decide them with the user:

Answered (see Outcomes): the labels and order of the new Quick Pick.

Answered (see Outcomes): with no selection, which line is "the current line".

Answered (see Outcomes): which lines a selection covers.

Answered (see Outcomes): which selection is used when there are several.

Answered (see Outcomes): what happens when the document has unsaved changes.

Answered (see Outcomes): whether the command checks before showing the new Quick Pick.

Done when: the Outcomes record an answer to each open question above.

#### Outcomes

- Quick Pick ("Yes, use that."): shown after the user chooses "Permalink", with "File" first and then the line choice.
  With no selection the line choice is "Line 12", using the cursor's line number.
  With a selection it is "Lines 12-18", using the first and last line of the selection,
  and a selection on a single line reads "Line 12".
  Line numbers are shown as the editor shows them, 1-based.
  Escape copies nothing.
- Current line: with no selection it is the cursor's line, `selection.active.line + 1`.
  The user's answer was "Yes, use that." to the Quick Pick that shows "Line 12" with no selection.
- Selected range ("Yes, that is what I expected."): the first line is `start.line + 1`.
  The last line is `end.line + 1`,
  except that when the selection ends at column 0 on a later line than it starts, the last line is `end.line`,
  so selecting lines 12 to 17 whole, which ends at line 18 column 0, gives "Lines 12-17".
- Several selections ("Yes, use that."): only the primary selection, `editor.selection`, is used,
  and the others are ignored without a message.
  The Quick Pick's "Line N" or "Lines N-M" is computed from it.
- Unsaved changes ("Yes, use that."): when the user chose the line or range and `document.isDirty` is true,
  the command shows the error message
  "The file has unsaved changes, so its line numbers may not match the committed file." and stops.
  The "File" choice is not affected, because it uses no line numbers.
- No pre-check ("Yes, use that."): the Quick Pick always appears after "Permalink" is chosen.
  If the permalink then cannot be made, `makeGitPermalink` fails as before and the one error message is shown,
  so the user can choose "Line 12" and then be told that the commit is not pushed.


### Task 2: Add line anchors to depot's buildPermalinkUrl

Status: Done

#### Task Description

In `packages/depot/src/gitPermalink.mts`, following the `make-permalinks` skill's rules and Task 1's Outcomes:

- [x] Add and export the type `ILineRange`, `{ start: number; end: number }` with 1-based line numbers and `start <= end`.
- [x] Add an optional `lines?: ILineRange` parameter to `buildPermalinkUrl`.
  A file with `lines` gets an anchor:
  `#L10` when `start` equals `end`,
  and for a range `#L10-L20` on GitHub and `#L10-20` on GitLab.
  A directory never gets an anchor, whatever `lines` says.
- [x] Put `?plain=1` before the `#` when a file gets an anchor and its name ends in `.md`, `.rst` or `.adoc`, compared case-insensitively.
  The three extensions are a single exported constant, "Yes, use that."
  A link with no anchor never gets `?plain=1`.
- [x] Add and export `selectionToLineRange(start, end)`, a pure function that takes the `{ line, character }` positions of a selection, 0-based,
  and returns an `ILineRange` with 1-based lines:
  `start.line + 1` to `end.line + 1`,
  except that when `end.character` is 0 and `end.line` is greater than `start.line`, the last line is `end.line`.
  A cursor with no selection, where `start` equals `end`, gives its own line twice.
- [x] Add unit tests in `packages/depot/src/gitPermalink.test.mts` for a line and a range on GitHub and GitLab,
  `?plain=1` for each of the three extensions in either case and not for `.ts`, no anchor for a directory,
  and `selectionToLineRange` for a cursor, a one-line selection, a multi-line selection, and a whole-line selection ending at column 0.

Done when: the new unit tests pass, and `npm run type-check` and eslint pass for `packages/depot`.

#### Outcomes

- In `packages/depot/src/gitPermalink.mts` (export `@repo/depot/gitPermalink`), now built into `dist`:
  - `ILineRange` (`{ start: number; end: number }`, 1-based) and `ITextPosition` (`{ line: number; character: number }`, 0-based) are exported types.
  - `renderedFileExtensions` is the exported constant `[".md", ".rst", ".adoc"]`.
  - `buildPermalinkUrl(webAddress, host, hash, repoPath, kind, lines?: ILineRange)`:
    a file with `lines` gets `#L10` for a single line, and `#L10-L20` (GitHub) or `#L10-20` (GitLab) for a range;
    `?plain=1` goes before the anchor for the rendered file types, compared case-insensitively on the repo path;
    a directory, or a file with no `lines`, gets no anchor and no `?plain=1`.
  - `selectionToLineRange(start: ITextPosition, end: ITextPosition): ILineRange`:
    `start.line + 1` to `end.line + 1`, except that a selection ending at column 0 of a later line ends at `end.line`;
    a cursor gives its own line twice.
- 9 new unit tests in `gitPermalink.test.mts`, 23 in total for the file, pass.
  `npm run type-check` and eslint are clean for `packages/depot`.
- For Tasks 3 and 4: `packages/depot` has been built, so `depot-node` and `airliner` can import the new exports.

### Task 3: Pass the line or range through makeGitPermalink

Status: Done

#### Task Description

In `packages/depot-node/src/gitPermalink.mts`:

- [x] Add an optional `lines?: ILineRange` to `IMakeGitPermalinkOptions`, and pass it to `buildPermalinkUrl`.
- [x] Add unit tests in `packages/depot-node/src/gitPermalink.test.mts` for a file permalink with a line and with a range,
  and for a `.md` file with a line, which gets `?plain=1`.

Done when: the new unit tests pass, and `npm run type-check` and eslint pass for `packages/depot-node`.
Task 2 must be built first (`npm run build` in `packages/depot`), because `depot-node` imports `depot` through its `dist`.

#### Outcomes

- `IMakeGitPermalinkOptions` in `packages/depot-node/src/gitPermalink.mts` has a new optional `lines?: ILineRange`
  (`ILineRange` is imported from `@repo/depot/gitPermalink`), which `makeGitPermalink` passes to `buildPermalinkUrl`.
  Calling `makeGitPermalink(item, { lines })` therefore gives a file permalink with a line or range anchor.
  A directory ignores `lines`, and every existing problem check is unchanged.
- 4 new unit tests in `gitPermalink.test.mts` cover a line, a range, a `.md` file with a range (which gets `?plain=1`), and a directory with `lines`;
  the file's 20 specs pass.
  `npm run type-check` and eslint are clean for `packages/depot-node`.
- For Task 4: `packages/depot-node` has been built, so `airliner` can import the changed module.

### Task 4: Prompt for the line or range in copyCurrentFilePathCommand

Status: Done

#### Task Description

In `apps/airliner/src/commands.mts`, following Task 1's Outcomes:

- [x] Give the shared helper `copyPathOrPermalink` an optional parameter, `lineChoice?: { lines: ILineRange; isDirty: boolean }`.
  When it is absent, which is how `copyRepoPathCommand` calls it, nothing changes.
- [x] In the "Permalink" branch, when `lineChoice` is present, ask a Quick Pick with "File" first and then "Line N" or "Lines N-M" built from `lineChoice.lines`
  (a range on a single line reads "Line N").
  Escape copies nothing.
- [x] When the user chose the line or range and `lineChoice.isDirty` is true,
  show the error message "The file has unsaved changes, so its line numbers may not match the committed file." and stop.
  The "File" choice is not affected.
- [x] Pass `lines` in the options of `makeGitPermalink` when the user chose the line or range.
- [x] In `copyCurrentFilePathCommand`, build `lineChoice` from the primary selection, `activeEditor.selection`,
  using `selectionToLineRange(selection.start, selection.end)`, and `activeEditor.document.isDirty`.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, and the extension bundles.
The hand test is part of Task 5.
Tasks 2 and 3 must be built first (`npm run build` in `packages/depot` and then `packages/depot-node`),
because `airliner` imports them through their `dist`.

#### Outcomes

- In `apps/airliner/src/commands.mts`, `copyPathOrPermalink` has a fifth, optional parameter,
  `lineChoice?: { lines: ILineRange; isDirty: boolean }`.
  `copyRepoPathCommand` does not pass it, so nothing changes for that command.
  In the "Permalink" branch, when `lineChoice` is present, a "Link to" Quick Pick offers "File" first,
  then "Line N" (when `start` equals `end`) or "Lines N-M".
  Escape copies nothing.
  If the user chose the lines and `isDirty` is true, it shows the error message
  "The file has unsaved changes, so its line numbers may not match the committed file." and stops.
  Otherwise `makeGitPermalink(item, lines ? { lines } : undefined)` is called,
  so the "File" choice produces the same link as before.
  The `undefined` is there because the project has `exactOptionalPropertyTypes` on, which rejects `{ lines: undefined }`.
- `copyCurrentFilePathCommand` builds `lineChoice` from the primary selection, `activeEditor.selection`,
  using `selectionToLineRange(selection.start, selection.end)`, and `activeEditor.document.isDirty`.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`,
  and `npm run esbuild-dev` bundles the new prompt.
- Not checked: the prompt in the Extension Development Host; Task 5 covers it.

### Task 5: Verify the build

Status: Started

#### Task Description

Run the repo's full verification command from the repo root:

```powershell
npm run all && npm run type-check
```

Then the user tries `copyCurrentFilePathCommand` by hand in the Extension Development Host:
a permalink to the file, to the current line with no selection, and to a selected range
(including a selection of whole lines, which should not include the line after it),
a line choice on a document with unsaved changes (an error message, and nothing copied),
a line permalink on a `.md` file (the link opens the raw view),
and `copyRepoPathCommand` once, since the shared helper changed.

Open question: Have you tried `copyCurrentFilePathCommand` by hand in the Extension Development Host, and did it work?
Please try, on a saved file in a pushed, clean repo:
"Permalink" then "File";
"Permalink" then "Line N" with no selection (the cursor's line);
"Permalink" then "Lines N-M" with a selection of several lines,
and with a selection of whole lines made by triple-click or Shift+Down (the link should stop at the last selected line);
"Permalink" then a line choice in a document with unsaved changes (an error message, and nothing copied);
a line permalink in a `.md` file (the link should open the raw view, with the lines highlighted);
Escape on the new Quick Pick;
and "Airliner copy repo path" once, with a permalink, since the shared helper changed.

Done when: the command exits with code 0, and the user confirms the hand test.

#### Outcomes

- `npm run all && npm run type-check` exited with code 0 from the repo root.
  The Turborepo build rebuilt the changed packages (only 2 of 45 tasks were cached),
  and the `depot` and `depot-node` test tasks were cache misses, so they ran for real:
  1597 `depot` specs and 682 `depot-node` specs passed, with 0 failures.
- The hand test has not been done; the Open question above waits for the user.
