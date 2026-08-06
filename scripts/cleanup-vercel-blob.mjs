#!/usr/bin/env node
/**
 * Free Vercel Blob Hobby quota by deleting old blobs.
 *
 * Usage:
 *   node scripts/cleanup-vercel-blob.mjs --dry-run
 *   node scripts/cleanup-vercel-blob.mjs --keep-days=3
 *   node scripts/cleanup-vercel-blob.mjs --keep-newest=20
 *   node scripts/cleanup-vercel-blob.mjs --all-exports
 *
 * Requires BLOB_READ_WRITE_TOKEN in the environment.
 */
import { list, del } from "@vercel/blob";

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const dryRun = hasFlag("dry-run");
const keepDays = Number(arg("keep-days", "2"));
const keepNewest = Number(arg("keep-newest", "30"));
const allExports = hasFlag("all-exports");
const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;

async function listAll() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ token, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

function sizeMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

const blobs = await listAll();
blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

const totalBytes = blobs.reduce((n, b) => n + (b.size || 0), 0);
console.log(`Found ${blobs.length} blobs (~${sizeMb(totalBytes)} MB)`);

const keep = new Set(blobs.slice(0, Math.max(0, keepNewest)).map((b) => b.url));
const toDelete = [];

for (const b of blobs) {
  const ageOk = new Date(b.uploadedAt).getTime() < cutoff;
  const isExport = /\/exports\//i.test(b.pathname) || /captioned/i.test(b.pathname);
  const isUpload =
    /\/uploads?\//i.test(b.pathname) ||
    /\.(mp4|mov|webm|mkv|m4v)$/i.test(b.pathname);

  if (keep.has(b.url) && !allExports) continue;

  if (allExports && isExport) {
    toDelete.push(b);
    continue;
  }

  if ((isUpload || isExport) && ageOk) {
    toDelete.push(b);
  }
}

const deleteBytes = toDelete.reduce((n, b) => n + (b.size || 0), 0);
console.log(
  `${dryRun ? "Would delete" : "Deleting"} ${toDelete.length} blobs (~${sizeMb(deleteBytes)} MB)`,
);

if (!toDelete.length) {
  console.log("Nothing to delete. Try --keep-days=1 or --keep-newest=10 or --all-exports");
  process.exit(0);
}

for (const b of toDelete.slice(0, 40)) {
  console.log(` - ${sizeMb(b.size || 0)} MB  ${b.uploadedAt}  ${b.pathname}`);
}
if (toDelete.length > 40) console.log(` ... and ${toDelete.length - 40} more`);

if (dryRun) process.exit(0);

// Delete in batches of URLs
const urls = toDelete.map((b) => b.url);
const batchSize = 100;
let deleted = 0;
for (let i = 0; i < urls.length; i += batchSize) {
  const batch = urls.slice(i, i + batchSize);
  await del(batch, { token });
  deleted += batch.length;
  console.log(`Deleted ${deleted}/${urls.length}`);
}

console.log("Done. Re-check uploads on production.");
