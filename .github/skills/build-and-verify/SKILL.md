---
name: build-and-verify
description: How to build and verify all packages and applications within this monorepo
---

# Skill Instructions

This monorepo repository contains packages/libraries (in the `packages` folder)
and applications (in the `apps` folder).  The applications can have dependencies
on the packages, and the packages may have dependencies on other packages.

When developing in this repository, it is important that all packages and
applications are maintained in a workable state.  To facilitate this, npm
scripts have been created and can be run from the root directory of this
repository.  After making changes to any package or application, you should
ensure the following still run successfully:

- All projects can be built without compiler warnings and errors.

  ```powershell
  npm run build
  ```

- All projects lint without warnings or errors

  ```powershell
  npm run lint
  ```

- All unit tests pass

  ```powershell
  npm run test
  ```

- Shortcuts are successfully created to allow for easy invocation of applications

  ```powershell
  npm run createBin
  ```

- A dependency check is run to make sure there are no missing dependencies and no unused dependencies

  ```powershell
  npm run depcheck
  ```

- All unit tests can be compiled without warnings or errors.  The following
  command is similar to the normal build process, but it also includes the unit
  test files in the compilation and does not write any output files to disk.

  ```powershell
  npm run type-check
  ```

The `build`, `lint`, `test`, `createBin` and `depcheck` npm scripts can all be run using
the command:

```powershell
  npm run all
  ```

Therefore, all of the listed verifications can be run on a Bash or PowerShell
command line using the following command:

```powershell
  npm run all && npm run type-check
  ```

Note:  The above npm scripts utilize Turborepo to run the commands in each
project.  Turborepo performs the needed actions in the correct order based on
the dependencies between the projects and optimizes the process by running tasks
in parallel where possible and using previously cached output for projects that
have not changed.

Note:  This project currently only contains TypeScript projects.  It does not
contain dotnet projects.
