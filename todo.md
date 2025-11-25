# TODO

- To aid performance `commandTo` should isolate all of the directory creation
  operations and complete them before performing the file operations.

- Change npmRunParallel so that it prints output from each script as soon as it finishes.
  This will help reduce waiting when there is a failure.

- Pull in depot argInquirer

- Pull in depot persistentCache

- Pull in depot QuickServer
