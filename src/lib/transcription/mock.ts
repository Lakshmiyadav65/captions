import type {
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

// A keyless provider used when no ASR_PROVIDER key is configured. It returns a fixed
// sample Telugu transcript so the entire UI (player, styled overlay, editing, export)
// is usable immediately — before you sign up for any transcription API.

const SAMPLE_SEGMENTS = [
  { start: 0.0, end: 2.6, text: "నమస్కారం, మీకు స్వాగతం." },
  {
    start: 2.8,
    end: 6.4,
    text: "ఈ వీడియోలో మనం తెలుగు క్యాప్షన్ల గురించి తెలుసుకుందాం.",
  },
  { start: 6.6, end: 9.2, text: "మీ వీడియోను అప్‌లోడ్ చేయండి." },
  {
    start: 9.4,
    end: 12.8,
    text: "సాఫ్ట్‌వేర్ మాట్లాడే భాషను గుర్తిస్తుంది.",
  },
  {
    start: 13.0,
    end: 16.4,
    text: "తరువాత తెలుగులో ఉపశీర్షికలు తయారవుతాయి.",
  },
  { start: 16.6, end: 19.4, text: "మీరు ఫాంట్ పరిమాణాన్ని మార్చవచ్చు." },
  { start: 19.6, end: 22.6, text: "వివిధ శైలులలో వాటిని రూపొందించండి." },
  { start: 22.8, end: 24.6, text: "ధన్యవాదాలు!" },
];

export class MockProvider implements TranscriptionProvider {
  readonly name = "mock";

  async transcribe(): Promise<TranscriptionResult> {
    // Small delay so the UI's "transcribing…" state is visible.
    await new Promise((r) => setTimeout(r, 1200));
    return {
      language: "te",
      provider: this.name,
      segments: SAMPLE_SEGMENTS.map((s) => ({ ...s })),
    };
  }
}
