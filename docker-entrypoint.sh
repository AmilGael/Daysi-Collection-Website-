#!/bin/sh
# A freshly created volume belongs to root, and the server does not run as
# root. Claim it once, then drop privileges for good.
set -e
DIRECTORY="${DATA_DIR:-/data}"
mkdir -p "$DIRECTORY"
chown -R nextjs:nodejs "$DIRECTORY"

# Encoded photographs live on the volume too. Next writes them under
# .next/cache/images beside the server, which a deploy replaces, so every
# release used to start with every picture cold. Nothing in here is a
# record: it is all derived from the source photographs and can be thrown
# away. The link is made before privileges drop so it survives the chown.
IMAGE_CACHE="$DIRECTORY/image-cache"
mkdir -p "$IMAGE_CACHE" /app/.next/cache
rm -rf /app/.next/cache/images
ln -s "$IMAGE_CACHE" /app/.next/cache/images
chown -R nextjs:nodejs "$IMAGE_CACHE" /app/.next/cache

exec su-exec nextjs "$@"
