# monorail

## Design of this monorepo

- All packages are contained in the `packages` directory and are built using a
  single `tsc --build` command.  This is desirable because `tsc`` will figure
  out the dependencies and and do a minimal rebuild.

- All applications contained in the `apps` directory, and npm workspaces are
  used to build them.

  When running `npm install` all npm workspace directories will get symbolically
  linked from the root `node_modules` directory so they can be easily imported.
  Although, it looks like I am not using this, but rather importing using a
  relative path into the packages folder.  Not sure why I chose that.

## Using npm Workspaces

For an overview of how to use npm workspaces, refer to:
<https://docs.npmjs.com/cli/v7/using-npm/workspaces>

In general, you just need to add `-w <path_to_workspace` onto the commands that
you're probably already used to.  For example:

```powershell
npm install abbrev -w a
```

## Building

```powershell
npm run build
```

## Apps

### Common Operations

Lint this codebase:

```powershell
npm run lint
```

Run all unit tests:

```powershell
npm run ut
```

Build all packages and apps:

```powershell
npm run build
```

To save a snapshot of this repo's built files (so that you can use a known good
version of the apps contained herein):

```powershell
npm run createSnapshot
```

Running an app without building:

```powershell
.\node_modules\.bin\ts-node --esm .\apps\evaluate\src\evaluate.ts "1/2 + 3/4"
```

## TODO/Where I Left Off

- Change npmRunParallel so that it prints output from each script as soon as it finishes.
  This will help reduce waiting when there is a failure.

- Should unit test be their own separate projects (with their own tsconfig.json)?

- Pull in depot argInquirer

- Pull in depot persistentCache

- Pull in depot QuickServer
