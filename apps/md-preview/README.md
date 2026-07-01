# md-preview

Render one or more Markdown files to HTML, host them from a temporary directory,
and open the result in your browser.

## What it does

- Accepts Markdown files from positional args, piped stdin, or both
- Renders Markdown to HTML with syntax highlighting
- Supports Markdown emoji shortcodes like `:smile:`
- Copies and rewrites relative asset links into the temp output
- Starts a local HTTP server and prints local and LAN URLs
- Optionally opens your default browser automatically
- Cleans up the temporary directory on shutdown

## Quick start

From repository root:

```powershell
.\bin\md-preview.cmd C:\path\to\file.md
```

Run without launching a browser:

```powershell
.\bin\md-preview.cmd C:\path\to\file.md --no-open
```

Use timeout-based shutdown (works in interactive and non-interactive runs):

```powershell
.\bin\md-preview.cmd C:\path\to\file.md --timeoutMs 5000
```

Pipe files from another command:

```powershell
splat **/*.md | .\bin\md-preview.cmd --timeoutMs 5000 --no-open
```

## CLI

```text
md-preview [files...] [--no-open] [--timeoutMs <number>]
```

### Options

- `--no-open`
	- Do not launch a browser automatically
- `--timeoutMs <number>`
	- Auto-shutdown timeout in milliseconds
	- If provided, timeout takes precedence over keypress shutdown

## Input rules

- Inputs are merged from positional args and piped stdin
- Paths are normalized and deduplicated
- Valid files must:
	- exist
	- be files (not directories)
	- end in `.md` or `.markdown`

If any input is invalid, md-preview exits with code `1` and lists all invalid
paths.

## Runtime behavior

- Interactive mode:
	- waits for any keypress to stop unless `--timeoutMs` is set
- Non-interactive mode:
	- requires `--timeoutMs`
	- browser launch is forced off

On startup it prints:

- temp directory path
- rendered file counts
- local URL
- LAN URL (if external IPv4 is available)

## Exit codes

- `0` success
- `1` invalid input or usage
- `2` runtime failure
- `3` invalid non-interactive configuration

## Styling and VS Code parity

md-preview uses vendored VS Code markdown preview styles:

- `assets/vscode-markdown.css`
- `assets/vscode-highlight.css`

It also appends a small fallback layer at runtime so styling remains consistent
when theme variables are missing outside the VS Code preview host. The fallback
layer is intentionally minimal and only covers:

- inline code foreground/background treatment
- fenced code block background and border variables

Refresh those from your local VS Code installation:

```powershell
npm --workspace @repo/md-preview run sync:vscode-css
```

## Security note

Raw HTML in Markdown is allowed by design. Use md-preview only with trusted
content and trusted environments.

## Development commands

```powershell
npm --workspace @repo/md-preview run build
npm --workspace @repo/md-preview run lint
npm --workspace @repo/md-preview run test
npm --workspace @repo/md-preview run type-check
npm --workspace @repo/md-preview run depcheck
```

## Troubleshooting

- Browser does not open on Windows
	- verify default browser settings
	- run with `--no-open` and open the printed URL manually
- Process does not stop in CI
	- make sure `--timeoutMs` is provided
- Styling looks outdated
	- run `npm --workspace @repo/md-preview run sync:vscode-css`
