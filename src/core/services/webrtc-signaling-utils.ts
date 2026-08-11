const MAX_SDP_LENGTH = 65_536;
const MAX_ICE_CANDIDATE_LENGTH = 4_096;
const MAX_ICE_FIELD_LENGTH = 256;
const MAX_SDP_M_LINE_INDEX = 65_535;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isBoundedString(value: unknown, maximumLength: number) {
  return typeof value === "string" && value.length <= maximumLength;
}

function isNullableBoundedString(value: unknown) {
  return value === null || isBoundedString(value, MAX_ICE_FIELD_LENGTH);
}

export function isWebRtcDescription(
  value: unknown,
  expectedType: "offer" | "answer",
) {
  if (!isObject(value)) {
    return false;
  }

  return (
    value.type === expectedType &&
    typeof value.sdp === "string" &&
    value.sdp.length > 0 &&
    value.sdp.length <= MAX_SDP_LENGTH
  );
}

export function isWebRtcDescriptionReceivedPayload(
  value: unknown,
  expectedType: "offer" | "answer",
) {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.fromParticipantId === "string" &&
    value.fromParticipantId.length > 0 &&
    isWebRtcDescription(value.description, expectedType)
  );
}

export function isWebRtcIceCandidate(value: unknown) {
  if (!isObject(value)) {
    return false;
  }

  const isValidMLineIndex =
    value.sdpMLineIndex === null ||
    (typeof value.sdpMLineIndex === "number" &&
      Number.isInteger(value.sdpMLineIndex) &&
      value.sdpMLineIndex >= 0 &&
      value.sdpMLineIndex <= MAX_SDP_M_LINE_INDEX);
  const isValidUsernameFragment =
    value.usernameFragment === undefined ||
    isNullableBoundedString(value.usernameFragment);

  return (
    isBoundedString(value.candidate, MAX_ICE_CANDIDATE_LENGTH) &&
    isNullableBoundedString(value.sdpMid) &&
    isValidMLineIndex &&
    isValidUsernameFragment
  );
}

export function isWebRtcIceCandidateReceivedPayload(value: unknown) {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.fromParticipantId === "string" &&
    value.fromParticipantId.length > 0 &&
    isWebRtcIceCandidate(value.candidate)
  );
}

export function canCreateOffer({
  signalingState,
  hasLocalDescription,
}: {
  signalingState: RTCSignalingState;
  hasLocalDescription: boolean;
}) {
  return signalingState === "stable" && !hasLocalDescription;
}

export function canApplyOffer({
  signalingState,
}: {
  signalingState: RTCSignalingState;
}) {
  return signalingState === "stable";
}

export function canApplyAnswer({
  signalingState,
}: {
  signalingState: RTCSignalingState;
}) {
  return signalingState === "have-local-offer";
}

export function shouldQueueIceCandidate(
  remoteDescription: RTCSessionDescription | null,
) {
  return remoteDescription === null;
}
