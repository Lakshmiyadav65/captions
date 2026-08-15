import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyTextCase, joinWithTextCase } from "./style";

describe("applyTextCase title", () => {
  it("capitalizes each word", () => {
    assert.equal(
      applyTextCase("build cheyaalanukunte oka apply", "title"),
      "Build Cheyaalanukunte Oka Apply",
    );
  });
});

describe("joinWithTextCase", () => {
  it("titles the down-caption line", () => {
    assert.equal(
      joinWithTextCase(["build", "cheyaalanukunte", "oka", "apply"], "title"),
      "Build Cheyaalanukunte Oka Apply",
    );
  });
});
