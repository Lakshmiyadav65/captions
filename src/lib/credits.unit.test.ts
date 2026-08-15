import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CREDIT_PACKS,
  allocationForEmail,
  isCreditPackId,
  minutesFromDurationSec,
  prepaidMinutesNeeded,
} from "./credits-catalog";

describe("prepaid packs", () => {
  it("accepts only catalog pack ids from the client", () => {
    assert.equal(isCreditPackId("minutes_5"), true);
    assert.equal(isCreditPackId("minutes_10"), true);
    assert.equal(isCreditPackId("minutes_20"), false);
    assert.equal(isCreditPackId(10), false);
    assert.equal(CREDIT_PACKS.minutes_5.minutes, 5);
    assert.equal(CREDIT_PACKS.minutes_10.minutes, 10);
  });
});

describe("minutesFromDurationSec", () => {
  it("rounds 2.5 minutes from 150 seconds", () => {
    assert.equal(minutesFromDurationSec(150), 2.5);
  });
  it("returns 0 for empty duration", () => {
    assert.equal(minutesFromDurationSec(0), 0);
    assert.equal(minutesFromDurationSec(-4), 0);
  });
});

describe("allocationForEmail", () => {
  const settings = {
    testUserEmail: "friend@example.com",
    testMinutes: 5,
    normalMinutes: 120,
  };

  it("gives the designated test user 5 minutes", () => {
    assert.equal(allocationForEmail("friend@example.com", settings), 5);
  });

  it("gives every other user 120 minutes", () => {
    assert.equal(allocationForEmail("creator@example.com", settings), 120);
    assert.equal(allocationForEmail(undefined, settings), 120);
  });

  it("ignores a client-chosen minutes value because none is accepted", () => {
    assert.equal(allocationForEmail("creator@example.com", settings), settings.normalMinutes);
    assert.notEqual(allocationForEmail("creator@example.com", settings), 999999);
  });
});

describe("prepaidMinutesNeeded", () => {
  it("uses monthly quota first", () => {
    assert.equal(prepaidMinutesNeeded(10, 0, 2.5), 0);
  });
  it("charges overflow to prepaid", () => {
    assert.equal(prepaidMinutesNeeded(10, 9, 2.5), 1.5);
  });
  it("charges the full clip when monthly is exhausted", () => {
    assert.equal(prepaidMinutesNeeded(10, 10, 2.5), 2.5);
  });
  it("never returns a negative need", () => {
    assert.equal(prepaidMinutesNeeded(10, 0, 0), 0);
    assert.equal(prepaidMinutesNeeded(5, 20, 1), 1);
  });
});
