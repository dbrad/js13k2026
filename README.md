# js13k Games 2026 jam entry by David Brad

# About this project
- This project is written in TypeScript, and transpiled using the [esbuild](https://esbuild.github.io/) package.
- This project's build tools use [node.js](https://nodejs.org/en/download/) v24.1.0 or higher.
- The build tools are meant to be run on Windows, using a bash-like terminal such as Git Bash.

## This project has 3 main scripts:
- ```install.sh``` - Installs all dependencies, and unzips build tools from the tools.7z file included.
- ```uninstall.sh``` - Cleans up the build folders, dist folders, node_modules, and tools.
- ```build.sh``` - Release build process. Bumps version number, generates a single minified and heavily compressed js file with all dependancies hardcoded, inlines the code into the html file, and zips the html file into "/dist/game.zip".
- ```build.sh dev``` - Live reloading development server. Will serve the game at port 3000 on localhost. All changes to Typescript files will trigger a re-transpile.

<br />
<hr />
<br />

## js13k Games 2026 Jam Entry
### Copyright © 2026 David Brad
<br />