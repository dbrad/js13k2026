#!/bin/bash
set -e
set -u
set -o pipefail

if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
else
    PLATFORM="windows"
fi

log() {
  echo "[Build] $1"
}

rm -rf build/constants
mkdir -p build/constants

log "Generating constants"
node build/scripts/generate-constants.js
cp build/constants/constants.d.ts src/ts/_constants.d.ts

if [ "${1:-release}" == "dev" ]; then
    log "Building dev"
    rm -rf build/debug
    mkdir -p build/debug
    cp src/www/index.html build/debug/index.html
    node build/scripts/debug-app.mjs
elif [ "${1:-release}" == "net" ]; then
    log "Building netlify version"
    npm install -q
    mkdir -p build/release
    node_modules/.bin/html-minifier-terser --collapse-whitespace --remove-comments --remove-attribute-quotes --output build/release/index.html src/www/index.html > /dev/null
    node build/scripts/release-app.mjs | node_modules/.bin/uglifyjs --config-file build/scripts/minify.config.json -o build/release/main.js
    node_modules/.bin/roadroller build/release/main.js -O1 -o build/release/main.js > /dev/null 2>&1
    rm -rf dist
    mkdir -p dist/src
    node_modules/.bin/html-inline -i build/release/index.html -o dist/src/index.html > /dev/null
else
    log "Building release"
    rm -rf build/release
    mkdir -p build/release
    node_modules/.bin/html-minifier-terser --collapse-whitespace --remove-comments --remove-attribute-quotes --output build/release/index.html src/www/index.html > /dev/null
    # node build/scripts/version-bump.mjs
    node build/scripts/release-app.mjs | node_modules/.bin/uglifyjs --config-file build/scripts/minify.config.json -o build/release/main.js
    last_line=$(node_modules/.bin/roadroller build/release/main.js -O2 -Zab0 -Zlr1064 -Zmc4 -Zmd14 -Zpr16 -S0,1,2,3,7,13,14,21,42,57,344,465 -o build/release/main.js 2>&1 | tail -n 1)
    log "$last_line"
    rm -rf dist
    mkdir -p dist/src
    node_modules/.bin/html-inline -i build/release/index.html -o dist/src/index.html > /dev/null
    if [ $PLATFORM == "windows" ]; then
        ./tools/7z/7za a -tzip dist/game.zip dist/src/* > /dev/null 2>&1
    	./tools/ect -9 -zip dist/game.zip > /dev/null 2>&1
        ./tools/cloc-1.86.exe --quiet --hide-rate src/
    else
        ./tools/7z/7zz a -tzip dist/game.zip dist/src/* > /dev/null 2>&1
    	./tools/ect -9 -zip dist/game.zip > /dev/null 2>&1
        cloc --quiet --hide-rate src/
    fi
    node build/scripts/file-size.js
fi