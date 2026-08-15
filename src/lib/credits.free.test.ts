import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "./db";
import { config } from "./config";
import { PLANS } from "./plans";
import {
  InsufficientCreditsError,
  getAvailableMinutes,
  grantFreeMinutesOnce,
  listTransactions,
  minutesFromDurationSec,
  reserveJobCredits,
  useMinutes,
} from "./credits";
import { handleGetBalance, handleUseMinutes } from "./credits-api";
import { assertWithinQuota, getUserLimits } from "./quota";
import { round1 } from "./credits-catalog";

const FREE = config.limits.freeCaptionMinutes;
const ids: string[] = [];

async function makeUser(plan: "free" | "creator" | "pro" = "free") {
  const user = await prisma.user.create({
    data: {
      email: `free-min-test-${crypto.randomUUID()}@t.local`,
      plan,
    },
  });
  ids.push(user.id);
  return user;
}

async function makeJob(userId: string, durationSec: number) {
  return prisma.job.create({
    data: {
      userId,
      status: "queued",
      durationSec,
    },
  });
}

after(async () => {
  if (ids.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});

describe("TEST 1 — New User Free Allocation", () => {
  it("allocates configured free minutes exactly once", async () => {
    const user = await makeUser();
    const balance = await getAvailableMinutes(user.id);
    assert.equal(balance, FREE);
    assert.equal(typeof balance, "number");
    assert.ok(balance >= 0);
  });
});

describe("TEST 2 — No Duplicate Free Allocation", () => {
  it("does not add minutes again on repeated init/balance calls", async () => {
    const user = await makeUser();
    const first = await getAvailableMinutes(user.id);
    const again = await Promise.all([
      getAvailableMinutes(user.id),
      grantFreeMinutesOnce(user.id),
      getAvailableMinutes(user.id),
      handleGetBalance(user.id).then((r) => r.body.available_minutes),
      handleGetBalance(user.id).then((r) => r.body.available_minutes),
    ]);
    for (const n of again) {
      assert.equal(n, first);
    }
    const grants = (await listTransactions(user.id)).filter((t) => t.type === "GRANT");
    assert.equal(grants.length, 1);
    assert.equal(grants[0]!.minutes, FREE);
  });
});

describe("TEST 3 — Balance API", () => {
  it("returns the authenticated user's numeric balance", async () => {
    const user = await makeUser();
    const res = await handleGetBalance(user.id);
    assert.equal(res.status, 200);
    if (!("available_minutes" in res.body)) throw new Error("expected balance");
    assert.equal(res.body.available_minutes, FREE);
    assert.equal(typeof res.body.available_minutes, "number");
    const row = await prisma.creditBalance.findUnique({ where: { userId: user.id } });
    assert.equal(row?.availableMinutes, res.body.available_minutes);
  });
});

describe("TEST 4 — Unauthenticated Balance Request", () => {
  it("rejects a balance request with no user", async () => {
    const res = await handleGetBalance(null);
    assert.equal(res.status, 401);
    assert.equal("available_minutes" in res.body, false);
  });
});

describe("TEST 5 — Successful Caption Usage", () => {
  it("deducts server-side duration from the wallet", async () => {
    const user = await makeUser();
    await getAvailableMinutes(user.id);
    const job = await makeJob(user.id, 180);
    const videoMinutes = minutesFromDurationSec(180);
    const result = await reserveJobCredits({
      userId: user.id,
      jobId: job.id,
      videoMinutes,
      monthlyMinutes: 0,
      usedMinutes: 0,
    });
    assert.equal(result.reserved, videoMinutes);
    const after = await getAvailableMinutes(user.id);
    assert.equal(after, round1(FREE - videoMinutes));
    const usage = (await listTransactions(user.id)).find((t) => t.type === "USAGE");
    assert.ok(usage);
    assert.equal(usage!.videoId, job.id);
    assert.equal(usage!.minutes, -videoMinutes);
    assert.equal(usage!.balanceBefore, FREE);
    assert.equal(usage!.balanceAfter, after);
    assert.ok(usage!.createdAt);
  });
});

describe("TEST 6 — Insufficient Balance", () => {
  it("rejects processing and leaves the balance unchanged", async () => {
    const user = await makeUser();
    await getAvailableMinutes(user.id);
    await useMinutes({ userId: user.id, minutes: round1(FREE - 2) });
    const before = await getAvailableMinutes(user.id);
    assert.equal(before, 2);
    const job = await makeJob(user.id, 300);
    await assert.rejects(
      () =>
        reserveJobCredits({
          userId: user.id,
          jobId: job.id,
          videoMinutes: 5,
          monthlyMinutes: 0,
          usedMinutes: 0,
        }),
      (err: unknown) => {
        assert.ok(err instanceof InsufficientCreditsError);
        assert.match(err.message, /enough caption minutes/);
        return true;
      },
    );
    assert.equal(await getAvailableMinutes(user.id), 2);
  });
});

describe("TEST 7 — Zero Usage Protection", () => {
  it("rejects minutes = 0 and does not change the balance", async () => {
    const user = await makeUser();
    const before = await getAvailableMinutes(user.id);
    const res = await handleUseMinutes(user.id, { minutes: 0 });
    assert.equal(res.status, 400);
    await assert.rejects(() => useMinutes({ userId: user.id, minutes: 0 }));
    assert.equal(await getAvailableMinutes(user.id), before);
  });
});

describe("TEST 8 — Negative Usage Protection", () => {
  it("rejects negative minutes and cannot increase the balance", async () => {
    const user = await makeUser();
    const before = await getAvailableMinutes(user.id);
    const res = await handleUseMinutes(user.id, { minutes: -100 });
    assert.equal(res.status, 400);
    await assert.rejects(() => useMinutes({ userId: user.id, minutes: -1 }));
    assert.equal(await getAvailableMinutes(user.id), before);
  });
});

describe("TEST 9 — Client Balance Manipulation", () => {
  it("ignores client-supplied available_minutes and user_id", async () => {
    const user = await makeUser();
    const before = await getAvailableMinutes(user.id);
    const res = await handleUseMinutes(user.id, {
      available_minutes: 999999,
      user_id: "another-user",
      minutes: 999999,
    });
    assert.notEqual(res.status, 200);
    const balance = await handleGetBalance(user.id);
    if (!("available_minutes" in balance.body)) throw new Error("expected balance");
    assert.equal(balance.body.available_minutes, before);
  });
});

describe("TEST 10 — Client Usage Manipulation", () => {
  it("charges actual video duration, not the client-claimed minutes", async () => {
    const user = await makeUser();
    await getAvailableMinutes(user.id);
    const job = await makeJob(user.id, 300);
    const res = await handleUseMinutes(user.id, {
      video_id: job.id,
      minutes: 0.1,
    });
    assert.equal(res.status, 200);
    if (!("available_minutes" in res.body)) throw new Error("expected balance");
    const charged = minutesFromDurationSec(300);
    assert.equal(charged, 5);
    assert.equal(res.body.available_minutes, round1(FREE - charged));
  });
});

describe("TEST 11 — User Isolation", () => {
  it("prevents user B from viewing or spending user A's minutes", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await getAvailableMinutes(a.id);
    const job = await makeJob(a.id, 60);
    const peek = await handleGetBalance(b.id);
    if (!("available_minutes" in peek.body)) throw new Error("expected balance");
    assert.equal(peek.body.available_minutes, FREE);
    const steal = await handleUseMinutes(b.id, { video_id: job.id, minutes: 1 });
    assert.equal(steal.status, 404);
    assert.equal(await getAvailableMinutes(a.id), FREE);
    assert.equal(await getAvailableMinutes(b.id), FREE);
  });
});

