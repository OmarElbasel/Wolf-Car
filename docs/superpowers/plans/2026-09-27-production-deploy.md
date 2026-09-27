# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the whole Wolf Car app (Next.js site, NestJS API, PostgreSQL, uploaded photos) on the DigitalOcean droplet `167.172.106.106` behind HTTPS, with a deploy that verifies itself and rolls back, nightly backups, and the local data moved over with fresh credentials.

**Architecture:** Three containers from one `compose.prod.yml` (db, api, web), built on the droplet from git. Caddy on the host terminates HTTPS and proxies to `127.0.0.1:3000`; nothing else is reachable from the internet. Shell scripts in `scripts/` do deploy, smoke test, backup, restore and the one-time data move; one compiled TypeScript script rotates every user's credentials after the move.

**Tech Stack:** Docker Engine + Compose v2, Caddy 2, Ubuntu 24.04, Node 22, Next.js 16 (`output: "standalone"`), NestJS 12 + Prisma 7, PostgreSQL 17, bash, Jest + jest-mock-extended.

**Spec:** `docs/superpowers/specs/2026-09-27-production-deploy-design.md`

## Global Constraints

- Droplet: `167.172.106.106`, Ubuntu 24.04, SSH alias `wolfcar` (user `root`, key `~/.ssh/wolfcar_do`). Today 1 vCPU / 1 GB; target 2 vCPU / 4 GB.
- App directory on the droplet: `/opt/wolfcar/app` (a clone of `https://github.com/OmarElbasel/Wolf-Car.git`, public).
- Compose project name: `wolfcar-prod` (the dev `docker-compose.yml` uses `wolfcar`; volumes must not collide).
- Secrets live only in `deploy/prod.env` and `deploy/api.prod.env`, git-ignored. Templates are `deploy/prod.env.example` and `deploy/api.prod.env.example`.
- Temporary public URL until the DNS switch: `https://wolfcar.167-172-106-106.sslip.io`. Final: `https://wolfcar.qa` (+ `www` redirect).
- `API_INTERNAL_URL=http://api:4000` is passed to the web image as a **build arg** and a runtime env var (Next.js bakes rewrites at build time).
- Only `127.0.0.1:3000` is published by containers. `ufw` allows 22, 80, 443 only.
- `SWAGGER_ENABLED=false`, `COOKIE_SECURE=true`, `NODE_ENV=production`, `TRUST_PROXY=loopback, uniquelocal` in production.
- Backups: nightly `pg_dump` kept 14; weekly uploads tarball kept 4; in `/var/backups/wolfcar`.
- DNS for `wolfcar.qa` is at Ooredoo (`dns1-3.qatar.net.qa`). Only the `wolfcar.qa` A record and `www` CNAME change. MX and TXT (Microsoft 365) are never touched.
- Commit style: `feat(deploy): …` / `test(api): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`/api/*` rewrite pointing at the wrong host** (build arg missing) → every uploaded photo 500s. Pinned by Task 2 Step 5 (curl an upload through the web container) and the smoke test's photo check (Task 4).
2. **All visitors appearing as one IP** (proxy chain not trusted) → the API's 300 req/min and auth throttles would lock out everyone at once. Pinned by Task 9 Step 7 (API log shows the caller's real public IP).
3. **A container port reachable from the internet** (Docker publishes around `ufw`) → Postgres/API exposed. Pinned by Task 3 Step 8 (only `127.0.0.1:3000` published) and Task 8 Step 6 (port scan from the laptop).
4. **A deploy that breaks the site stays broken** → rollback must restore the previous images and a passing smoke test. Pinned by Task 7 Step 4 (forced smoke failure rolls back).
5. **A backup that cannot be restored** → pinned by Task 6 Steps 4–5 (laptop data restored, then backup → restore round trip; row counts match).

---

### Task 1: Baseline — every existing check green

The hero animation was committed (`e66c939`), so the landing screenshot tests are out of date. Nothing gets deployed from a red tree.

**Files:**
- Modify: `e2e/landing.spec.ts-snapshots/*.png` (regenerated)

**Interfaces:**
- Consumes: nothing.
- Produces: a green `main` to deploy.

- [ ] **Step 1: Stop the local dev servers** (they hold ports 3000/4000; later tasks need them free)

Run: `lsof -ti :3000 -sTCP:LISTEN | xargs -r kill; lsof -ti :4000 -sTCP:LISTEN | xargs -r kill`

- [ ] **Step 2: Web checks**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass (127 tests at the time of writing).

- [ ] **Step 3: API checks**

Run: `cd api && npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 4: Browser tests, refreshing only the landing snapshots**

Run: `docker compose up -d db-test && npm run e2e:build && npx playwright test landing --update-snapshots && npx playwright test`
Expected: the 8 landing snapshots are rewritten; the full suite passes. Open two of the new PNGs (`landing-en-dark-desktop`, `landing-ar-light-mobile`) and confirm the only change is the hero (tracking card, headlights).

- [ ] **Step 5: Commit**

```bash
git add e2e/landing.spec.ts-snapshots
git commit -m "test(e2e): refresh landing snapshots for the hero arrival animation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Web container image

**Files:**
- Modify: `next.config.ts` (add `output: "standalone"`)
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `API_INTERNAL_URL` read in `next.config.ts:7` and `lib/public-catalog.ts:4`.
- Produces: image `wolfcar-web:latest`; listens on `3000`; `HEALTHCHECK` on `/en`; build arg `API_INTERNAL_URL`.

- [ ] **Step 1: Enable standalone output**

In `next.config.ts`, inside `const nextConfig: NextConfig = {`, add as the first property:

```ts
  // Docker: .next/standalone holds server.js plus only the traced node_modules
  output: "standalone",
```

- [ ] **Step 2: Write `.dockerignore`** (context is the repo root; keep the image small and secrets out)

```
.git
.next
node_modules
api
e2e
tests
test-results
playwright-report
coverage
docs
docker
old products data
deploy
scripts
*.md
.env*
**/*.test.ts
**/*.test.tsx
tsconfig.tsbuildinfo
```

- [ ] **Step 3: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
# Next.js website. Build context is the repository root.
#   docker build --build-arg API_INTERNAL_URL=http://api:4000 -t wolfcar-web .
# API_INTERNAL_URL must be given at BUILD time: next.config.ts bakes the
# /api/* rewrite into the build, so a wrong value here breaks every uploaded
# image in production even if the runtime env is right.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/en').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
```

- [ ] **Step 4: Build it locally, pointing the rewrite at the local API**

Start the local API first (`cd api && npm run start:dev`, wait for "API listening"), then:

Run: `docker build --build-arg API_INTERNAL_URL=http://host.docker.internal:4000 -t wolfcar-web:test .`
Expected: build succeeds. `ECONNREFUSED`/`ENOTFOUND` lines from the catalog fetch during the build are expected (the home page is rendered per request); a failed build is not.

- [ ] **Step 5: Run it and prove the rewrite reaches the API**

```bash
docker run -d --name web-test -p 127.0.0.1:3001:3000 -e API_INTERNAL_URL=http://host.docker.internal:4000 wolfcar-web:test
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/en
IMG=$(curl -s http://127.0.0.1:3001/api/public/categories | grep -o '"/api/uploads/[^"]*"' | head -1 | tr -d '"')
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "http://127.0.0.1:3001$IMG"
docker inspect -f '{{.State.Health.Status}}' web-test
docker rm -f web-test
```
Expected: `200`, then `200 image/webp`, then `healthy` (health may read `starting` for the first 30 s; re-run the inspect).

- [ ] **Step 6: Commit**

```bash
git add next.config.ts Dockerfile .dockerignore
git commit -m "feat(deploy): Docker image for the Next.js site (standalone output)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Production compose file, env templates, shared script helpers

**Files:**
- Create: `compose.prod.yml`
- Create: `deploy/prod.env.example`
- Create: `deploy/api.prod.env.example`
- Create: `scripts/lib.sh`
- Create: `scripts/make-env.sh`
- Modify: `.gitignore` (append `deploy/*.env`)

**Interfaces:**
- Consumes: `wolfcar-web` image (Task 2), `api/Dockerfile` (existing).
- Produces: `scripts/lib.sh` exporting `dc` (compose wrapper), `load_env`, `wait_healthy <timeout-seconds>`, `ROOT`; env var `PUBLIC_URL`; volumes `wolfcar-prod_pgdata`, `wolfcar-prod_uploads`; service names `db`, `api`, `web`.

- [ ] **Step 1: `.gitignore`** — append:

```
# production secrets (templates are *.example)
deploy/*.env
```

(`.env*` in `.gitignore` does not match `prod.env`, so this line is required.)

- [ ] **Step 2: `deploy/prod.env.example`**

```
# Copied to deploy/prod.env by scripts/make-env.sh (never committed).
# Database password: URL-safe hex, generated.
POSTGRES_PASSWORD=__GENERATED__
# Where the smoke test and deploy check the site from.
#   before the DNS switch: https://wolfcar.167-172-106-106.sslip.io
#   after:                 https://wolfcar.qa
#   local test:            http://127.0.0.1:3000
PUBLIC_URL=https://wolfcar.167-172-106-106.sslip.io
```

- [ ] **Step 3: `deploy/api.prod.env.example`**

```
# Copied to deploy/api.prod.env by scripts/make-env.sh (never committed).
# DATABASE_URL and NODE_ENV are set in compose.prod.yml.
PORT=4000
LOG_LEVEL=info
# Remove the sslip.io and localhost entries after the switch to wolfcar.qa.
CORS_ORIGINS=https://wolfcar.qa,https://www.wolfcar.qa,https://wolfcar.167-172-106-106.sslip.io,http://localhost:3000
# Caddy (loopback) -> web container (Docker network, private range) -> api
TRUST_PROXY=loopback, uniquelocal
SWAGGER_ENABLED=false
JWT_ACCESS_SECRET=__GENERATED__
JWT_ACCESS_TTL_SECONDS=900
REFRESH_TTL_DAYS=7
SHOWROOM_SESSION_TTL_HOURS=16
COOKIE_SECURE=true
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15
AUTH_THROTTLE_LIMIT=10
AUTH_THROTTLE_TTL_SECONDS=60
TOTP_ENCRYPTION_KEY=__GENERATED__
TOTP_ISSUER=Wolf Car
```

- [ ] **Step 4: `compose.prod.yml`**

```yaml
# Production: database + API + website on one host, behind Caddy.
#   scripts/deploy.sh           build, start, verify, roll back on failure
# Secrets: deploy/prod.env (compose variables), deploy/api.prod.env (API).
# Only the website is published, and only on 127.0.0.1 — Docker's published
# ports bypass ufw, so anything on 0.0.0.0 would be open to the internet.
name: wolfcar-prod

x-logging: &logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: wolfcar
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in deploy/prod.env}
      POSTGRES_DB: wolfcar
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wolfcar -d wolfcar"]
      interval: 5s
      timeout: 3s
      retries: 20
    restart: unless-stopped
    logging: *logging

  api:
    image: wolfcar-api:latest
    build:
      context: .
      dockerfile: api/Dockerfile
    env_file:
      - path: ./deploy/api.prod.env
        required: true
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://wolfcar:${POSTGRES_PASSWORD}@db:5432/wolfcar
    volumes:
      - uploads:/app/api/storage/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    logging: *logging

  web:
    image: wolfcar-web:latest
    build:
      context: .
      dockerfile: Dockerfile
      args:
        API_INTERNAL_URL: http://api:4000
    environment:
      API_INTERNAL_URL: http://api:4000
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped
    logging: *logging

volumes:
  pgdata:
  uploads:
```

- [ ] **Step 5: `scripts/lib.sh`**

```bash
# Shared helpers for the production scripts. Source it; do not run it.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

dc() {
  docker compose -f "$ROOT/compose.prod.yml" --env-file "$ROOT/deploy/prod.env" "$@"
}

# Exports POSTGRES_PASSWORD and PUBLIC_URL from deploy/prod.env.
load_env() {
  if [[ ! -f "$ROOT/deploy/prod.env" ]]; then
    echo "missing $ROOT/deploy/prod.env — run scripts/make-env.sh first" >&2
    return 1
  fi
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/deploy/prod.env"
  set +a
}

# Waits until every container of the project reports "healthy".
# Returns 1 on timeout or if any container is unhealthy/exited.
wait_healthy() {
  local timeout="${1:-180}" waited=0 ids status bad
  while (( waited < timeout )); do
    ids=$(dc ps -q)
    if [[ -n "$ids" ]]; then
      status=$(docker inspect -f '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $ids)
      bad=$(awk '$2 != "running" || $3 == "unhealthy"' <<<"$status")
      if [[ -n "$bad" ]]; then echo "$bad" >&2; return 1; fi
      if ! grep -qv ' healthy$' <<<"$status"; then return 0; fi
    fi
    sleep 3; waited=$(( waited + 3 ))
  done
  echo "timed out after ${timeout}s waiting for healthy containers:" >&2
  echo "$status" >&2
  return 1
}
```

- [ ] **Step 6: `scripts/make-env.sh`**

```bash
#!/usr/bin/env bash
# Creates deploy/prod.env and deploy/api.prod.env from the templates with fresh
# secrets. Never overwrites an existing file (that would lock everyone out and
# orphan the database password).
#   scripts/make-env.sh [PUBLIC_URL]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_URL_ARG="${1:-}"

make_file() {
  local template="$1" target="$2"
  if [[ -f "$target" ]]; then echo "exists, left alone: $target"; return; fi
  cp "$template" "$target"
  chmod 600 "$target"
  echo "created: $target"
}

make_file "$ROOT/deploy/prod.env.example" "$ROOT/deploy/prod.env"
make_file "$ROOT/deploy/api.prod.env.example" "$ROOT/deploy/api.prod.env"

# Fill placeholders only where they are still present.
sed -i.bak "s|^POSTGRES_PASSWORD=__GENERATED__$|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" "$ROOT/deploy/prod.env"
sed -i.bak "s|^JWT_ACCESS_SECRET=__GENERATED__$|JWT_ACCESS_SECRET=$(openssl rand -hex 48)|" "$ROOT/deploy/api.prod.env"
sed -i.bak "s|^TOTP_ENCRYPTION_KEY=__GENERATED__$|TOTP_ENCRYPTION_KEY=$(openssl rand -base64 32)|" "$ROOT/deploy/api.prod.env"
if [[ -n "$PUBLIC_URL_ARG" ]]; then
  sed -i.bak "s|^PUBLIC_URL=.*$|PUBLIC_URL=$PUBLIC_URL_ARG|" "$ROOT/deploy/prod.env"
fi
rm -f "$ROOT"/deploy/*.env.bak

if grep -q "__GENERATED__" "$ROOT/deploy/prod.env" "$ROOT/deploy/api.prod.env"; then
  echo "a placeholder was not replaced" >&2; exit 1
fi
```

`chmod +x scripts/make-env.sh`

- [ ] **Step 7: Test — env generation is idempotent and secrets are valid**

```bash
scripts/make-env.sh http://127.0.0.1:3000
cp deploy/api.prod.env /tmp/api1 && scripts/make-env.sh && cmp deploy/api.prod.env /tmp/api1 && echo "unchanged on rerun"
grep -E '^TOTP_ENCRYPTION_KEY=[A-Za-z0-9+/]{43}=$' deploy/api.prod.env && echo "totp ok"
grep -E '^JWT_ACCESS_SECRET=.{64,}$' deploy/api.prod.env >/dev/null && echo "jwt ok"
git status --short deploy/   # must list only the two .example files
```
Expected: `unchanged on rerun`, `totp ok`, `jwt ok`; `git status` shows no `*.env`.

- [ ] **Step 8: Test — the stack comes up healthy and only publishes 127.0.0.1:3000**

```bash
source scripts/lib.sh
dc config --quiet && echo "compose valid"
dc up -d --build
wait_healthy 300 && echo "all healthy"
docker ps --filter label=com.docker.compose.project=wolfcar-prod --format '{{.Names}}\t{{.Ports}}'
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/en
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health
```
Expected: `compose valid`, `all healthy`; only the web container shows a port and it is `127.0.0.1:3000->3000/tcp`; both curls `200`. (The database is empty here; the catalog is filled in Task 6's restore test.)

- [ ] **Step 9: Commit**

```bash
chmod +x scripts/make-env.sh
git add compose.prod.yml deploy/*.example scripts/lib.sh scripts/make-env.sh .gitignore
git commit -m "feat(deploy): production compose stack and env templates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Smoke test

**Files:**
- Create: `scripts/smoke.sh`

**Interfaces:**
- Consumes: a base URL.
- Produces: `scripts/smoke.sh <base-url>` → exit 0 if every check passes, 1 otherwise; prints one `PASS`/`FAIL` line per check.

- [ ] **Step 1: Write `scripts/smoke.sh`**

```bash
#!/usr/bin/env bash
# Verifies a running Wolf Car deployment from the outside.
#   scripts/smoke.sh https://wolfcar.qa
# Exit 0 = every check passed. Used by deploy.sh; safe to run any time.
set -uo pipefail
BASE="${1:?usage: scripts/smoke.sh <base-url>}"
BASE="${BASE%/}"
failures=0

# check <label> <path> <expected-status> [content-type-prefix]
check() {
  local label="$1" path="$2" want="$3" ctype="${4:-}" out code type
  out=$(curl -sS -o /dev/null --max-time 20 -w '%{http_code} %{content_type}' "$BASE$path" 2>&1) || true
  code="${out%% *}"; type="${out#* }"
  if [[ "$code" == "$want" && ( -z "$ctype" || "$type" == "$ctype"* ) ]]; then
    echo "PASS  $label ($code)"
  else
    echo "FAIL  $label — expected $want${ctype:+ $ctype}, got: $out"
    failures=$((failures + 1))
  fi
}

check "home (en)"            /en          200 text/html
check "home (ar)"            /ar          200 text/html
check "catalog page"         /en/products 200 text/html
check "login page"           /en/login    200 text/html
check "api health"           /api/health  200 application/json
check "api docs are off"     /api/docs    404

categories=$(curl -sS --max-time 20 "$BASE/api/public/categories" 2>/dev/null || true)
image=$(grep -o '"/api/uploads/[^"]*"' <<<"$categories" | head -1 | tr -d '"')
if [[ -n "$image" ]]; then
  echo "PASS  catalog data (has images)"
  check "uploaded photo" "$image" 200 image/
else
  echo "FAIL  catalog data — no /api/uploads image in /api/public/categories"
  failures=$((failures + 1))
fi

if (( failures > 0 )); then echo "smoke test: $failures check(s) failed"; exit 1; fi
echo "smoke test: all checks passed"
```

`chmod +x scripts/smoke.sh`

- [ ] **Step 2: Run it against the local stack from Task 3 (empty database)**

Run: `scripts/smoke.sh http://127.0.0.1:3000; echo "exit=$?"`
Expected: every page check PASS, then `FAIL  catalog data …` and `exit=1` — the stack has no products yet. This proves the photo check fails when there is nothing to show.

- [ ] **Step 3: Run it with the API stopped**

```bash
source scripts/lib.sh
dc stop api
scripts/smoke.sh http://127.0.0.1:3000; echo "exit=$?"
dc start api && wait_healthy 120
```
Expected: `FAIL  api health …` (500 from the rewrite) and `exit=1`. This is today's outage, caught.

(The all-green run happens in Task 6 after the restore test loads real data.)

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.sh
git commit -m "feat(deploy): smoke test covering pages, API, catalog data and one uploaded photo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Credential rotation script (API)

**Files:**
- Create: `api/src/scripts/rotate-credentials.ts`
- Create: `api/src/scripts/rotate-credentials.spec.ts`
- Create: `api/src/scripts/rotate-credentials.cli.ts`

**Interfaces:**
- Consumes: `generatePassword(length?: number): string` from `api/src/common/crypto.ts`; `PasswordService.hash(password: string): Promise<string>` from `api/src/auth/password.service.ts`; `PrismaClient` from `api/src/generated/prisma/client`; `createPgAdapter(url: string)` from `api/src/prisma/pg-adapter.ts`.
- Produces:
  ```ts
  export interface RotatedCredential {
    username: string;
    displayName: string;
    role: string;
    password: string;
    showroomPassword: string | null;
  }
  export async function rotateCredentials(
    prisma: PrismaClient,
    passwords: Pick<PasswordService, 'hash'>,
    generate?: () => string,
    now?: Date,
  ): Promise<RotatedCredential[]>;
  ```
  Compiled entry point in the API image: `node dist/api/src/scripts/rotate-credentials.cli.js --confirm`.

- [ ] **Step 1: Write the failing tests** — `api/src/scripts/rotate-credentials.spec.ts`

```ts
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '../generated/prisma/client';
import { rotateCredentials } from './rotate-credentials';

describe('rotateCredentials', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  const passwords = { hash: jest.fn(async (p: string) => `hash(${p})`) };
  const now = new Date('2026-09-27T12:00:00Z');
  let n: number;
  const generate = () => `pw-${++n}`;

  beforeEach(() => {
    n = 0;
    prisma = mockDeep<PrismaClient>();
    prisma.$transaction.mockImplementation((async (fn: (tx: PrismaClient) => unknown) => fn(prisma)) as never);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u-1', username: 'admin', displayName: 'Admin', role: 'SUPER_ADMIN', showroomPasswordHash: null },
      { id: 'u-2', username: 'bo.cashier', displayName: 'BO Cashier', role: 'CASHIER', showroomPasswordHash: 'old' },
    ] as never);
    prisma.session.updateMany.mockResolvedValue({ count: 3 });
  });

  it('only rotates users that are not deleted', async () => {
    await rotateCredentials(prisma, passwords, generate, now);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });

  it('gives every user a new dashboard password, and a showroom password only if they had one', async () => {
    const rows = await rotateCredentials(prisma, passwords, generate, now);
    expect(rows).toEqual([
      { username: 'admin', displayName: 'Admin', role: 'SUPER_ADMIN', password: 'pw-1', showroomPassword: null },
      { username: 'bo.cashier', displayName: 'BO Cashier', role: 'CASHIER', password: 'pw-2', showroomPassword: 'pw-3' },
    ]);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' }, data: expect.not.objectContaining({ showroomPasswordHash: expect.anything() }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-2' },
        data: expect.objectContaining({ passwordHash: 'hash(pw-2)', showroomPasswordHash: 'hash(pw-3)' }),
      }),
    );
  });

  it('turns two-factor off, clears lockouts and deletes recovery codes', async () => {
    await rotateCredentials(prisma, passwords, generate, now);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({
          twoFactorEnabled: false,
          twoFactorSecretEnc: null,
          twoFactorPendingSecretEnc: null,
          twoFactorLastStep: null,
          failedLoginCount: 0,
          lockedUntil: null,
          showroomFailedCount: 0,
          showroomLockedUntil: null,
        }),
      }),
    );
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } });
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-2' } });
  });

  it('signs everyone out by revoking every open session', async () => {
    await rotateCredentials(prisma, passwords, generate, now);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { revokedAt: null },
      data: { revokedAt: now, revokeReason: 'credentials_rotated' },
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd api && npx jest src/scripts/rotate-credentials.spec.ts`
Expected: FAIL — `Cannot find module './rotate-credentials'`.

- [ ] **Step 3: Implement** — `api/src/scripts/rotate-credentials.ts`

```ts
import type { PrismaClient } from '../generated/prisma/client';
import type { PasswordService } from '../auth/password.service';
import { generatePassword } from '../common/crypto';

export interface RotatedCredential {
  username: string;
  displayName: string;
  role: string;
  password: string;
  showroomPassword: string | null;
}

/**
 * One-off, for moving a database to a new environment: every active user gets
 * new generated passwords (a showroom one only if they had one), two-factor is
 * turned off (the new environment has a different TOTP key, so the old secrets
 * cannot be decrypted) and every session is revoked. Returns the new
 * passwords, which are shown once and never stored in plain text.
 */
