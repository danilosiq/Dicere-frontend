import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { splitSpeechText } from "../../src/core/services/speech-text-segmentation.ts";
import { cases } from "./cases.mjs";
import { connectAndJoin, translate } from "./socket-probe.mjs";

// An explicit endpoint prevents production traffic in ordinary tests/CI.
const endpoint = process.argv[2];
if (!endpoint) throw new Error("Pass the API endpoint explicitly.");
const api = new URL(endpoint).origin;
const clients = [];
const report = { scope: "text-only; not STT or audio latency", cases: [] };
let room;

async function request(path, method, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}

try {
  const password = randomUUID();
  room = (
    await request("/room", "POST", {
      title: "Synthetic cohesion validation",
      password,
      participantName: "Cohesion sender",
      targetLanguage: "DE",
    })
  ).data;
  const sender = await connectAndJoin(
    api,
    {
      roomCode: room.code,
      password,
      nickname: "Cohesion sender",
      participantId: room.adminParticipantId,
      targetLanguage: "DE",
    },
    clients,
  );
  const receiver = await connectAndJoin(
    api,
    {
      roomCode: room.code,
      password,
      nickname: "Cohesion receiver",
      targetLanguage: "PT-BR",
    },
    clients,
  );

  let sequence = 0;
  for (const sample of cases) {
    const chunks = splitSpeechText(sample.text);
    assert.equal(chunks.join(" "), sample.text);
    const results = [];
    let previousContext;
    for (const text of chunks) {
      assert.ok(text.length <= 250);
      const payload = {
        roomId: room.roomId,
        text,
        sourceLanguage: sample.sourceLanguage,
        segmentId: randomUUID(),
        traceId: randomUUID(),
        sequence: sequence++,
        revision: 1,
        status: "final",
        ...(previousContext ? { previousContext } : {}),
      };
      const { event, roundTripMs, acknowledgement } = await translate(
        sender,
        receiver,
        payload,
      );
      assert.equal(event.originalText, text);
      assert.equal(event.targetLanguage, "PT-BR");
      assert.equal(event.sourceLanguage, sample.sourceLanguage);
      for (const field of [
        "segmentId",
        "traceId",
        "sequence",
        "revision",
        "status",
        "previousContext",
      ]) {
        assert.equal(event[field], payload[field]);
      }
      assert.equal(acknowledgement.segmentId, payload.segmentId);
      assert.equal(acknowledgement.traceId, payload.traceId);
      assert.ok(event.translatedText.trim());
      results.push({
        original: text,
        translation: event.translatedText,
        roundTripMs,
        providerMs: event.timings?.translationDurationMs,
      });
      previousContext = text;
    }
    report.cases.push({ name: sample.name, results });
  }
} finally {
  try {
    if (room) {
      await request(`/room/${room.roomId}`, "PATCH");
      report.roomClosed = true;
    }
  } finally {
    clients.forEach((client) => client.disconnect());
    console.log(JSON.stringify(report, null, 2));
  }
}
