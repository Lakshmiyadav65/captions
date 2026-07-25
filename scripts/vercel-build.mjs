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

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (/^postgres(ql)?:\/\//i.test(dbUrl)) {
  let schema = readFileSync(schemaPath, "utf8");
  if (schema.includes('provider = "sqlite"')) {
    schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
    writeFileSync(schemaPath, schema);
    console.log("✓ Prisma datasource → postgresql (DATABASE_URL is Postgres)");
  }
} else if (process.env.VERCEL) {
  console.warn(
    "⚠ Vercel build without a Postgres DATABASE_URL. " +
      "Set DATABASE_URL to a Postgres connection string (Neon / Vercel Postgres / Supabase). " +
      "SQLite will not work on serverless.",
  );
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
