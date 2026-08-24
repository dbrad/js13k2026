#!/bin/bash

if [ "${1:-windows}" == "linux" ]; then
    ./tools/7z/7zz x tools.7z -otools -y
    echo "PLATFORM=linux" > .env
else
    ./tools/7z/7za x tools.7z -otools -y
    echo "PLATFORM=windows" > .env
fi

mkdir dist
npm install