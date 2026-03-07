# TODO

- To aid performance `commandTo` should isolate all of the directory creation
  operations and complete them before performing the file operations.

- Change npmRunParallel so that it prints output from each script as soon as it finishes.
  This will help reduce waiting when there is a failure.

- Pull in depot argInquirer

- Pull in depot persistentCache

- Pull in depot QuickServer


## todo - ESLint 10 migration

- [X] Get linting working in depot (eslint.config.ts).
- [X] Add eslint-config-turbo
- [X] Add eslint-import-resolver-typescript?  No
- [X] Add eslint-plugin-import? No
- [X] Get linting working in eslint-config-2.
- [X] Add stylistic plugin
- [X] Convert all project to use eslint-config-2 (to be like depot's)
      - package.json: Update lint script to: eslint .
      - package.json: Remove all linting dependencies except "eslint": "^10.0.1"
      - package.json: Change devDependency to "@repo/eslint-config-2": "*", (emphasis on -2)

- [X] Migrate rules from packages\eslint-config\eslint.package.cjs
- [ ] Remove the eslint-config package
- [ ] Rename eslint-config-2 to eslint-config
- [ ] Update Jasmine from 5.3.0 to 6.1.0.
