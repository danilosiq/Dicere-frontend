import { expect, it } from "vitest";
import { SpeechActivityWindow } from "./activity-window";

it("detects energy and forgets it within the 256-sample window", () => {
  const activity = new SpeechActivityWindow();
  for (let i = 0; i < 32000; i++) expect(activity.push(0)).toBe(false);
  expect(activity.push(0.5)).toBe(true);
  for (let i = 0; i < 255; i++) expect(activity.push(0)).toBe(true);
  expect(activity.push(0)).toBe(false);
});

it("does not retain activity after varying loud samples followed by silence", () => {
  const activity = new SpeechActivityWindow();
  for (let i = 0; i < 160000; i++) activity.push(Math.sin(i / 13));
  for (let i = 0; i < 256; i++) activity.push(0);
  for (let i = 0; i < 1000; i++) expect(activity.push(0)).toBe(false);
});
