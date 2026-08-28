# The site, packaged for a host with a real disk.
#
# Deliberately not a serverless target: everything this site remembers — her
# price changes, her uploads, client accounts and orders — is written to
# `DATA_DIR`, so it needs a filesystem that survives a deploy. One volume
# mounted at /data is the whole storage story.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nothing secret is needed to build: every key is read at request time.
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/data

# su-exec lets the entrypoint take ownership of the mounted volume as root and
# then hand the server itself to an unprivileged user.
RUN apk add --no-cache su-exec \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
