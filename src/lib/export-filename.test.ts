import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_EXPORT_BASENAME,
  contentDispositionAttachment,
  defaultExportBasename,
  exportDownloadName,
  sanitizeExportBasename,
  validateExportBasename,
} from "./export-filename";

describe("sanitizeExportBasename", () => {
  it("strips an .mp4 suffix and trims spaces", () => {
    assert.equal(sanitizeExportBasename("  Telugu Reel.mp4  "), "Telugu Reel");
  });

  it("rejects empty and whitespace-only names", () => {
    assert.equal(sanitizeExportBasename(""), null);
    assert.equal(sanitizeExportBasename("   "), null);
    assert.equal(sanitizeExportBasename(".mp4"), null);
  });

  it("rejects path traversal", () => {
    assert.equal(sanitizeExportBasename("../secret"), null);
    assert.equal(sanitizeExportBasename("..\\secret"), null);
  });

  it("takes the last path segment instead of allowing separators", () => {
    assert.equal(sanitizeExportBasename("folder/Telugu_Reel_August"), "Telugu_Reel_August");
  });

  it("strips invalid filesystem characters", () => {
    assert.equal(sanitizeExportBasename('foo<>:"|?*bar'), "foobar");
  });

  it("truncates overly long names", () => {
    const long = "a".repeat(MAX_EXPORT_BASENAME + 40);
    assert.equal(sanitizeExportBasename(long)?.length, MAX_EXPORT_BASENAME);
  });
});

describe("validateExportBasename", () => {
  it("accepts a custom name and appends .mp4", () => {
    const result = validateExportBasename("Telugu_Reel_August");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.basename, "Telugu_Reel_August");
      assert.equal(result.filename, "Telugu_Reel_August.mp4");
    }
  });

  it("rejects empty names with a friendly message", () => {
    const result = validateExportBasename("   ");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Please enter a valid file name.");
  });

  it("rejects traversal attempts", () => {
    const result = validateExportBasename("../etc/passwd");
    assert.equal(result.ok, false);
  });
});

describe("defaultExportBasename", () => {
  it("uses the project name without its extension", () => {
    assert.equal(defaultExportBasename("family-dinner.mov"), "family-dinner");
  });

  it("falls back to a sensible default", () => {
    assert.equal(defaultExportBasename(null), "my-captioned-video");
    assert.equal(defaultExportBasename("***"), "my-captioned-video");
  });
});

describe("exportDownloadName", () => {
  it("always ends with .mp4", () => {
    assert.equal(exportDownloadName("Telugu_Reel_August"), "Telugu_Reel_August.mp4");
  });
});

describe("contentDispositionAttachment", () => {
  it("includes the chosen filename", () => {
    const header = contentDispositionAttachment("Telugu_Reel_August");
    assert.match(header, /filename="Telugu_Reel_August\.mp4"/);
    assert.match(header, /filename\*=UTF-8''Telugu_Reel_August\.mp4/);
  });
});
