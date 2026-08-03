import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship native/binary assets we spawn or load at runtime — keep them out of
  // the server bundle so Next doesn't try to trace/bundle the ffmpeg binary or Prisma engine.
  serverExternalPackages: [
    "ffmpeg-static",
    "@prisma/client",
    "prisma",
    "bullmq",
    "ioredis",
  ],
  // NFT often misses the ffmpeg binary and TTF burn fonts — without these, Export video
  // fails on Vercel with ENOENT while local/dev works.
  outputFileTracingIncludes: {
    "/api/export/[id]": [
      "./assets/fonts/**/*",
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/upload/complete": ["./node_modules/ffmpeg-static/**/*"],
    "/api/jobs/[id]/retry": [
      "./assets/fonts/**/*",
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/analyze-style": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
