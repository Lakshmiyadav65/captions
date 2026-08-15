import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  friendlyExportError,
  isActiveExportStatus,
  percentFromBurnFraction,
  secondaryForExportStatus,
  titleForExportStatus,
} from "./export-job";
import { consumeSseChunks } from "./export-sse";

describe("percentFromBurnFraction", () => {
  it("maps 0% burn to the starting band", () => {
    assert.equal(percentFromBurnFraction(0), 5);
  });

  it("maps 100% burn to 90% so upload can finalize", () => {
    assert.equal(percentFromBurnFraction(1), 90);
  });

  it("scales real ffmpeg progress through the middle", () => {
    assert.equal(percentFromBurnFraction(0.5), 48);
  });
});

describe("export status copy", () => {
  it("uses the specified titles", () => {
    assert.equal(titleForExportStatus("queued"), "Preparing export...");
    assert.equal(titleForExportStatus("processing"), "Exporting your video...");
    assert.equal(titleForExportStatus("finalizing"), "Finalizing your video...");
    assert.equal(titleForExportStatus("completed"), "Export complete!");
    assert.equal(titleForExportStatus("failed"), "Export failed");
  });

  it("uses rendering copy while exporting", () => {
    assert.equal(secondaryForExportStatus("processing"), "Rendering captions...");
  });

  it("treats queued/processing/finalizing as in-flight", () => {
    assert.equal(isActiveExportStatus("processing"), true);
    assert.equal(isActiveExportStatus("completed"), false);
    assert.equal(isActiveExportStatus("idle"), false);
  });
});

describe("friendlyExportError", () => {
  it("does not leak a raw timeout stack", () => {
    assert.match(friendlyExportError("FUNCTION_INVOCATION timed out"), /timed out/i);
  });
});

describe("consumeSseChunks", () => {
  it("parses complete events and keeps a partial trailing frame", () => {
    const first = consumeSseChunks<{ progress: number }>("", 'data: {"progress":10}\n\ndata: {"progress":');
    assert.deepEqual(first.events, [{ progress: 10 }]);
    const second = consumeSseChunks<{ progress: number }>(first.buffer, "42}\n\n");
    assert.deepEqual(second.events, [{ progress: 42 }]);
    assert.equal(second.buffer, "");
  });
});
