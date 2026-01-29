# monorail

This monorepo contains packages and applications that use the following tools:

- This repo uses [TypeScript](https://www.typescriptlang.org/) for static type
  checking.
- This repo uses [ESLint](https://eslint.org/) for code linting.
- This repo uses [Jasmine](https://jasmine.github.io/) for its unit tests.
- This repo uses [depcheck](https://github.com/depcheck/depcheck#readme) for
  auditing dependencies.
- This repo uses [Turborepo](https://turbo.build/) for its build system.
  - Turborepo provides both local and remote caching of build artifacts.  Remote
    caching requires a Vercel account, so only local caching is currently done.
  - Learn more about the power of Turborepo:
    - [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
    - [Caching](https://turbo.build/repo/docs/core-concepts/caching)
    - [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
    - [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
    - [Configuration Options](https://turbo.build/repo/docs/reference/configuration)
    - [CLI Usage](https://turbo.build/repo/docs/reference/command-line-reference)
- Apps that require distribution as standalone executables are created using
  Node.js's [single executable
  application](https://nodejs.org/dist/latest-v25.x/docs/api/single-executable-applications.html)
  feature.

## Developing in this monorepo

### Prerequisites

1. Node.js must be installed.  For the specific version required, refer to the
   `engines` property within [package.json](./package.json).  To allow for the
   installation of multiple Node.js versions, use of `nvm` is highly recommended
   ([Windows](https://github.com/coreybutler/nvm-windows),
   [Mac](https://github.com/nvm-sh/nvm)).

2. The package depot-node requires use of openssl.exe.  Be sure that this
   executable can be found using your PATH environment variable.  If you have
   Git installed, this can usually be found in `C:\Program Files\Git\usr\bin`.

3. Enable developer mode.  This must be done so that the unit tests for Symlink
   can run successfully.

### Install dependencies

```powershell
npm install
```

### Run the unit tests

```powershell
npm run test
```

### Build all packages and apps

```powershell
npm run build
```

### Lint the source code

```powershell
npm run lint
```

Note:

- This monorepo uses ESLint to lint source code.  Therefore, use of the Visual
  Studio Code [ESLint
  extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  is recommended.  You must change the following extension setting so that the
  correct ESLint configuration file can be resolved for source code files:

  ```text
  "eslint.workingDirectories": [
          {
              "mode": "auto"
          }
      ]
  ```

## Generating a Dependency Graph

Turborepo can generate a dependency graph to help visualize the dependencies
between the packages and apps within this monorepo.  This can be helpful in
understanding the package build order and can help ensure the
build process maximizes parallel task execution.

To generate the Graphviz dependency graph:

```powershell
npx turbo run build --graph
```

If you do not have Graphviz installed, you can copy the output and paste it into
an online tool such as [Graphviz
Online](https://dreampuf.github.io/GraphvizOnline/) or
[Edotor](https://edotor.net/).

If you do have Graphviz installed, be sure that your `PATH` environment variable
has been updated to include the installation path of the installed binaries.
You can test this by running `dot -V`.  If this prints dot's version
information, then `PATH` is configured properly.

Now, you can generate the dependency graph, pipe it into `dot` and open the output image:

```powershell
npx turbo run build --graph | dot -T png > deps.png && start deps.png
```
