# pdf-to-context

Convert a PDF specification into an AI-agent-friendly bundle: per-chapter text, a
combined master text file, per-chapter full-page PNG images, and an `index.json`
manifest. Chapters are split using the PDF's own bookmarks (or an editable
chapter map you provide).

This is a TypeScript/Node.js port of an earlier pair of PowerShell scripts,
packaged as a Node.js Single Executable Application (SEA).

---

## Prerequisites

- **Poppler** command-line utilities on your `PATH`:
  - `pdfinfo`, `pdftotext`, `pdftoppm` (used by `build`)
  - `pdftohtml` (used to read PDF bookmarks for chapter detection)

  Verify with:

  ```pwsh
  pdfinfo -v; pdftotext -v; pdftoppm -v; pdftohtml -v
  ```

---

## Commands

The CLI exposes two subcommands.

### `detect-chapters <pdf>`

Reads the PDF's bookmark outline and writes an **editable** chapter-map sidecar
named `<pdf-basename>.chapters.json` **next to the PDF**.

```pwsh
pdf-to-context detect-chapters ./CIP_Vol1.pdf
pdf-to-context detect-chapters ./CIP_Vol1.pdf --force   # overwrite an existing map
```

- `--force` — overwrite an existing chapter map (default: refuse if one exists).

Review and edit the generated JSON (rename/merge/drop sections) before building.

### `build <pdf> <outputDir>`

Converts the PDF into a bundle written into `<outputDir>`.

```pwsh
pdf-to-context build ./CIP_Vol1.pdf ./out
pdf-to-context build ./CIP_Vol1.pdf ./out --dpi 300
pdf-to-context build ./CIP_Vol1.pdf ./out --skip-images
pdf-to-context build ./CIP_Vol1.pdf ./out --noise-file ./noise.txt
```

- `--dpi <n>` — resolution for the full-page images (default `200`).
- `--skip-images` — text only; skip page-image rendering.
- `--noise-file <path>` — a file of regexes (one per line; `#` comments and blank
  lines ignored) that **replaces** the built-in per-page noise patterns.

> The output directory's contents are **replaced** on each build (it is emptied
> first, and created if missing), so every run is reproducible. The output
> directory must not contain the input PDF.

---

## How chapters are determined

`build` resolves section boundaries in this order:

1. **Sidecar map** — `<pdf-basename>.chapters.json` next to the PDF, if present.
2. **PDF bookmarks** — otherwise the PDF's own top-level outline is read
   automatically (via `pdftohtml`). Not specific to any one document — any PDF
   that ships an outline works.
3. **Single section** — if there is no sidecar and no usable outline, the whole
   document is emitted as one section named `Document`.

So the sidecar is **optional**; use it to curate names/boundaries or when a PDF
has no outline.

### Chapter map format (`<pdf-basename>.chapters.json`)

A JSON array of objects, each with a `name` and the **physical PDF page**
(1-based) where that section `start`s. Entries are sorted by `start`; each
section ends one page before the next begins, and the last runs to the end of
the document. Two sections may not share the same start page.

```json
[
  { "name": "Chapter 1",  "start": 1 },
  { "name": "Chapter 2",  "start": 31 },
  { "name": "Appendix A", "start": 1563 }
]
```

> "Physical PDF page" = the page index in the PDF, not the printed page number.
> `detect-chapters` fills these in for you.

---

## Output bundle

```text
<outputDir>/
├── text/                       # one UTF-8 .txt per section (pdftotext -layout)
│   ├── 01_Chapter_1.txt
│   └── ...
├── images/                     # one folder per section (omitted with --skip-images)
│   └── 01_Chapter_1/page-0001.png ...
├── <pdf-basename>_MASTER.txt   # all sections concatenated
├── index.json                  # machine-readable section map
└── README.md                   # conventions doc for this bundle
```

### Conventions (for AI agents)

- Text is extracted with `pdftotext -layout`, so tables keep their column
  alignment.
- Every page begins with a marker: `[PDF p.<physical> | printed <spec page>]`.
  - *physical* — 1-based PDF page (use with `pdftotext -f/-l`, `pdftoppm -f/-l`).
  - *printed* — the spec's own page number (e.g. `4-1`).
- **Cite using the spec section number** (e.g. `4-8.1`); the printed page is a
  fallback for locating content.
- Page images live at `images/<section>/page-NNNN.png` (`NNNN` = zero-padded
  physical PDF page) — open these for figures and diagrams the text layer can't
  represent.
- `index.json` is the navigation map: section → page range → text file → image
  folder.

### Removed page noise

These repeating per-page lines are stripped by default (tuned for the CIP
specification's license footer and running header):

- the licensee/subscription footer (`This subscription copy is … licensed to …`)
- `SUBSCRIPTION TERMS AND CONDITIONS …`
- `Edition <x.yz>`
- the running chapter header (`Volume <n>: … Chapter …`)

Override them for a different document family with `--noise-file`.

---

## Build / SEA packaging

```pwsh
npm run build        # tsc + bundle into a single executable (dist/pdf-to-context.exe)
npm run build:ts     # TypeScript compile only
npm test             # Jasmine unit tests
npm run lint
npm run type-check
```

`npm run build` produces a standalone executable at
`dist/pdf-to-context.exe` (Node SEA), runnable without a separate Node install.
