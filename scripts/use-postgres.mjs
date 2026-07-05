// Switches the Prisma datasource from sqlite (local default) to postgresql for
// production builds/deploys. Idempotent. Run before `prisma generate` / `db push`:
//   node scripts/use-postgres.mjs
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../prisma/schema.prisma", import.meta.url);
let schema = readFileSync(path, "utf8");

if (schema.includes('provider = "sqlite"')) {
  schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
  writeFileSync(path, schema);
  console.log("✓ Prisma datasource switched to postgresql");
} else {
  console.log("• Prisma datasource is already non-sqlite; no change");
}
