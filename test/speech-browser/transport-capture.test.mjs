import { expect, it } from "vitest";
import { createTransportCapture } from "./transport-capture.mjs";

const id = "550e8400-e29b-41d4-a716-446655440000";
const chunk = (sequence) =>
  `451-10${JSON.stringify(["speech_chunk", { sessionId: id, sequence, audio: { _placeholder: true, num: 0 } }])}`;
const finish = `4211${JSON.stringify(["speech_finish", { sessionId: id, lastSequence: 1 }])}`;

it("captures only ordered speech PCM after explicit opt-in by the caller", () => {
  const saved = [];
  const capture = createTransportCapture((...value) => saved.push(value));
  capture(Buffer.from([99, 99]));
  capture(chunk(0));
  capture(Buffer.from([1, 0]));
  capture(chunk(1));
  capture(Buffer.from([2, 0]));
  capture(finish);
  expect(saved).toEqual([[id, Buffer.from([1, 0, 2, 0])]]);
});

it("never saves malformed, replayed or oversized PCM", () => {
  const saved = [];
  for (const invalid of [Buffer.alloc(16001), Buffer.alloc(3)]) {
    const capture = createTransportCapture((...value) => saved.push(value));
    capture(chunk(0));
    capture(invalid);
    capture(finish);
  }
  const capture = createTransportCapture((...value) => saved.push(value));
  capture(chunk(0));
  capture(Buffer.alloc(2));
  capture(chunk(0));
  capture(Buffer.alloc(2));
  capture(finish);
  expect(saved).toEqual([]);
});

it("does not associate an unrelated binary event with speech", () => {
  const saved = [];
  const capture = createTransportCapture((...value) => saved.push(value));
  capture(chunk(0));
  capture('451-11["other",{"_placeholder":true,"num":0}]');
  capture(Buffer.alloc(2));
  capture(chunk(1));
  capture(Buffer.alloc(2));
  capture(finish);
  expect(saved).toEqual([]);
});

it("saves once and rejects incomplete or invalid finish events", () => {
  const saved = [];
  const capture = createTransportCapture((...value) => saved.push(value));
  for (const text of ["42null", "42{}", "42[]", '42["speech_chunk",null]'])
    expect(() => capture(text)).not.toThrow();
  capture(chunk(0));
  capture(Buffer.alloc(2));
  capture(finish);
  capture(chunk(1));
  capture(Buffer.alloc(2));
  capture(`42["speech_finish",{"sessionId":"${id}","lastSequence":"1"}]`);
  expect(saved).toEqual([]);
  capture(finish);
  capture(finish);
  expect(saved).toHaveLength(1);
});

it("bounds total bytes and sessions for each socket", () => {
  const saved = [];
  const capture = createTransportCapture((...value) => saved.push(value));
  for (let sequence = 0; sequence < 25; sequence++) {
    capture(chunk(sequence));
    capture(Buffer.alloc(16000));
  }
  capture(`42["speech_finish",{"sessionId":"${id}","lastSequence":24}]`);
  expect(saved).toEqual([]);
  for (let session = 1; session <= 8; session++) {
    const nextId = id.slice(0, -1) + session;
    capture(chunk(0).replace(id, nextId));
    capture(Buffer.alloc(2));
    capture(`42["speech_finish",{"sessionId":"${nextId}","lastSequence":0}]`);
  }
  expect(saved).toHaveLength(7); // The invalid first session retains its slot.
});
