#!/usr/bin/env bash

set -e

if [ -n "$DIST_VERSION" ]; then
    version=$DIST_VERSION
else
    version=`git describe --dirty --tags || echo unknown`
fi

pnpm nx clean
VERSION=$version pnpm build

# include the sample config in the tarball. Arguably this should be done by
# `pnpm build`, but it's just too painful.
cp config.sample.json webapp/

mkdir -p dist
cp -r webapp matron-$version

# Just in case you have a local config, remove it before packaging
rm matron-$version/config.json || true

# GNU/BSD compatibility workaround
tar_perms=(--owner=0 --group=0) && [ "$(uname)" == "Darwin" ] && tar_perms=(--uid=0 --gid=0)
tar "${tar_perms[@]}" -chvzf dist/matron-$version.tar.gz matron-$version
rm -r matron-$version

echo
echo "Packaged dist/matron-$version.tar.gz"
