import assert from "node:assert/strict";
import test from "node:test";

import {
  canApplyAnswer,
  canApplyOffer,
  canCreateOffer,
  isWebRtcDescription,
  isWebRtcDescriptionReceivedPayload,
  isWebRtcIceCandidate,
  isWebRtcIceCandidateReceivedPayload,
  shouldQueueIceCandidate,
} from "./webrtc-signaling-utils.ts";

test("valida offers e answers sem aceitar SDP vazio ou tipo incorreto", () => {
  assert.equal(
    isWebRtcDescription({ type: "offer", sdp: "v=0" }, "offer"),
    true,
  );
  assert.equal(
    isWebRtcDescription({ type: "answer", sdp: "v=0" }, "offer"),
    false,
  );
  assert.equal(isWebRtcDescription({ type: "offer", sdp: "" }, "offer"), false);
  assert.equal(
    isWebRtcDescriptionReceivedPayload(
      {
        fromParticipantId: "participant-2",
        description: { type: "answer", sdp: "v=0" },
      },
      "answer",
    ),
    true,
  );
});

test("valida ICE candidates, incluindo o marcador de fim do trickle ICE", () => {
  const candidate = {
    candidate: "candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host",
    sdpMid: "0",
    sdpMLineIndex: 0,
    usernameFragment: "abc",
  };

  assert.equal(isWebRtcIceCandidate(candidate), true);
  assert.equal(
    isWebRtcIceCandidate({
      candidate: "",
      sdpMid: null,
      sdpMLineIndex: null,
      usernameFragment: null,
    }),
    true,
  );
  assert.equal(
    isWebRtcIceCandidateReceivedPayload({
      fromParticipantId: "participant-2",
      candidate,
    }),
    true,
  );
  assert.equal(
    isWebRtcIceCandidate({ ...candidate, sdpMLineIndex: 65_536 }),
    false,
  );
});

test("respeita a ordem de estados para offer, answer e ICE remoto", () => {
  assert.equal(
    canCreateOffer({ signalingState: "stable", hasLocalDescription: false }),
    true,
  );
  assert.equal(
    canApplyOffer({ signalingState: "stable", hasRemoteDescription: false }),
    true,
  );
  assert.equal(
    canApplyAnswer({
      signalingState: "have-local-offer",
      hasRemoteDescription: false,
    }),
    true,
  );
  assert.equal(
    canApplyAnswer({
      signalingState: "stable",
      hasRemoteDescription: false,
    }),
    false,
  );
  assert.equal(shouldQueueIceCandidate(null), true);
  assert.equal(
    shouldQueueIceCandidate({
      type: "offer",
      sdp: "v=0",
    } as RTCSessionDescription),
    false,
  );
});
