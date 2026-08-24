# js13k Games 2026 jam entry by David Brad

# About this project
- This project is written in TypeScript, and transpiled using the [esbuild](https://esbuild.github.io/) package.
- This project's build tools use [node.js](https://nodejs.org/en/download/) v24.1.0 or higher.
- The build tools are meant to be run on Linux or Windows using a bash friendly terminal.

## This project has 3 main scripts:
- ```install.sh``` - Windows friendly install of all dependencies, and unzips build tools from the tools.7z file included.
- ```install.sh linux``` - Linux friendly install of all dependencies, and unzips build tools from the tools.7z file included.
- ```uninstall.sh``` - Cleans up the build folders, dist folders, node_modules, and tools.
- ```build.sh``` - Release build process. Bumps version number, generates a single minified and heavily compressed js file with all dependancies hardcoded, inlines everything into the index.html, and zips index.html file into "/dist/game.zip".
- ```build.sh dev``` - Live reloading development server. Will serve the game at port 3000 on localhost. All changes to Typescript files will trigger a re-transpile.
- ```build.sh net``` - A quick release build version designed to produce an output index.html for a service like Netlify to host.

<br />
<hr />
<br />

## js13k Games 2026 Jam Entry
### Copyright © 2026 David Brad
<br />