# TODO

- This repo is not building reliably in Windows WSL.

- When building on Linux, the `createBin` task should not be creating Windows
  batch files in the `bin` directory.  Instead, it should create symlinks to the
  actual binaries.  Those .js files should also have shebang lines prepended to
  them and their permissions set to be executable.

- To aid performance `commandTo` should isolate all of the directory creation
  operations and complete them before performing the file operations.

- Change npmRunParallel so that it prints output from each script as soon as it finishes.
  This will help reduce waiting when there is a failure.

- Pull in depot argInquirer

- Pull in depot persistentCache

- Pull in depot QuickServer
