# monorail

## Design of this monorepo

- All packages are contained in the `packages` directory and are built using a
  single `tsc --build` command.  This is desirable because `tsc`` will figure
  out the dependencies and and do a minimal rebuild.

- All applications contained in the `apps` directory, and npm workspaces are
  used to build them.

  When running `npm install` all npm workspace directories will get symlinked
  from the root `node_modules` directory so they can be easily imported.
  Although, it looks like I am not using this, but rather importing using a
  relative path into the packages folder.  Not sure why I chose that.

## todo

- All package.json "main" entries should point to script within their directory.
- Should unit test be their own separate projects (with their own tsconfig.json)?
- Pull in depot argInquirer
- Pull in depot persistentCache
- Pull in depot QuickServer

## Where I Left Off

- One the above are done, I think the launchers placed in the out/.bin folder
  will be able to launch my apps, which means I can start pulling in my watcher
  app, etc.
