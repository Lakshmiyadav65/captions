#!/bin/sh
# Railway / Docker web entrypoint: ensure Postgres Prisma client + migrations, then serve.
set -e
node scripts/use-postgres.mjs
npx prisma migrate deploy
exec npm run start
