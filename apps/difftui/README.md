# difftui

A command-line Terminal User Interface (TUI) for interactively comparing and synchronizing files between two directories.

## Overview

`difftui` provides an interactive way to explore differences between two directory trees and perform actions on differing files. It displays a list of files that are identical, left-only, right-only, or differ in content, and allows you to:

- View detailed diffs of individual files
- Open files in VS Code for editing
- Compare files using VS Code's diff viewer
- Configure which file differences to display
- Set action priorities for synchronization
- Save and load configuration files for reusable diff workflows

## Installation

Build the application from the monorepo root:

```bash
npm run build
```

This creates the executable at `bin/difftui.cmd`.

To add it to your PATH, you can place the `bin` directory in your PATH environment variable.

## Usage

### Basic Comparison

Compare two directories:

```bash
difftui /path/to/left /path/to/right
```

### Using a Configuration File

Load directories and settings from a config file:

```bash
difftui --config difftui.json
```

Or with the short option:

```bash
difftui -c difftui.json
```

## Configuration

### Config File Format

Create a `difftui.json` configuration file to define your comparison settings:

```json
{
  "leftDir": "/path/to/left",
  "rightDir": "/path/to/right",
  "actionPriority": "preserve",
  "includeIdentical": false,
  "includeLeftOnly": true,
  "includeRightOnly": true,
  "includePatterns": [],
  "excludePatterns": [".git", "node_modules", "dist"]
}
```

#### Configuration Options

- **leftDir** (string): Path to the left directory (absolute or relative)
- **rightDir** (string): Path to the right directory (absolute or relative)
- **actionPriority** (string): How to handle synchronization actions
  - `"preserve"`: Take no automated action (default)
  - `"sync-left-to-right"`: Synchronize files from left to right
  - `"sync-right-to-left"`: Synchronize files from right to left
- **includeIdentical** (boolean): Display files that are identical in both directories
- **includeLeftOnly** (boolean): Display files that exist only in the left directory
- **includeRightOnly** (boolean): Display files that exist only in the right directory
- **includePatterns** (array): Glob patterns to include (empty means include all)
- **excludePatterns** (array): Glob patterns to exclude

### Interactive Settings

You can modify settings interactively while the application is running. Changes can be saved to a configuration file for future use.

## Interactive Features

### File Status Indicators

- **L** - File exists only in left directory
- **R** - File exists only in right directory
- **≠** - Files differ in content
- **=** - Files are identical

### Actions

For each file, you can:

- **View diff** - See the content differences in the terminal
- **Open in VS Code** - Edit the file
- **Diff in VS Code** - View differences using VS Code's diff viewer
- **Delete** - Remove the file
- **Copy** - Copy the file from one directory to another

### Navigation

- Use arrow keys (up/down) to navigate the file list
- Press Enter to view available actions for the selected file
- Press `i` to ignore (or un-ignore) the selected file
- Press `I` (Shift+i) to show/hide ignored files
- Press `u` to un-ignore all files
- Press `s` to open settings
- Press `r` to refresh the file list
- Press `q` to quit
- Press `Ctrl+e` to export the current configuration to `difftui.json`

### Temporarily Ignoring Files

When reconciling two directories you typically work down the list, and files
drop off as they become identical. Sometimes, though, two files are reconciled
but legitimate differences remain — so the file stays in the list and you can
never reach an empty list.

To handle this, you can **temporarily ignore** such files:

- Press `i` on a file to ignore it. Ignored files are hidden from the list, so
  you can keep working toward an empty list.
- A counter in the footer shows how many files are currently ignored.
- Press `I` to reveal ignored files. They appear in their normal position,
  dimmed and marked `(ignored)`; press `i` again on one to un-ignore it.
- Press `u` to un-ignore everything at once.

Ignoring is **session-only**: the ignore list lives only while the application
is running. It is *not* written to the configuration file, and it is *not*
cleared when you reload the configuration (`r`) — only restarting `difftui`
clears it. This is intentionally distinct from `excludePatterns`, which
permanently removes files from the comparison.

## Development

## Dependencies

- **React** - UI framework
- **Ink** - Terminal rendering for React
- **yargs** - Command-line argument parsing
- **Zod** - Configuration schema validation
- **@repo/depot** - Utility functions and helpers
- **@repo/depot-node** - Node.js-specific utilities including directory diffing

## License

See the repository LICENSE file for licensing information.
