import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isServerSpeechEnabled } from "./config";
import { DEEPL_TARGET_LANGUAGES } from "@/core/components/selector-country/countryList";
import { toSpeechRecognitionLocale } from "@/core/utils/speech-recognition-language";
import { isServerSpeechLocale } from "./languages";

const pilot = "550e8400-e29b-41d4-a716-446655440000";
const other = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", "");
});
afterEach(() => vi.unstubAllEnvs());

it.each(DEEPL_TARGET_LANGUAGES)(
  "routes the pilot locale %s to its appropriate engine",
  (language) => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", pilot);
    expect(isServerSpeechEnabled(pilot, language)).toBe(
      isServerSpeechLocale(toSpeechRecognitionLocale(language)),
    );
  },
);

it("keeps rooms on the existing engine unless explicitly enabled", () => {
  expect(isServerSpeechEnabled(pilot)).toBe(false);
  expect(isServerSpeechEnabled()).toBe(false);
});

it("enables only exact configured room ids", () => {
  vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", ` ${pilot} `);
  expect(isServerSpeechEnabled(pilot)).toBe(true);
  expect(isServerSpeechEnabled(other)).toBe(false);
  expect(isServerSpeechEnabled()).toBe(false);
  expect(isServerSpeechEnabled(pilot.slice(0, 8))).toBe(false);
});

it.each([
  "*",
  `${pilot},invalid`,
  `${pilot},`,
  Array(11).fill(pilot).join(","),
])(
  "fails closed for malformed or excessive pilot configuration: %s",
  (value) => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", value);
    expect(isServerSpeechEnabled(pilot)).toBe(false);
  },
);

it("activates the released languages but preserves an explicit room list", () => {
  vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_ENABLED", "true");
  expect(isServerSpeechEnabled(other)).toBe(true);
  vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", pilot);
  expect(isServerSpeechEnabled(pilot)).toBe(true);
  expect(isServerSpeechEnabled(other)).toBe(false);
});
