# Single image that runs either the web app (`npm run start`) or the transcription
# worker (`npm run worker`). Uses Postgres + full node_modules (worker needs tsx + libs).
# syntax=docker/dockerfile:1

FROM node:22-slim AS base
WORKDIR /app
# openssl is required by the Prisma engine; ca-certificates for outbound HTTPS (ASR APIs).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# ---- dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- build ----
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Target Postgres, generate the client, and build the app.
RUN node scripts/use-postgres.mjs \
  && npx prisma generate \
  && npm run build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
# Default command runs the web server; Railway/worker override the start command.
# Railway web start: node scripts/use-postgres.mjs && npx prisma migrate deploy && npm run start
CMD ["npm", "run", "start"]
