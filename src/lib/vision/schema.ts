// JSON Schema handed to Anthropic's structured-output (output_config.format.json_schema) so the
// vision model returns a StyleProfileModelOutput exactly. Obeys the structured-output limits:
// only type / enum / anyOf / additionalProperties:false / required — no min/max/length/pattern
// or recursion. `provider` and `fontMatch` are added server-side, so they're NOT in the schema.

export const STYLE_PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["font", "typography", "colors", "outline", "layout", "effects", "vibe", "confidence"],
  properties: {
    font: {
      type: "object",
      additionalProperties: false,
      required: ["category", "weight", "traits", "closestBundledFont"],
      properties: {
        category: { type: "string", enum: ["sans", "serif", "display", "handwriting"] },
        weight: { type: "string", enum: ["thin", "regular", "medium", "bold", "black"] },
        traits: { type: "array", items: { type: "string" } },
        closestBundledFont: {
          type: "string",
          enum: ["noto", "mandali", "mallanna", "ntr", "gidugu", "suranna", "ramaraja", "dhurjati"],
        },
      },
    },
    typography: {
      type: "object",
      additionalProperties: false,
      required: ["sizeBucket", "letterSpacing", "lineSpacing", "uppercase"],
      properties: {
        sizeBucket: { type: "string", enum: ["s", "m", "l", "xl"] },
        letterSpacing: { type: "string", enum: ["tight", "normal", "wide"] },
        lineSpacing: { type: "string", enum: ["tight", "normal", "loose"] },
        uppercase: { type: "boolean" },
      },
    },
    colors: {
      type: "object",
      additionalProperties: false,
      required: ["text", "outline", "background", "highlight", "backgroundOpacity"],
      properties: {
        text: { type: "string" },
        outline: { anyOf: [{ type: "string" }, { type: "null" }] },
        background: { anyOf: [{ type: "string" }, { type: "null" }] },
        highlight: { anyOf: [{ type: "string" }, { type: "null" }] },
        backgroundOpacity: { type: "string", enum: ["none", "semi", "solid"] },
      },
    },
    outline: {
      type: "object",
      additionalProperties: false,
      required: ["present", "weight"],
      properties: {
        present: { type: "boolean" },
        weight: { type: "string", enum: ["thin", "medium", "thick"] },
      },
    },
    layout: {
      type: "object",
      additionalProperties: false,
      required: ["align", "positionBucket", "maxWidthBucket"],
      properties: {
        align: { type: "string", enum: ["left", "center", "right"] },
        positionBucket: { type: "string", enum: ["top", "middle", "lower", "bottom"] },
        maxWidthBucket: { type: "string", enum: ["narrow", "medium", "wide"] },
      },
    },
    effects: {
      type: "object",
      additionalProperties: false,
      required: ["shadow", "karaoke"],
      properties: {
        shadow: { type: "boolean" },
        karaoke: { type: "boolean" },
      },
    },
    vibe: { type: "string" },
    confidence: { type: "number" },
  },
} as const;
