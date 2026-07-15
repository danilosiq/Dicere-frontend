export type CallJoinedPayload = {
  roomId: string;
  participantId: string;
  participantCount: number;
};

export type SocketEventErrorPayload = {
  event: string;
  code: string;
  message: string;
};

export type WaitingForParticipantPayload = {
  roomId: string;
  readyParticipants: number;
};

export type CallReadyPayload = {
  roomId: string;
  initiatorParticipantId: string;
  shouldCreateOffer: boolean;
};

export type WebRtcOfferDescription = {
  type: "offer";
  sdp: string;
};

export type WebRtcAnswerDescription = {
  type: "answer";
  sdp: string;
};

export type WebRtcIceCandidate = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
};

export type WebRtcOfferPayload = {
  description: WebRtcOfferDescription;
};

export type WebRtcAnswerPayload = {
  description: WebRtcAnswerDescription;
};

export type WebRtcIceCandidatePayload = {
  candidate: WebRtcIceCandidate;
};

export type WebRtcOfferReceivedPayload = WebRtcOfferPayload & {
  fromParticipantId: string;
};

export type WebRtcAnswerReceivedPayload = WebRtcAnswerPayload & {
  fromParticipantId: string;
};

export type WebRtcIceCandidateReceivedPayload = WebRtcIceCandidatePayload & {
  fromParticipantId: string;
};

export type WebRtcDescriptionSentPayload = {
  roomId: string;
  toParticipantId: string;
};

export type LeaveCallReason = "USER_LEFT" | "CONNECTION_CLOSED";

export type CallLeftPayload = {
  roomId: string;
  participantId: string;
  reason: LeaveCallReason;
};

export type ParticipantLeftCallPayload = {
  participantId: string;
  reason: LeaveCallReason;
};

export type ServerToClientEvents = {
  "call-joined": (payload: CallJoinedPayload) => void;
  "waiting-for-participant": (payload: WaitingForParticipantPayload) => void;
  "call-ready": (payload: CallReadyPayload) => void;
  "webrtc-offer": (payload: WebRtcOfferReceivedPayload) => void;
  "webrtc-offer-sent": (payload: WebRtcDescriptionSentPayload) => void;
  "webrtc-answer": (payload: WebRtcAnswerReceivedPayload) => void;
  "webrtc-answer-sent": (payload: WebRtcDescriptionSentPayload) => void;
  "webrtc-ice-candidate": (payload: WebRtcIceCandidateReceivedPayload) => void;
  "call-left": (payload: CallLeftPayload) => void;
  "participant-left-call": (payload: ParticipantLeftCallPayload) => void;
  error: (payload: SocketEventErrorPayload) => void;
};

export type ClientToServerEvents = {
  "join-call": () => void;
  "participant-ready": () => void;
  "webrtc-offer": (payload: WebRtcOfferPayload) => void;
  "webrtc-answer": (payload: WebRtcAnswerPayload) => void;
  "webrtc-ice-candidate": (payload: WebRtcIceCandidatePayload) => void;
  "leave-call": (payload: { reason?: LeaveCallReason }) => void;
};
