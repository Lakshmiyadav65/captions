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
};

export default nextConfig;
