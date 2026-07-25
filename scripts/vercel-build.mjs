// Prepares a Vercel (or any serverless) production build:
// 1. If DATABASE_URL is Postgres, switch Prisma datasource off sqlite
// 2. Generate the Prisma client
// 3. Run next build
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "prisma", "schema.prisma");
const dbUrl = process.env.DATABASE_URL ?? "";
const isPostgresUrl = /^postgres(ql)?:\/\//i.test(dbUrl);
// Vercel is always Postgres: SQLite file DBs are not writable/persistent on serverless.
// Switch even if DATABASE_URL is missing at build time so the generated client matches runtime.
const usePostgres = isPostgresUrl || Boolean(process.env.VERCEL);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (usePostgres) {
  let schema = readFileSync(schemaPath, "utf8");
  if (schema.includes('provider = "sqlite"')) {
    schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
    writeFileSync(schemaPath, schema);
    console.log(
      isPostgresUrl
        ? "✓ Prisma datasource → postgresql (DATABASE_URL is Postgres)"
        : "✓ Prisma datasource → postgresql (Vercel build; set DATABASE_URL to a Postgres URL)",
    );
  }
  if (!isPostgresUrl) {
    console.warn(
      "⚠ DATABASE_URL is missing or not Postgres. Upload/API will 500 until you set " +
        "a postgresql:// URL (Neon / Vercel Postgres / Supabase) for Production + Build, " +
        "then run: npx prisma db push",
    );
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
