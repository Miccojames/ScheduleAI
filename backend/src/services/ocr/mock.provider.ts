import type {
  AnalyzeInput,
  AnalyzeResult,
  ScheduleImageAnalyzer,
  RawAiEntry,
} from "./types.js";

/**
 * MockProvider — used when GEMINI_API_KEY is not set (local dev / demos).
 * It deliberately does NOT read the image: it returns a fixed, deterministic
 * demo schedule so the full upload → parse → review pipeline can be exercised
 * without any API key or network access. The response carries provider:"mock"
 * all the way to the client so the UI can label it as demo data.
 *
 * Deterministic per-field confidences (subject/day/times 0.95, instructor 0.8,
 * room 0.6 < 0.75) let the review UI demo its "low confidence" highlighting.
 */
const MOCK_CONFIDENCE = {
  subject: 0.95,
  day: 0.95,
  startTime: 0.95,
  endTime: 0.95,
  instructor: 0.8,
  room: 0.6,
} as const;

const DEMO_ENTRIES: RawAiEntry[] = [
  {
    subject: "Web Development",
    day: ["Monday", "Wednesday", "Friday"],
    start_time: "08:00",
    end_time: "09:30",
    room: "Room 201",
    instructor: "Juan Dela Cruz",
    notes: null,
    confidence: { ...MOCK_CONFIDENCE },
  },
  {
    subject: "Database Systems",
    day: ["Tuesday", "Thursday"],
    start_time: "10:00",
    end_time: "11:30",
    // Trailing "?" = uncertain reading → parser flags uncertainFields:["room"]
    // so the review UI can demonstrate the badge.
    room: "Room 305?",
    instructor: "Maria Santos",
    notes: "Lab on Thursdays",
    confidence: { ...MOCK_CONFIDENCE },
  },
  {
    subject: "Networking",
    day: ["Friday"],
    start_time: "13:00",
    end_time: "16:00",
    room: null,
    instructor: "Andres Reyes",
    notes: null,
    confidence: { ...MOCK_CONFIDENCE },
  },
];

export class MockProvider implements ScheduleImageAnalyzer {
  readonly name = "mock" as const;

  // Accepts the input for interface compatibility but intentionally ignores it.
  async analyze(_input: AnalyzeInput): Promise<AnalyzeResult> {
    // Small delay so the PROCESSING state is observable in the UI.
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Copies (including confidence) so callers can't mutate the demo data.
    return {
      entries: DEMO_ENTRIES.map((entry) => ({
        ...entry,
        confidence: entry.confidence ? { ...entry.confidence } : entry.confidence,
      })),
    };
  }
}