describe("TEST 12 — Persistence", () => {
  it("keeps the same balance after a simulated logout/login", async () => {
    const user = await makeUser();
    await getAvailableMinutes(user.id);
    await useMinutes({ userId: user.id, minutes: 3 });
    const beforeLogout = await getAvailableMinutes(user.id);
    assert.equal(beforeLogout, round1(FREE - 3));
    const afterLogin = await getAvailableMinutes(user.id);
    assert.equal(afterLogin, beforeLogout);
  });
});

describe("TEST 13 — Concurrent Requests", () => {
  it("never lets two jobs spend more than the remaining balance", async () => {
    const user = await makeUser();
    await getAvailableMinutes(user.id);
    await useMinutes({ userId: user.id, minutes: round1(FREE - 5) });
    assert.equal(await getAvailableMinutes(user.id), 5);
    const jobA = await makeJob(user.id, 240);
    const jobB = await makeJob(user.id, 240);
    const results = await Promise.allSettled([
      reserveJobCredits({
        userId: user.id,
        jobId: jobA.id,
        videoMinutes: 4,
        monthlyMinutes: 0,
        usedMinutes: 0,
      }),
      reserveJobCredits({
        userId: user.id,
        jobId: jobB.id,
        videoMinutes: 4,
        monthlyMinutes: 0,
        usedMinutes: 0,
      }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(fail.length, 1);
    const rejected = fail[0] as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof InsufficientCreditsError);
    const final = await getAvailableMinutes(user.id);
    assert.equal(final, 1);
    assert.ok(final >= 0);
  });
});

describe("TEST 14 — Balance / ledger integrity", () => {
  it("matches GRANT minus USAGE to the stored balance", async () => {
    const user = await makeUser();
    await getAvailableMinutes(user.id);
    await useMinutes({ userId: user.id, minutes: 3, videoId: "job-integrity" });
    const balance = await getAvailableMinutes(user.id);
    const txns = await listTransactions(user.id, 100);
    const ledger = round1(txns.reduce((sum, t) => sum + t.minutes, 0));
    assert.equal(balance, ledger);
    assert.equal(balance, round1(FREE - 3));
  });
});

describe("TEST 15 — Existing feature regression", () => {
  it("keeps subscription plan limits and paid quota independent of the free wallet", async () => {
    assert.equal(PLANS.creator.monthlyMinutes, 600);
    assert.equal(PLANS.pro.monthlyMinutes, 3000);
    assert.equal(PLANS.free.id, "free");
    const creator = await makeUser("creator");
    const limits = await getUserLimits(creator.id);
    assert.equal(limits.planId, "creator");
    assert.equal(limits.monthlyMinutes, 600);
    const quota = await assertWithinQuota(creator.id);
    assert.equal(quota.ok, true);
    assert.equal(config.outputMode === "translit" || config.outputMode === "transcribe", true);
  });
});
