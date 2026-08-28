#!/bin/sh
# A freshly created volume belongs to root, and the server does not run as
# root. Claim it once, then drop privileges for good.
set -e
DIRECTORY="${DATA_DIR:-/data}"
mkdir -p "$DIRECTORY"
chown -R nextjs:nodejs "$DIRECTORY"
exec su-exec nextjs "$@"
