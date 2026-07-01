#!/usr/bin/env bash
#
# build-release.sh — assemble a clean WhatsMine distribution ZIP for CodeCanyon.
#
# It copies the project into dist/<name>/ using the rsync filter rules in
# .distignore (which strip secrets, logs, dependencies, caches and dev cruft),
# guarantees the runtime directories exist but are empty, then zips the result.
#
# The buyer's package therefore contains source + .env.example only — never your
# real .env, never your logs, never node_modules/vendor.
#
# Usage:
#   ./scripts/build-release.sh [version]
#
# Example:
#   ./scripts/build-release.sh 1.0.0   ->  dist/whatsmine-1.0.0.zip
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-$(date +%Y.%m.%d)}"
NAME="whatsmine-${VERSION}"
DIST="${ROOT}/dist"
STAGE="${DIST}/${NAME}"

echo "==> Staging ${NAME}"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"

# Copy the project through the .distignore filter.
rsync -a --filter="merge ${ROOT}/.distignore" "${ROOT}/" "${STAGE}/"

# Laravel needs these directories to exist at runtime even when empty.
for d in \
  storage/logs \
  storage/framework/sessions \
  storage/framework/cache/data \
  storage/framework/views \
  storage/framework/testing \
  storage/app/public/media \
  bootstrap/cache
do
  mkdir -p "${STAGE}/${d}"
  if [ ! -f "${STAGE}/${d}/.gitignore" ]; then
    printf '*\n!.gitignore\n' > "${STAGE}/${d}/.gitignore"
  fi
done

# Belt-and-suspenders: a debug-on .env must never reach the buyer.
if [ -f "${STAGE}/.env" ]; then
  echo "ERROR: a real .env slipped into the package — aborting." >&2
  exit 1
fi
if [ ! -f "${STAGE}/.env.example" ]; then
  echo "ERROR: .env.example is missing from the package — aborting." >&2
  exit 1
fi

echo "==> Zipping"
cd "${DIST}"
rm -f "${NAME}.zip"
# -X strips macOS extended attributes / resource forks.
zip -rqX "${NAME}.zip" "${NAME}" -x '*.DS_Store'

echo "==> Done: ${DIST}/${NAME}.zip ($(du -h "${NAME}.zip" | cut -f1))"
echo "    Reminder: buyer runs 'composer install', 'npm install && npm run build', then 'php artisan saas:install'."
