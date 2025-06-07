#!/bin/bash

set -e

ESM_DIR="dist/lib.esm"
CJS_DIR="dist/lib.cjs"

if [ -d "$ESM_DIR" ]; then
  echo '{ "type": "module" }' > "$ESM_DIR/package.json"
  echo "Wrote $ESM_DIR/package.json"
else
  echo "Warning: $ESM_DIR does not exist."
fi

if [ -d "$CJS_DIR" ]; then
  echo '{ "type": "commonjs" }' > "$CJS_DIR/package.json"
  echo "Wrote $CJS_DIR/package.json"
else
  echo "Warning: $CJS_DIR does not exist."
fi