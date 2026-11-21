# Add a Markdown link question to the copy path commands

## Objective

Let the user choose, at the end of the copy commands,
whether to wrap the path or permalink in a Markdown link,
so that the text copied to the clipboard is then `[path](path)` or the permalink as a Markdown link.

## Background Information

- Source notes, from the user's request:
  "I would like to start a new enhancement for the same extension command.
  In the list that prompts the user whether they want a Path or a Permalink,
  I would like to add the third option of a Markdown link.
  This option would continue to use the same logic as if the user selected Path,
  but at the end would put text onto the clipboard in the format `[path](path)`."
  "The same extension command" is `copyRepoPathCommand` in `apps/airliner/src/commands.mts`,
  which the user had selected when making the request.
- Correction from the user, after Tasks 1 and 2 were finished:
  "I think we did this wrong.
  Both a file path or a permalink can be wrapped in a markdown link.
  Instead of it being one of the three options, it should just be a "Do you want to wrap this in a markdown link (yes/no)" question at the end."
  This replaces the "third option in the `Copy as` list" design of the original request.
  Task 1's Outcomes mark which of its earlier answers this supersedes.
- `copyRepoPathCommand` (`extension.airlinerCopyRepoPath`) and `copyCurrentFilePathCommand` (`extension.airlinerCopyCurrentFilePath`)
  both call the shared helper `copyPathOrPermalink(baseDir, repoRoot, relPath, itemKind, lineChoice?)` in `apps/airliner/src/commands.mts`.
- The first Quick Pick in `copyPathOrPermalink` has the title "Copy as", the placeholder "Copy a path or a permalink?",
  and the items "Path" (`"path"`) and "Permalink" (`"permalink"`).
  Escape copies nothing.
- The "Permalink" branch, when `lineChoice` is present, asks "Link to" (the file, or "Line N" / "Lines N-M"),
  makes the URL with `makeGitPermalink` inside a "Making permalink..." progress notification,
  shows one error message when that fails, and otherwise copies the URL and shows `Copied: <url>`.
- The "Path" branch asks the "Path to copy" Quick Pick with only the choices that apply:
  "Repo-relative path" (when there is a repo root), "Absolute path", and "Path relative to active document".
  On Windows it then asks the "Path separator" Quick Pick, "Use forward slashes" or "Use backslashes".
  It then makes the text with `formatPath(...)` from `packages/depot-node/src/repoEnumeration.mts`,
  copies it with `vscode.env.clipboard.writeText(text)`, and shows `Copied: <text>` with `vscode.window.showInformationMessage`.
- `plans/2026-11-21_airliner-path-relative-to-active-document.md` (finished) added the "Path relative to active document" choice to the same code.
  Its Outcomes describe `pathRelativeToActiveDocument` and the way the "Path to copy" items are built.
- No code in `apps/airliner` has been changed for this plan yet.
  Task 2 added `formatMarkdownLink` to `packages/depot-node`, which is still wanted.

## Implementation

The work needed to achieve the objective is defined in the following subsections.

### Task 1: Decide how the Markdown link works

Status: Done

#### Task Description

The request does not say these things, so decide them with the user.
The earlier answers are in the Outcomes; the user's correction supersedes some of them.

Answered (see Outcomes): which commands get the new option.

Answered (see Outcomes): the option's label and position in the "Copy as" Quick Pick, and whether the placeholder changes.
Superseded by the correction; see the next question.

Answered (see Outcomes): where and how the new question is asked.
It comes at the end, after every other prompt and before the clipboard is written,
for both "Path" and "Permalink".

Answered (see Outcomes): whether the link text is the same string as the link target, for a path.

Answered (see Outcomes): what the link text is for a permalink wrapped in a Markdown link.

Answered (see Outcomes): what happens when the path contains characters that break a Markdown link.

Answered (see Outcomes): what happens when the user chose backslashes and then answers "Wrap in Markdown link".
The user first chose to keep the choice in the text with a forward-slash target, then changed the answer to forward slashes everywhere.

Answered (see Outcomes): whether the confirmation message shows the exact text that was copied.

Done when: the Outcomes record an answer to each open question above.

#### Outcomes

- Which commands ("Yes, that's what I expected."): the option is added in the shared helper `copyPathOrPermalink`,
  so both `copyRepoPathCommand` and `copyCurrentFilePathCommand` show it, with no new parameter on the helper.
