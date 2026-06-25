---
name: build-and-verify
description: How to build and verify all packages and applications within this monorepo
---

# Skill Instructions

This monorepo repository contains packages/libraries (in the `packages` folder)
and applications (in the `apps` folder).  The applications can have dependencies
on the packages, and the packages may have dependencies on other packages.

The default Turborepo configuration uses a TUI user interface, which prevents AI agents from reading output.  The following explains how AI agents should invoke tooling using the `--ui stream` command line option to write output to stdout and give AI better access.

When developing in this repository, it is important that all packages and
applications are maintained in a workable state.  To facilitate this, npm
scripts have been created and can be run from the root directory of this
repository.  After making changes to any package or application, you should
ensure the following still run successfully:

- All projects can be built without compiler warnings and errors.

  ```powershell
  npx turbo --ui stream build
  ```

- All projects lint without warnings or errors

  ```powershell
  npx turbo --ui stream lint
  ```

- All unit tests pass

  ```powershell
  npx turbo --ui stream test
  ```

- Shortcuts are successfully created to allow for easy invocation of applications

  ```powershell
  npm run createBin
  ```

- A dependency check is run to make sure there are no missing dependencies and no unused dependencies

  ```powershell
  npx turbo --ui stream depcheck
  ```

- All unit tests can be compiled without warnings or errors.  The following
  command is similar to the normal build process, but it also includes the unit
  test files in the compilation and does not write any output files to disk.

  ```powershell
  npx trubo --ui stream type-check
  ```

All of the above verifications can be run together using the following command line:

```powershell
npx turbo --ui stream build && npx turbo --ui stream lint && npx turbo --ui stream test && npm run createBin && npx turbo --ui stream depcheck && npx turbo --ui stream type-check
```
