# syntax=docker/dockerfile:1.7
# Build context is the repository root (the API imports ../shared).
#   docker compose build api      or      docker build -f api/Dockerfile .

FROM node:22-bookworm-slim AS deps
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY shared ./shared
COPY api ./api
WORKDIR /app/api
RUN npx prisma generate && npx nest build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
# Chromium renders receipt PDFs (Arabic shaping needs a real browser engine).
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium dumb-init ca-certificates fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000 \
    CHROME_PATH=/usr/bin/chromium \
    UPLOAD_DIR=/app/api/storage/uploads
WORKDIR /app/api
COPY --from=build --chown=node:node /app/api/package.json /app/api/prisma.config.ts ./
COPY --from=build --chown=node:node /app/api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/api/dist ./dist
COPY --from=build --chown=node:node /app/api/prisma ./prisma
RUN mkdir -p /app/api/storage/uploads && chown -R node:node /app/api/storage
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
# apply pending migrations (non-destructive), then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/api/src/main.js"]
