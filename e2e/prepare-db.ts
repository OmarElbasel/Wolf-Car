import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { apiEnv } from "./env";

/**
 * Fresh demo data for every run: apply migrations (non-destructive) and run the
 * seed against the dedicated e2e database (the seed empties it first).
 *
 * Runs as the first half of the API's webServer command, because Playwright
 * starts web servers before globalSetup and the API needs its tables at boot.
 */
const cwd = path.join(__dirname, "..", "api");
const env = { ...apiEnv(), NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv;
rmSync(path.join(cwd, "storage", "e2e-uploads"), { recursive: true, force: true });
execSync("npx prisma migrate deploy", { cwd, env, stdio: "pipe" });
execSync("npx tsx prisma/seed.ts", { cwd, env: { ...env, UPLOAD_DIR: "./storage/e2e-uploads" }, stdio: "pipe" });