- Label and position (the user's wording: "I would like Markdown link to be second in the list because it is so similar to the Path choice."):
  the "Copy as" Quick Pick had the items "Path", "Markdown link", "Permalink", in that order,
  with the placeholder "Copy a path, a Markdown link or a permalink?".
  Superseded by the user's correction: "Markdown link" is not an item in the "Copy as" list.
  The "Copy as" list and its placeholder stay as they are today.
- The question (the user's wording: "I want the question to be "Wrap this path/permalink?".
  And I want the choices to be "No wrapping" and "Wrap in Markdown link"."):
  the question text is "Wrap this path/permalink?" and the choices are "No wrapping" and "Wrap in Markdown link".
  Details ("Yes, that's what I expected."): it reads "Wrap this path?" when a path is being copied
  and "Wrap this permalink?" when a permalink is being copied.
  That text is both the Quick Pick's title and its placeholder.
  The items are "No wrapping" first, which is the default, then "Wrap in Markdown link".
  It comes at the end, after every other prompt and before the clipboard is written.
  Escape copies nothing.
- Permalink link text ("Yes, that's what I expected."): the link text is the item's path relative to the repo root,
  with forward slashes and no line suffix, such as `src/b/bar.ts`, and the link target is the permalink URL.
  A line or range the user chose shows only in the URL.
  For example `[src/b/bar.ts](https://github.com/org/repo/blob/<hash>/src/b/bar.ts#L10-L20)`.
  The text and the target now differ, so `formatMarkdownLink` from Task 2 needs a separate target;
  Task 3 does that, and Task 4 uses it.
- Link text ("Same string"): for a path, the link text and the link target are both the full path, exactly as the Path option would copy it,
  as in `[src/b/bar.ts](src/b/bar.ts)`.
- Special characters ("Yes, that's what I expected."): the formatter produces valid Markdown.
  In the link text, a backslash goes before each `\`, `[` and `]`.
  In the link target, every `\` is doubled;
  the target is wrapped in `<...>` when it contains whitespace, `(`, `)`, `<` or `>`,
  and a backslash goes before any `<` or `>` inside the brackets.
  A path with none of these characters gives `[src/b/bar.ts](src/b/bar.ts)`.
- Prompts ("Yes, that's what I expected."): the user asked "In markdown, are path always supposed to use forward slashes?"
  and the answer was that a link target is a URL reference, in which `\` is an escape character and not a separator.
  The Markdown link option therefore skipped the "Path separator" prompt and used forward slashes.
  Superseded by the user's correction, because the question now comes after the separator was chosen.
  What still holds: the Q4 escaping stays for special characters in names, including a literal `\`.
- Backslash separators (the user first answered "B." and then wrote:
  "I think it should be C, use forward slashes everywhere.
  I think having backslashes in the text will require some odd escaping."):
  when the user chose backslashes and then "Wrap in Markdown link",
  the link text and the link target both use forward slashes, as in `[C:/dev/_x/a.ts](C:/dev/_x/a.ts)`.
  The separator choice is ignored when wrapping.
  The "Path separator" prompt is not skipped, because the question comes after it.
  Task 4 formats the path with `"forward"` for a link, whatever separator the user chose.
- Confirmation (the user's wording: "Yes, the message always shows exactly what went to the clipboard."):
  the message is the word "Copied:", a space, and exactly the text that went to the clipboard,
  including the Markdown link when the user wrapped, and unchanged when the user did not.

### Task 2: Add a Markdown link formatter to depot-node

Status: Done

#### Task Description

`apps/airliner` imports `vscode`, so its logic cannot be unit-tested (its only test file is `sample.test.mts`).
Put the testable part in `packages/depot-node/src/repoEnumeration.mts`, next to `formatPath`, following Task 1's Outcomes:

- [x] Add and export `formatMarkdownLink(pathText: string): string`, with JSDoc.
  It returns `[text](target)` where `text` and `target` both come from `pathText`, with the escaping in Task 1's Outcomes:
  in the text, a backslash before each `\`, `[` and `]`;
  in the target, every `\` doubled, the target wrapped in `<...>` when it contains whitespace, `(`, `)`, `<` or `>`,
  and a backslash before any `<` or `>` inside the brackets.
- [x] Add unit tests in `packages/depot-node/src/repoEnumeration.test.mts` for a plain relative path, a plain absolute path (`C:/dev/a.ts` and `/home/a.ts`),
  a path with a space, a path with parentheses, a path with `[` and `]`, a path with a literal `\`,
  and a path with `<` or `>`.

Done when: the new unit tests pass, and `npm run type-check` and eslint pass for `packages/depot-node`.

#### Outcomes

- `packages/depot-node/src/repoEnumeration.mts` (export `@repo/depot-node/repoEnumeration`) has a new exported pure function
  `formatMarkdownLink(pathText: string): string`, with JSDoc, next to `formatPath`.
  It returns `[text](target)`:
  the text has a backslash before each `\`, `[` and `]`;
  the target has every `\` doubled and is wrapped in `<...>` when it contains whitespace, `(`, `)`, `<` or `>`, with a backslash before each `<` and `>` inside the brackets.
  Examples: `src/b/bar.ts` gives `[src/b/bar.ts](src/b/bar.ts)`; `src/my file.ts` gives `[src/my file.ts](<src/my file.ts>)`;
  `src/[id].ts` gives `[src/\[id\].ts](src/[id].ts)`.
  It does not change slashes: the caller passes a path with forward slashes.
- 8 new unit tests in `repoEnumeration.test.mts`; the package's 690 specs pass, with 0 failures.
  `npm run type-check` and eslint are clean for `packages/depot-node`.
- For Task 3: `packages/depot-node` has been built (`npm run build`), so `airliner` can import `formatMarkdownLink`.
- After the user's correction: the function takes one string for both text and target,
  so it serves a path as it is.
  A permalink needs a different text and target (Task 1's Outcomes), so Task 3 extends it.

### Task 3: Let formatMarkdownLink take a separate target

Status: Done

#### Task Description

In `packages/depot-node/src/repoEnumeration.mts`, following Task 1's Outcomes on the permalink's link text:

- [x] Change `formatMarkdownLink` to `formatMarkdownLink(text: string, target?: string): string`,
  where `target` defaults to `text`, so that a path is called as before.
  The escaping rules are unchanged:
  the text gets the link-text escaping, and the target gets the link-target escaping and `<...>` wrapping.
  Update its JSDoc.
- [x] Add unit tests in `packages/depot-node/src/repoEnumeration.test.mts` for a different text and target,
  such as `src/b/bar.ts` with `https://github.com/org/repo/blob/0123abc/src/b/bar.ts#L10-L20`,
  and for a text with `[` and `]` with a plain target.
  The existing tests for one argument must still pass.

Done when: the new unit tests pass, and `npm run type-check` and eslint pass for `packages/depot-node`.

#### Outcomes

- `formatMarkdownLink` in `packages/depot-node/src/repoEnumeration.mts` is now `formatMarkdownLink(text: string, target: string = text): string`, with updated JSDoc.
  The link text gets the link-text escaping, and the target gets the link-target escaping (doubled `\`, `<...>` wrapping when it contains whitespace, `(`, `)`, `<` or `>`).
  A call with one argument gives the same result as before, so a path is formatted as in Task 2.
  Example for a permalink: `formatMarkdownLink("src/b/bar.ts", "https://github.com/org/repo/blob/0123abc/src/b/bar.ts#L10-L20")`
  gives `[src/b/bar.ts](https://github.com/org/repo/blob/0123abc/src/b/bar.ts#L10-L20)`.
- 3 new unit tests in `repoEnumeration.test.mts` (a different target, an escaped text with a plain target, a different target that needs `<...>`).
  The 11 `formatMarkdownLink` specs pass, with 0 failures, in a filtered run (11 of 693 specs).
  `npm run type-check` and eslint are clean for `packages/depot-node`.
  The full 690-spec run was not repeated; it passed before this change.
- For Task 4: `packages/depot-node` has been built (`npm run build`), so `airliner` can import the new signature.

### Task 4: Ask whether to wrap the result in a Markdown link

Status: Done

#### Task Description

In `apps/airliner/src/commands.mts`, following Task 1's, Task 2's and Task 3's Outcomes.
Task 3 must be built first (`npm run build` in `packages/depot-node`),
because `airliner` imports it through its `dist`.

- [x] At the end of `copyPathOrPermalink`, after every other prompt and before the clipboard is written,
  for both "Path" and "Permalink", ask a Quick Pick whose title and placeholder are "Wrap this path?" (for a path)
  or "Wrap this permalink?" (for a permalink), with the items "No wrapping" first, the default, and "Wrap in Markdown link".
  Escape copies nothing.
- [x] For a path that is wrapped, format it again with `"forward"` slashes, whatever separator the user chose,
  and copy `formatMarkdownLink(<that path>)`.
  Use the same formatting as the user's "Path to copy" choice, including "Path relative to active document".
- [x] For a permalink that is wrapped, copy `formatMarkdownLink(<relPath>, <the permalink URL>)`,
  where `relPath` is the item's path relative to the repo root with forward slashes.
- [x] For "No wrapping", copy exactly what is copied today.
- [x] Show "Copied:", a space and exactly the text that went to the clipboard.
- [x] Update the JSDoc of every function whose parameters or behavior change, including that of `copyPathOrPermalink`.

Done when: `npm run type-check` and eslint pass for `apps/airliner`, and the extension bundles.

#### Outcomes

- In `apps/airliner/src/commands.mts`, `copyPathOrPermalink` now ends both branches with a "wrap" question,
  asked after every other prompt and before the clipboard is written.
  The "Copy as" list and its placeholder are unchanged.
- New private helper `askWrapInMarkdownLink(noun: "path" | "permalink")` shows a Quick Pick whose title and placeholder are "Wrap this path?" or "Wrap this permalink?",
  with the items "No wrapping" (first, the default) and "Wrap in Markdown link".
  It resolves with `true`, `false`, or `undefined` when the user presses Escape, in which case nothing is copied.
- Path branch: the chosen path is formatted by a local `formatChosenPath(style)`.
  "No wrapping" copies `formatChosenPath(slashStyle)` as before.
  "Wrap in Markdown link" copies `formatMarkdownLink(formatChosenPath("forward"))`, whatever separator the user chose,
  and this includes "Path relative to active document".
  The "Path separator" prompt is still shown on Windows, because the question comes after it.
- Permalink branch: after `makeGitPermalink` succeeds (a failure still shows its one error message and stops before the question),
  "Wrap in Markdown link" copies `formatMarkdownLink(relPath, <permalink URL>)`, and "No wrapping" copies the URL as before.
  `relPath` is the item's path relative to `baseDir`, which is the repo root when there is one.
- New private helper `copyAndConfirm(text)` writes the clipboard and shows "Copied:", a space and exactly that text,
  and replaces the two copies of that code.
- The JSDoc of `copyPathOrPermalink` now mentions the wrapping.
  Its parameters did not change.
- Checked: `npm run type-check` and `npx eslint src/commands.mts` are clean for `apps/airliner`, and `npm run esbuild-dev` bundles.
- Not checked: the prompts in the Extension Development Host; Task 5 covers them.

### Task 5: Verify the build

Status: Done

#### Task Description

Run the repo's full verification command from the repo root:

```powershell
npm run all && npm run type-check
```

Then the user tries the new question by hand in the Extension Development Host,
in both "Airliner copy repo path" and "Airliner copy current file path":
with "Path", the question reads "Wrap this path?", "No wrapping" is first,
"Wrap in Markdown link" copies `[path](path)` with forward slashes whatever separator was chosen on Windows,
"No wrapping" copies the plain path as before, and Escape copies nothing;
with "Permalink", the question reads "Wrap this permalink?",
"Wrap in Markdown link" copies `[repo-relative path](permalink URL)`, including a link to a line or range,
and "No wrapping" copies the plain permalink as before;
and a path with a space copies a link whose target is wrapped in `<...>`.
The confirmation message shows exactly the text copied.

Answered (see Outcomes): whether the hand test worked.
The cases to try were, in both "Airliner copy repo path" and "Airliner copy current file path":
"Path" then "Wrap in Markdown link" (a plain path, and a path with a space);
"Path" then "No wrapping";
on Windows, "Use backslashes" then "Wrap in Markdown link" (the link still uses forward slashes);
"Permalink" then "Wrap in Markdown link", and "Permalink" then "No wrapping",
and a permalink to a line or range;
Escape on the new question;
and check that the confirmation message shows exactly the text copied.

Done when: the command exits with code 0, and the user confirms the hand test.

#### Outcomes

- `npm run all && npm run type-check` exited with code 0 from the repo root:
  45 of 45 Turborepo tasks successful in each run, and 0 test failures,
  including 1597 `depot` specs and 693 `depot-node` specs (the 690 from before and the 3 added in Task 3).
- Hand test: the user reported "Yes, it works great."
  The user did not itemise which cases were tried.
