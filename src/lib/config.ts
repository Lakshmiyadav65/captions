import { z } from "zod";

// Central, validated configuration. Everything Phase 2 keys off these flags so the app
// runs locally on zero infra (sqlite + inline queue + local disk) and switches to
// production infra (Postgres + Redis/BullMQ + S3/R2 + OAuth) purely via environment.

const boolish = (def: "true" | "false") =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def === "true" : v === "true" || v === "1"));

const schema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),

  // Transcription (Phase 1)
  ASR_PROVIDER: z.string().default("auto"),
  ASR_LANGUAGE: z.string().default("te"),
  // Target chunk length (seconds) for long audio. Smaller = tighter subtitle timing but more
  // API calls / boundary cuts. Clamped to the provider's per-request cap at runtime.
  ASR_CHUNK_SECONDS: z.coerce.number().default(12),
  // Subtitle output: transcribe = Telugu script; translit = romanized (Telugu in Latin letters)
  OUTPUT_MODE: z.enum(["transcribe", "translit"]).default("translit"),
  // Max words per on-screen caption frame; long lines are split into clean short frames. 0 = off.
  SUBTITLE_MAX_WORDS: z.coerce.number().default(2),

  // Storage
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().optional(), // set for Cloudflare R2 / MinIO
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(), // optional CDN/public base for GETs

  // Job queue
  QUEUE_DRIVER: z.enum(["inline", "bullmq"]).default("inline"),
  REDIS_URL: z.string().optional(),

  // Auth
  AUTH_ENABLED: boolish("false"),
  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  // Dev-only email sign-in (no password) so multi-user flows are testable without OAuth apps.
  AUTH_DEV_LOGIN: boolish("true"),

  // Guardrails / quotas
  MAX_UPLOAD_MB: z.coerce.number().default(500),
  MAX_VIDEO_MINUTES: z.coerce.number().default(30),
  QUOTA_MONTHLY_MINUTES: z.coerce.number().default(120),
  QUOTA_MAX_ACTIVE_JOBS: z.coerce.number().default(3),

  // Caption Style Analyzer (vision). ANTHROPIC_API_KEY is read directly from process.env
  // in the provider (like SARVAM_API_KEY), never here / never handed to the browser.
  VISION_PROVIDER: z.string().default("auto"), // auto | anthropic | mock
  VISION_MODEL: z.string().default("claude-sonnet-5"),
  CAPTION_PROVIDER: z.string().default("auto"), // auto | claude | mock
  GENERATE_MODEL: z.string().default("claude-haiku-4-5"),
  OCR_ENABLED: boolish("false"), // a second paid vision call — off by default
  MAX_IMAGE_MB: z.coerce.number().default(10),
  QUOTA_MONTHLY_ANALYSES: z.coerce.number().default(50),
  QUOTA_MONTHLY_GENERATIONS: z.coerce.number().default(100),
  STYLE_MATCH_THRESHOLD: z.coerce.number().default(0.9),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast on misconfiguration (especially in production).
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export const config = {
  outputMode: env.OUTPUT_MODE,
  chunkSeconds: env.ASR_CHUNK_SECONDS,
  maxWordsPerLine: env.SUBTITLE_MAX_WORDS,
  storageDriver: env.STORAGE_DRIVER,
  usesS3: env.STORAGE_DRIVER === "s3",
  queueDriver: env.QUEUE_DRIVER,
  usesBull: env.QUEUE_DRIVER === "bullmq",
  authEnabled: env.AUTH_ENABLED,
  googleAuth: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
  githubAuth: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
  devLogin: env.AUTH_DEV_LOGIN,
  visionModel: env.VISION_MODEL,
  generateModel: env.GENERATE_MODEL,
  limits: {
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    maxUploadMB: env.MAX_UPLOAD_MB,
    maxVideoSeconds: env.MAX_VIDEO_MINUTES * 60,
    maxVideoMinutes: env.MAX_VIDEO_MINUTES,
    monthlyMinutes: env.QUOTA_MONTHLY_MINUTES,
    maxActiveJobs: env.QUOTA_MAX_ACTIVE_JOBS,
    maxImageBytes: env.MAX_IMAGE_MB * 1024 * 1024,
    maxImageMB: env.MAX_IMAGE_MB,
    monthlyAnalyses: env.QUOTA_MONTHLY_ANALYSES,
    monthlyGenerations: env.QUOTA_MONTHLY_GENERATIONS,
    styleMatchThreshold: env.STYLE_MATCH_THRESHOLD,
    ocrEnabled: env.OCR_ENABLED,
  },
} as const;

/** Non-secret subset safe to hand to the browser. */
export function publicConfig() {
  return {
    authEnabled: config.authEnabled,
    googleAuth: config.googleAuth,
    githubAuth: config.githubAuth,
    devLogin: config.devLogin,
    maxUploadMB: config.limits.maxUploadMB,
    maxVideoMinutes: config.limits.maxVideoMinutes,
    maxImageMB: config.limits.maxImageMB,
    monthlyAnalyses: config.limits.monthlyAnalyses,
  };
}

export type PublicConfig = ReturnType<typeof publicConfig>;