export async function rotateCredentials(
  prisma: PrismaClient,
  passwords: Pick<PasswordService, 'hash'>,
  generate: () => string = () => generatePassword(),
  now: Date = new Date(),
): Promise<RotatedCredential[]> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { username: 'asc' },
    select: { id: true, username: true, displayName: true, role: true, showroomPasswordHash: true },
  });

  const rows: RotatedCredential[] = [];
  for (const user of users) {
    const password = generate();
    const showroomPassword = user.showroomPasswordHash ? generate() : null;
    const passwordHash = await passwords.hash(password);
    const showroomPasswordHash = showroomPassword ? await passwords.hash(showroomPassword) : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(showroomPasswordHash ? { showroomPasswordHash } : {}),
          failedLoginCount: 0,
          lockedUntil: null,
          showroomFailedCount: 0,
          showroomLockedUntil: null,
          twoFactorEnabled: false,
          twoFactorSecretEnc: null,
          twoFactorPendingSecretEnc: null,
          twoFactorLastStep: null,
        },
      });
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
    });

    rows.push({ username: user.username, displayName: user.displayName, role: user.role, password, showroomPassword });
  }

  await prisma.session.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: now, revokeReason: 'credentials_rotated' },
  });

  return rows;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd api && npx jest src/scripts/rotate-credentials.spec.ts`
Expected: 4 passed.

- [ ] **Step 5: CLI entry point** — `api/src/scripts/rotate-credentials.cli.ts`

```ts
/**
 * Rotates every user's credentials after a database is moved to production.
 * Destructive for logins: everyone is signed out and must use the printed
 * passwords. Refuses to run without --confirm.
 *
 *   docker compose -f compose.prod.yml --env-file deploy/prod.env \
 *     exec api node dist/api/src/scripts/rotate-credentials.cli.js --confirm
 */
