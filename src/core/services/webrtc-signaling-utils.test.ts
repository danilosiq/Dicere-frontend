import { describe, expect, it } from "vitest";

import {
  canApplyAnswer,
  canApplyOffer,
  canCreateOffer,
  isWebRtcDescription,
  isWebRtcDescriptionReceivedPayload,
  isWebRtcIceCandidate,
  isWebRtcIceCandidateReceivedPayload,
  shouldQueueIceCandidate,
} from "./webrtc-signaling-utils";

describe("webrtc-signaling-utils", () => {
  it("valida offers e answers sem aceitar SDP vazio ou tipo incorreto", () => {
    expect(isWebRtcDescription({ type: "offer", sdp: "v=0" }, "offer")).toBe(
      true,
    );
    expect(isWebRtcDescription({ type: "answer", sdp: "v=0" }, "offer")).toBe(
      false,
    );
    expect(isWebRtcDescription({ type: "offer", sdp: "" }, "offer")).toBe(
      false,
    );
    expect(
      isWebRtcDescriptionReceivedPayload(
        {
          fromParticipantId: "participant-2",
          description: { type: "answer", sdp: "v=0" },
        },
        "answer",
      ),
    ).toBe(true);
  });

  it("valida ICE candidates, incluindo o marcador de fim do trickle ICE", () => {
    const candidate = {
      candidate: "candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: "abc",
    };

    expect(isWebRtcIceCandidate(candidate)).toBe(true);
    expect(
      isWebRtcIceCandidate({
        candidate: "",
        sdpMid: null,
        sdpMLineIndex: null,
        usernameFragment: null,
      }),
    ).toBe(true);
    expect(
      isWebRtcIceCandidateReceivedPayload({
        fromParticipantId: "participant-2",
        candidate,
      }),
    ).toBe(true);
    expect(isWebRtcIceCandidate({ ...candidate, sdpMLineIndex: 65_536 })).toBe(
      false,
    );
  });

  it("aceita negociação inicial e renegociação nos estados corretos", () => {
    expect(
      canCreateOffer({ signalingState: "stable", hasLocalDescription: false }),
    ).toBe(true);
    expect(canApplyOffer({ signalingState: "stable" })).toBe(true);
    expect(canApplyOffer({ signalingState: "have-local-offer" })).toBe(false);
    expect(canApplyAnswer({ signalingState: "have-local-offer" })).toBe(true);
    expect(canApplyAnswer({ signalingState: "stable" })).toBe(false);
    expect(shouldQueueIceCandidate(null)).toBe(true);
    expect(
      shouldQueueIceCandidate({
        type: "offer",
        sdp: "v=0",
      } as RTCSessionDescription),
    ).toBe(false);
  });
});
