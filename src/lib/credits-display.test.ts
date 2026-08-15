import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DASHBOARD_PATH,
  INSUFFICIENT_MINUTES_MESSAGE,
  dashboardSignInHref,
  formatAvailableMinutes,
} from "./credits-display";

describe("Sign in", () => {
  it("sends signed-out users to sign-in with the dashboard as next", () => {
    assert.equal(dashboardSignInHref(), "/signin?next=%2Flibrary");
    assert.match(dashboardSignInHref(), /^\/signin\?next=/);
  });
});

describe("Dashboard access", () => {
  it("uses /library as the authenticated dashboard", () => {
    assert.equal(DASHBOARD_PATH, "/library");
    const page = readFileSync(join(process.cwd(), "src/app/library/page.tsx"), "utf8");
    assert.match(page, /requireUserId/);
    assert.match(page, /signin\?next=/);
  });
});

describe("Free balance display", () => {
  it("formats the real backend minutes, not a hardcoded 120", () => {
    assert.equal(formatAvailableMinutes(120), "120 min available");
    assert.equal(formatAvailableMinutes(5), "5 min available");
    assert.equal(formatAvailableMinutes(3), "3 min available");
    assert.notEqual(formatAvailableMinutes(5), "120 min available");
  });
});

describe("Test user display", () => {
  it("shows exactly 5 minutes when the backend returns 5", () => {
    assert.equal(formatAvailableMinutes(5), "5 min available");
  });
});

describe("Normal user display", () => {
  it("shows 120 minutes when the backend returns 120", () => {
    assert.equal(formatAvailableMinutes(120), "120 min available");
  });
});

describe("Video upload", () => {
  it("upload UI surfaces the backend error and does not offer a purchase CTA", () => {
    const src = readFileSync(join(process.cwd(), "src/components/Uploader.tsx"), "utf8");
    assert.match(src, /body\.error/);
    assert.equal(/Buy More Minutes/.test(src), false);
    assert.equal(/\/api\/credits\/purchase/.test(src), false);
  });
});

describe("Caption processing", () => {
  it("processing failure copy uses the backend insufficient-minutes message", () => {
    assert.equal(
      INSUFFICIENT_MINUTES_MESSAGE,
      "You don't have enough caption minutes for this video.",
    );
    const src = readFileSync(join(process.cwd(), "src/components/ProcessingView.tsx"), "utf8");
    assert.match(src, /caption minutes/i);
    assert.equal(/Buy More Minutes/.test(src), false);
  });
});

describe("Balance update", () => {
  it("editor notifies the dashboard after processing so the badge can refresh", () => {
    const src = readFileSync(join(process.cwd(), "src/components/Editor.tsx"), "utf8");
    assert.match(src, /notifyCreditsChanged/);
    const shell = readFileSync(join(process.cwd(), "src/components/console/AppShell.tsx"), "utf8");
    assert.match(shell, /CREDITS_CHANGED_EVENT/);
    assert.match(shell, /\/api\/billing\/usage/);
  });
});

describe("Insufficient balance UI", () => {
  it("shows a non-payment error and does not include a purchase button", () => {
    assert.match(INSUFFICIENT_MINUTES_MESSAGE, /enough caption minutes/);
    assert.equal(/buy|purchase|checkout|stripe|razorpay/i.test(INSUFFICIENT_MINUTES_MESSAGE), false);
    const settings = readFileSync(
      join(process.cwd(), "src/components/console/SettingsClient.tsx"),
      "utf8",
    );
    assert.equal(/Buy More Minutes/.test(settings), false);
    assert.equal(/\/api\/credits\/purchase/.test(settings), false);
  });
});

describe("Mobile layout", () => {
  it("dashboard CSS includes a compact mobile nav", () => {
    const css = readFileSync(join(process.cwd(), "src/app/console.css"), "utf8");
    assert.match(css, /@media \(max-width: 820px\)/);
    assert.match(css, /tc-nav-toggle/);
  });
});
