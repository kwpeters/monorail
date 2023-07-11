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
rmrf .\out\ && hr && rmrf .\snapshot && hr && npm run build && npm run createAppLaunchers
```

## Apps

### Running an App

```powershell
.\node_modules\.bin\ts-node --esm .\apps\evaluate\src\evaluate.ts "1/2 + 3/4"
```

## Where I Left Off/Todo

- Do I want to get rid of root package.json script complexities in favor of
  build scripts?

- Rename `packages-tsc:post` to something better, because apps use this too.

- Create a script that will copy the `out` directory to the `snapshot` directory.

- Pull watcher app into this project as an app.

  - Will need to set the watcher app's package.json "bin" to the app so that
    a launcher script will be created for it.

- Should unit test be their own separate projects (with their own tsconfig.json)?

- Pull in depot argInquirer

- Pull in depot persistentCache

- Pull in depot QuickServer
