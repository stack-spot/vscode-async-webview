# Introduction
This document is aimed at developers of this library. If you want to read the document for users, please, read [this text](README.md)
instead.

# Pre-installation
1. Make sure you have Node >= 18 installed. To check this, type `node -v` in a terminal window. If you don't have it, follow the
instructions [here](https://nodejs.org/en).
2. Make sure you have PNPM >= 8 installed. To check this, type `pnpm -v` in a terminal window. If you don't have it, in a terminal window
type:
```sh
corepack enable
corepack prepare pnpm@latest --activate
```

If the commands above don't work, please follow the instructions [here](https://pnpm.io/installation).

# Installation
1. Clone the repository.
2. In a terminal window, in the root directory, run:
```sh
pnpm i
```

# Compilation
To compile everything, you can just run:
```sh
pnpm compile
```

You can also compile the packages separately:
- `pnpm compile:shared`
- `pnpm compile:backend`
- `pnpm compile:client`
- `pnpm compile:react`

The compiled files will be created at `./out`, inside each package.

# Publishing
This project uses [changesets](https://github.com/changesets/changesets). Please, use the 
[guide provided by pnpm](https://pnpm.io/pt/using-changesets#publicando-changesets).

**Attention:** changesets currently has a weird behavior that bumps major versions of packages even if the user explicitly tells no to.
This is being discussed [here](https://github.com/changesets/changesets/issues/1011). While we can't opt out from this, please, always check
the version of the package "react" before publishing.

**Attention:** run the script `pre-publish`, on the root directory, before publishing. This will compile the packages and copy important
files.

### Summary
```sh
pnpm changesets
git add -A
git commit -m "changesets for {version}"
pnpm changesets version
git add -A
git commit -m "publishing {version}"
pnpm pre-publish
pnpm publish -r --access public
```

# Packages
- backend: library imported by the extension itself.
- client: library imported by the web application.
- react: utilities for web application created with React.
- shared: code shared between the backend and client.

# Running
Use the [sample app](https://github.com/Tiagoperes/vscode-async-webview-sample) to run and test the libraries.