import 'reflect-metadata';
import { PrismaClient } from '../generated/prisma/client';
import { createPgAdapter } from '../prisma/pg-adapter';
import { PasswordService } from '../auth/password.service';
import { rotateCredentials } from './rotate-credentials';

async function main(): Promise<void> {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without --confirm: this replaces every password and signs everyone out.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: createPgAdapter(url) });
  try {
    const rows = await rotateCredentials(prisma, new PasswordService());
    console.log('\nNew credentials — shown once. Copy them now.\n');
    console.table(
      rows.map((r) => ({
        username: r.username,
        name: r.displayName,
        role: r.role,
        'dashboard password': r.password,
        'showroom password': r.showroomPassword ?? '—',
      })),
    );
    console.log(`${rows.length} user(s) rotated; all sessions revoked; two-factor reset.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Verify the CLI compiles into the image path and refuses without --confirm**

```bash
cd api && npm run build && ls dist/api/src/scripts/rotate-credentials.cli.js
node dist/api/src/scripts/rotate-credentials.cli.js; echo "exit=$?"
npm run lint && npm run typecheck && npm test
```
Expected: the file exists; `Refusing to run without --confirm…` and `exit=1`; lint, typecheck and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add api/src/scripts
git commit -m "feat(api): one-off credential rotation for moving data to production

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Backup, restore and the one-time data move

**Files:**
- Create: `scripts/backup.sh`
- Create: `scripts/restore.sh`
- Create: `scripts/migrate-data.sh`

**Interfaces:**
- Consumes: `scripts/lib.sh`; volume `wolfcar-prod_uploads`; service `db` (user/db `wolfcar`).
- Produces:
  - `scripts/backup.sh [--uploads]` → `$BACKUP_DIR/db-YYYYMMDD-HHMM.dump` (and `uploads-YYYYMMDD.tgz` on Sundays or with `--uploads`); `BACKUP_DIR` defaults to `/var/backups/wolfcar`.
  - `scripts/restore.sh <db.dump> [uploads.tgz]` → replaces the database (and photos), restarts api+web, waits healthy.
  - `scripts/migrate-data.sh [ssh-host]` (runs on the laptop) → dumps local DB + photos, copies them to `/opt/wolfcar/incoming/` on the host, runs `restore.sh` there.

- [ ] **Step 1: `scripts/backup.sh`**

```bash
#!/usr/bin/env bash
# Nightly database dump (kept 14) and weekly photo archive (kept 4).
#   scripts/backup.sh              database; photos too on Sundays
#   scripts/backup.sh --uploads    database and photos now
set -euo pipefail
source "$(dirname "$0")/lib.sh"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wolfcar}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp=$(date +%Y%m%d-%H%M)

db_file="$BACKUP_DIR/db-$stamp.dump"
dc exec -T db pg_dump -U wolfcar -d wolfcar --format=custom > "$db_file.part"
mv "$db_file.part" "$db_file"
echo "database: $db_file ($(du -h "$db_file" | cut -f1))"

if [[ "${1:-}" == "--uploads" || "$(date +%u)" == "7" ]]; then
  up_file="$BACKUP_DIR/uploads-$(date +%Y%m%d).tgz"
  docker run --rm -v wolfcar-prod_uploads:/uploads:ro -v "$BACKUP_DIR":/backup alpine \
    tar czf "/backup/$(basename "$up_file")" -C /uploads .
  echo "photos:   $up_file ($(du -h "$up_file" | cut -f1))"
fi

ls -1t "$BACKUP_DIR"/db-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tgz 2>/dev/null | tail -n +5 | xargs -r rm -f
```

- [ ] **Step 2: `scripts/restore.sh`**

```bash
#!/usr/bin/env bash
# Replaces the production database (and optionally the photos) from a backup.
#   scripts/restore.sh /var/backups/wolfcar/db-20260927-0000.dump [uploads.tgz]
set -euo pipefail
source "$(dirname "$0")/lib.sh"
DUMP="${1:?usage: scripts/restore.sh <db.dump> [uploads.tgz]}"
UPLOADS="${2:-}"
[[ -f "$DUMP" ]] || { echo "no such file: $DUMP" >&2; exit 1; }
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || { echo "no such file: $UPLOADS" >&2; exit 1; }

dc up -d db
dc stop web api
dc exec -T db pg_restore -U wolfcar -d wolfcar --clean --if-exists --no-owner --no-privileges < "$DUMP"

if [[ -n "$UPLOADS" ]]; then
  docker run --rm -i -v wolfcar-prod_uploads:/uploads alpine \
    sh -c 'rm -rf /uploads/* && tar xzf - -C /uploads && chown -R 1000:1000 /uploads' < "$UPLOADS"
fi

dc up -d
wait_healthy 240
echo "restored from $DUMP${UPLOADS:+ and $UPLOADS}"
```

(`node` in `node:22-bookworm-slim` is uid 1000, which owns `/app/api/storage` in the API image.)

- [ ] **Step 3: `scripts/migrate-data.sh`** (laptop → droplet, one time)

```bash
#!/usr/bin/env bash
# One-time: copy the local database and photos to the server and restore them.
# Run on the laptop, from the repo. Afterwards rotate credentials (DEPLOY.md).
#   scripts/migrate-data.sh [ssh-host]      default host: wolfcar
set -euo pipefail
HOST="${1:-wolfcar}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DB="${LOCAL_DATABASE_URL:-postgresql://wolfcar:wolfcar@localhost:5432/wolfcar}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pg_dump --format=custom --no-owner --no-privileges "$LOCAL_DB" > "$tmp/db.dump"
tar czf "$tmp/uploads.tgz" -C "$ROOT/api/storage/uploads" .
echo "local: db $(du -h "$tmp/db.dump" | cut -f1), photos $(du -h "$tmp/uploads.tgz" | cut -f1)"

ssh "$HOST" 'mkdir -p /opt/wolfcar/incoming && chmod 700 /opt/wolfcar/incoming'
scp "$tmp/db.dump" "$tmp/uploads.tgz" "$HOST:/opt/wolfcar/incoming/"
ssh "$HOST" 'cd /opt/wolfcar/app && scripts/restore.sh /opt/wolfcar/incoming/db.dump /opt/wolfcar/incoming/uploads.tgz'
echo "done. Next: rotate credentials (see DEPLOY.md, 'After moving data')."
```

`chmod +x scripts/backup.sh scripts/restore.sh scripts/migrate-data.sh`

- [ ] **Step 4: Test the restore path locally — the local stack from Task 3 receives the laptop's real data**

```bash
pg_dump --format=custom --no-owner --no-privileges postgresql://wolfcar:wolfcar@localhost:5432/wolfcar > /tmp/local.dump
tar czf /tmp/uploads.tgz -C api/storage/uploads .
scripts/restore.sh /tmp/local.dump /tmp/uploads.tgz
source scripts/lib.sh
dc exec -T db psql -U wolfcar -d wolfcar -Atc "select (select count(*) from products), (select count(*) from users)"
psql postgresql://wolfcar:wolfcar@localhost:5432/wolfcar -Atc "select (select count(*) from products), (select count(*) from users)"
scripts/smoke.sh http://127.0.0.1:3000; echo "exit=$?"
```
Expected: both count lines identical (`1225|7` at the time of writing); smoke test all PASS including `uploaded photo`, `exit=0`.

- [ ] **Step 5: Test backup → restore round trip**

```bash
BACKUP_DIR=/tmp/wc-backups scripts/backup.sh --uploads
ls /tmp/wc-backups
dc exec -T db psql -U wolfcar -d wolfcar -c "delete from price_history"
scripts/restore.sh "$(ls -1t /tmp/wc-backups/db-*.dump | head -1)" "$(ls -1t /tmp/wc-backups/uploads-*.tgz | head -1)"
dc exec -T db psql -U wolfcar -d wolfcar -Atc "select count(*) from price_history"
```
Expected: one `db-*.dump` and one `uploads-*.tgz`; after restore the `price_history` count is back to its original value (22 at the time of writing), proving a backup restores.

- [ ] **Step 6: Commit** (leave the local production stack running — Task 7 uses it)

```bash
git add scripts/backup.sh scripts/restore.sh scripts/migrate-data.sh
git commit -m "feat(deploy): backup, restore and one-time data move scripts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Deploy script with automatic rollback

**Files:**
- Create: `scripts/deploy.sh`

**Interfaces:**
- Consumes: `scripts/lib.sh` (`dc`, `load_env`, `wait_healthy`), `scripts/smoke.sh`, `PUBLIC_URL`; the local production stack from Task 3 holding the laptop's data (Task 6 Step 4).
- Produces: `scripts/deploy.sh [--no-pull]`; env `SMOKE` overrides the smoke command (used only by the rollback test); images tagged `wolfcar-{api,web}:previous`.

- [ ] **Step 1: Write `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
# Build, start, verify. If the new version is unhealthy or fails the smoke
# test, the previous images are put back and verified again.
#   scripts/deploy.sh             git pull, then deploy
#   scripts/deploy.sh --no-pull   deploy the working tree as it is
# Database migrations are applied by the API on start and are NOT undone by a
# rollback; they are additive by convention.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
cd "$ROOT"
load_env
SMOKE="${SMOKE:-$ROOT/scripts/smoke.sh}"

[[ "${1:-}" == "--no-pull" ]] || git pull --ff-only

# next build needs ~1.5 GB; warn early instead of dying half-way on a small box
if command -v free >/dev/null; then
  headroom=$(free -m | awk '/^Mem:/{m=$7} /^Swap:/{s=$4} END{print m+s}')
  if (( headroom < 1500 )); then
    echo "WARNING: only ${headroom} MB of memory+swap free; the build may be killed." >&2
  fi
fi

had_previous=0
for svc in api web; do
  if docker image inspect "wolfcar-$svc:latest" >/dev/null 2>&1; then
    docker tag "wolfcar-$svc:latest" "wolfcar-$svc:previous"
    had_previous=1
  fi
done

dc build
dc up -d

if wait_healthy 240 && "$SMOKE" "$PUBLIC_URL"; then
  docker image prune -f >/dev/null
  echo "deployed $(git rev-parse --short HEAD)"
  exit 0
fi

echo "---- new version failed; recent logs ----" >&2
dc logs --tail 100 api web >&2 || true

if (( had_previous == 0 )); then
  echo "no previous version to roll back to" >&2
  exit 1
fi

echo "---- rolling back to the previous images ----" >&2
for svc in api web; do docker tag "wolfcar-$svc:previous" "wolfcar-$svc:latest"; done
dc up -d --no-build
if wait_healthy 240 && "$ROOT/scripts/smoke.sh" "$PUBLIC_URL"; then
  echo "rolled back; the site is on the previous version" >&2
else
  echo "ROLLBACK ALSO FAILED — check 'docker compose -f compose.prod.yml ps' now" >&2
fi
exit 1
```

`chmod +x scripts/deploy.sh`

- [ ] **Step 2: Happy path on the local stack**

Run: `scripts/deploy.sh --no-pull; echo "exit=$?"`
Expected: `deployed <sha>`, `exit=0`; `docker images | grep previous` lists `wolfcar-api:previous` and `wolfcar-web:previous`.

- [ ] **Step 3: Record what "previous" is**

Run: `docker image inspect -f '{{.Id}}' wolfcar-web:latest > /tmp/web-good-id`

- [ ] **Step 4: Rollback path — force the smoke test to fail**

```bash
date > public/.rollback-test   # any change, so the new web image differs from the good one
SMOKE=false scripts/deploy.sh --no-pull; echo "exit=$?"
docker image inspect -f '{{.Id}}' wolfcar-web:latest | cmp - /tmp/web-good-id && echo "back on the good image"
rm -f public/.rollback-test
```
Expected: logs printed, `rolling back to the previous images`, `rolled back; the site is on the previous version`, `exit=1`, and `back on the good image`. The rollback's own smoke test is the real one and passes because the stack holds the laptop's data.

- [ ] **Step 5: Tear down the local production stack** (volumes removed; the secrets were for local testing only)

Run: `source scripts/lib.sh && dc down -v && rm -f deploy/prod.env deploy/api.prod.env && docker image rm wolfcar-api:previous wolfcar-web:previous`

- [ ] **Step 6: Commit and push** (the droplet deploys from GitHub)

```bash
git add scripts/deploy.sh
git commit -m "feat(deploy): deploy script with health wait, smoke test and rollback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 8: Provision the droplet

**Files:**
- Create: `deploy/server-setup.sh`
- Create: `deploy/Caddyfile`

**Interfaces:**
- Consumes: an email address for certificate notices (asked from the user at execution time; it is sent to Let's Encrypt/ZeroSSL only).
- Produces: droplet with Docker + Compose, Caddy serving the sslip.io host, `ufw` on, `fail2ban`, 4 GB swap, unattended security upgrades, repo cloned at `/opt/wolfcar/app`.

- [ ] **Step 1: `deploy/Caddyfile`**

```
# /etc/caddy/Caddyfile — shared by every site on this server.
# Other projects add their own site block below; do not remove ours.
{
	email __ACME_EMAIL__
}

# Wolf Car — temporary address until wolfcar.qa points here.
wolfcar.167-172-106-106.sslip.io {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}

# Wolf Car — enable at the DNS switch (DEPLOY.md, "Launch"):
# wolfcar.qa {
# 	encode zstd gzip
# 	reverse_proxy 127.0.0.1:3000
# }
# www.wolfcar.qa {
# 	redir https://wolfcar.qa{uri} permanent
# }
```

- [ ] **Step 2: `deploy/server-setup.sh`**

```bash
#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 droplet. Safe to re-run.
#   bash server-setup.sh you@example.com
set -euo pipefail
ACME_EMAIL="${1:?usage: server-setup.sh <email for certificate notices>}"
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades \
  debian-keyring debian-archive-keyring apt-transport-https

# swap: next build needs more than 1 GB
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
  sysctl -p /etc/sysctl.d/99-swap.conf
fi

# firewall: SSH + web only (containers publish on 127.0.0.1, see compose.prod.yml)
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

# Docker Engine + Compose plugin (official apt repo)
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# Caddy (official apt repo)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# app checkout
mkdir -p /opt/wolfcar
if [[ ! -d /opt/wolfcar/app/.git ]]; then
  git clone https://github.com/OmarElbasel/Wolf-Car.git /opt/wolfcar/app
fi

# Caddyfile (only if it is still the package default, so another project's blocks survive)
if ! grep -q 'Wolf Car' /etc/caddy/Caddyfile; then
  sed "s/__ACME_EMAIL__/$ACME_EMAIL/" /opt/wolfcar/app/deploy/Caddyfile > /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile
  systemctl reload caddy
fi

# nightly backup at 00:00 UTC (03:00 Qatar)
cat > /etc/cron.d/wolfcar-backup <<'CRON'
0 0 * * * root /opt/wolfcar/app/scripts/backup.sh >> /var/log/wolfcar-backup.log 2>&1
CRON

echo "setup done: $(docker --version), $(caddy version | cut -d' ' -f1), swap $(free -h | awk '/Swap/{print $2}')"
```

- [ ] **Step 3: Commit and push**

```bash
chmod +x deploy/server-setup.sh
git add deploy/server-setup.sh deploy/Caddyfile
git commit -m "feat(deploy): droplet setup script and shared Caddyfile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: Run it on the droplet** (ask the user for the certificate-notice email first)

Run: `scp deploy/server-setup.sh wolfcar:/root/ && ssh wolfcar 'bash /root/server-setup.sh <email>'`
Expected: ends with `setup done: Docker version …, v2.…, swap 4.0Gi`. Takes several minutes (160 pending updates).

- [ ] **Step 5: Reboot if the kernel was upgraded**

Run: `ssh wolfcar '[ -f /var/run/reboot-required ] && reboot || echo no-reboot-needed'`, wait ~1 min, then `ssh wolfcar uptime`.

- [ ] **Step 6: Verify from the laptop — only 22/80/443 answer**

```bash
for p in 22 80 443 3000 4000 5432; do nc -z -G 3 167.172.106.106 $p && echo "$p open" || echo "$p closed"; done
ssh wolfcar 'ufw status verbose | head -12; swapon --show; systemctl is-active caddy fail2ban docker'
```
Expected: 22, 80, 443 open; 3000, 4000, 5432 closed; `ufw` active; swap listed; `active` ×3.

---

### Task 9: First deploy, data move, credential rotation

**Files:** none (operations on the droplet).

**Interfaces:**
- Consumes: everything above.
- Produces: the site live at `https://wolfcar.167-172-106-106.sslip.io` with the laptop's data and new credentials.

- [ ] **Step 1: Create the secrets on the droplet**

Run: `ssh wolfcar 'cd /opt/wolfcar/app && scripts/make-env.sh https://wolfcar.167-172-106-106.sslip.io && ls -l deploy/*.env'`
Expected: two files, mode `-rw-------`.

- [ ] **Step 2: First deploy** (slow on 1 GB: expect 10–25 min for the web build)

Run: `ssh wolfcar 'cd /opt/wolfcar/app && SMOKE=true scripts/deploy.sh --no-pull'`
Expected: `deployed <sha>`. (`SMOKE=true` only this once: the database is still empty, so the catalog check cannot pass yet.)

- [ ] **Step 3: Move the data**

Run (laptop, local Postgres running): `scripts/migrate-data.sh wolfcar`
Expected: ends with `restored from /opt/wolfcar/incoming/db.dump and …uploads.tgz`.

- [ ] **Step 4: Smoke test over real HTTPS**

Run: `scripts/smoke.sh https://wolfcar.167-172-106-106.sslip.io; echo "exit=$?"`
Expected: all PASS, `exit=0`. If the certificate failed (`SSL` errors), check `ssh wolfcar journalctl -u caddy --since "10 min ago" | grep -i -E "error|rate"`; Caddy retries with ZeroSSL on its own.

- [ ] **Step 5: Rotate credentials — the user runs this in their own Terminal** (so the passwords never pass through the agent's logs)

Tell the user to run:
```
ssh wolfcar 'cd /opt/wolfcar/app && docker compose -f compose.prod.yml --env-file deploy/prod.env exec -T api node dist/api/src/scripts/rotate-credentials.cli.js --confirm'
```
Expected (user confirms): a table of 7 users with new passwords and `7 user(s) rotated; all sessions revoked; two-factor reset.` The user saves it in a password manager.

- [ ] **Step 6: Verify old demo passwords no longer work**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://wolfcar.167-172-106-106.sslip.io/api/auth/login \
  -H 'content-type: application/json' -d '{"username":"admin","password":"SuperWolf#2026!"}'
```
Expected: `401` (route `POST /api/auth/login`, body `{ username, password }` — `api/src/auth/auth.controller.ts:46`, `LoginDto`).

- [ ] **Step 7: Verify the API sees real client IPs** (Review Focus 2)

```bash
curl -s -o /dev/null https://wolfcar.167-172-106-106.sslip.io/api/health
echo "my IP: $(curl -s https://api.ipify.org)"
ssh wolfcar 'cd /opt/wolfcar/app && docker compose -f compose.prod.yml --env-file deploy/prod.env logs --tail 20 api | grep -o "\"ip\":\"[^\"]*\"" | tail -3'
```
Expected: the logged `ip` equals "my IP". If it shows `172.x`/`127.0.0.1` instead, stop: all visitors share one rate-limit bucket. Fix by setting `TRUST_PROXY` to trust the Docker network hop and confirm Next's rewrite forwards `X-Forwarded-For`; re-test before launch.

- [ ] **Step 8: Pre-launch checklist with the user** (on `https://wolfcar.167-172-106-106.sslip.io`, laptop and phone)

- [ ] Home in English and Arabic, light and dark: hero animation, every image, catalog cards
- [ ] `/en/products`: photos, search
- [ ] Login as Super Admin with the new password; set up two-factor; log out and in with a code
- [ ] Login as a branch manager and a cashier: dashboards load
- [ ] Create an order, confirm it, print the PDF receipt (Arabic text renders)
- [ ] Showroom login and kiosk
- [ ] Upload a product photo from the dashboard; it appears on the public catalog

- [ ] **Step 9: Backups and monitoring**

```bash
ssh wolfcar '/opt/wolfcar/app/scripts/backup.sh --uploads && ls -lh /var/backups/wolfcar'
```
Expected: a `db-*.dump` and `uploads-*.tgz`. Then ask the CTO to (a) enable DigitalOcean weekly backups, (b) create a DigitalOcean Uptime check on `https://wolfcar.167-172-106-106.sslip.io/api/health` with email alerts (switch it to `https://wolfcar.qa/api/health` at launch).

---

### Task 10: Runbook

**Files:**
- Create: `DEPLOY.md`
- Modify: `README.md` (one line under the deployment/production section linking to `DEPLOY.md`)

**Interfaces:**
- Consumes: every script above.
- Produces: the document the CTO / next developer uses.

- [ ] **Step 1: Write `DEPLOY.md`** with these sections, each with the exact commands from Tasks 3–9:
  1. **What runs where** — the architecture diagram from the spec, the three containers, Caddy, `/opt/wolfcar/app`, `deploy/*.env` (git-ignored, back them up somewhere safe — losing `api.prod.env` resets every two-factor and signs everyone out; losing `prod.env` loses the DB password).
  2. **Server from zero** — `deploy/server-setup.sh <email>`, `scripts/make-env.sh <PUBLIC_URL>`, first deploy.
  3. **Deploy** — `ssh wolfcar`, `cd /opt/wolfcar/app && scripts/deploy.sh`; what rollback output looks like; that migrations are not rolled back.
  4. **After moving data** — the rotate-credentials command (from Task 9 Step 5).
  5. **Backups and restore** — where they are, `scripts/restore.sh <dump> [tgz]`, copying a backup to the laptop with `scp`.
  6. **Logs and status** — `docker compose -f compose.prod.yml --env-file deploy/prod.env ps|logs -f api`, `journalctl -u caddy`.
  7. **Adding another project** — its own site block in `/etc/caddy/Caddyfile`, its own localhost port (not 3000), `systemctl reload caddy`.
  8. **Launch (DNS switch)** — the Task 11 steps, with the "do not touch MX/TXT" warning and the rollback (`A` back to `75.2.60.5`).

- [ ] **Step 2: Link it from `README.md`** — add under the production/deployment heading: `Production deployment on the DigitalOcean droplet: see [DEPLOY.md](DEPLOY.md).`

- [ ] **Step 3: Commit and push**

```bash
git add DEPLOY.md README.md
git commit -m "docs: production runbook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 11: Launch — switch wolfcar.qa (blocked until someone has the Ooredoo DNS login)

**Files:**
- Modify (on the droplet only): `/etc/caddy/Caddyfile`, `/opt/wolfcar/app/deploy/prod.env`, `/opt/wolfcar/app/deploy/api.prod.env`

- [ ] **Step 1: Day before** — in the Ooredoo panel, lower the TTL of the `wolfcar.qa` A record and `www` CNAME to 300 if allowed. Screenshot the whole record list first (the "before" state, for rollback).

- [ ] **Step 2: Switch** — in the Ooredoo panel:
  - `wolfcar.qa` A: `75.2.60.5` → `167.172.106.106`
  - `www.wolfcar.qa` CNAME: `golden-tapioca-ef5b4b.netlify.app` → `wolfcar.qa`
  - MX, TXT and everything else: unchanged.

- [ ] **Step 3: Confirm DNS from the laptop**

Run: `dig +short wolfcar.qa @dns1.qatar.net.qa; dig +short www.wolfcar.qa @dns1.qatar.net.qa; dig +short MX wolfcar.qa @dns1.qatar.net.qa`
Expected: `167.172.106.106`; `wolfcar.qa.` then `167.172.106.106`; MX still `wolfcar-qa.mail.protection.outlook.com.`

- [ ] **Step 4: Enable the domain in Caddy** — on the droplet, in `/etc/caddy/Caddyfile` uncomment the `wolfcar.qa` and `www.wolfcar.qa` blocks, then `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`. Wait ~1 minute, then `curl -sI https://wolfcar.qa | head -3` → `HTTP/2 200` and `curl -sI https://www.wolfcar.qa | grep -i location` → `https://wolfcar.qa/`.

- [ ] **Step 5: Switch the app's own URLs** — on the droplet:
  - `deploy/prod.env`: `PUBLIC_URL=https://wolfcar.qa`
  - `deploy/api.prod.env`: `CORS_ORIGINS=https://wolfcar.qa,https://www.wolfcar.qa`
  - then `scripts/deploy.sh --no-pull` → `deployed <sha>` (smoke test now runs against `https://wolfcar.qa`).

- [ ] **Step 6: Remove the temporary address** — delete the sslip.io block from `/etc/caddy/Caddyfile`, `systemctl reload caddy`; update the DigitalOcean Uptime check URL to `https://wolfcar.qa/api/health`.

- [ ] **Step 7: Email still works** — send a test email to a `@wolfcar.qa` address from outside; it arrives.

- [ ] **Step 8: After a week** — remove `wolfcar.qa` from the Netlify site and delete Netlify's unused DNS zone for it. Rollback until then: A record back to `75.2.60.5`.
