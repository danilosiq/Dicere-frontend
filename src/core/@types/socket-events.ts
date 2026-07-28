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

export type CallLeaveReason = "USER_LEFT" | "CONNECTION_CLOSED";

export type CallTerminationReason =
  CallLeaveReason | "PARTICIPANT_REMOVED" | "ROOM_CLOSED" | "ROOM_EXPIRED";

export type CallLeftPayload = {
  roomId: string;
  participantId: string;
  reason: CallLeaveReason;
};

export type ParticipantLeftCallPayload = {
  participantId: string;
  reason: CallTerminationReason;
};

export type RoomExpiredPayload = {
  roomId: string;
  status: "EXPIRED";
  reason?: string;
};

export type TranslateSpeechPayload = {
  roomId: string;
  text: string;
};

export type VoiceTranslationReceivedPayload = {
  roomId: string;
  fromParticipantId: string;
  fromParticipantName: string;
  originalText: string;
  translatedText: string;
  targetLanguage: string;
};

export type ServerToClientEvents = {
  room_joined: (payload: RoomJoinedPayload) => void;
  participant_joined: (payload: RoomParticipant) => void;
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
  participant_removed_success: () => void;
  room_expired: (payload: RoomExpiredPayload) => void;
  voice_translation_received: (
    payload: VoiceTranslationReceivedPayload,
  ) => void;
  error: (payload: SocketEventErrorPayload) => void;
};

export type ClientToServerEvents = {
  join_room: (payload: JoinRoomPayload) => void;
  "join-call": () => void;
  "participant-ready": () => void;
  "webrtc-offer": (payload: WebRtcOfferPayload) => void;
  "webrtc-answer": (payload: WebRtcAnswerPayload) => void;
  "webrtc-ice-candidate": (payload: WebRtcIceCandidatePayload) => void;
  "leave-call": (payload: { reason?: CallLeaveReason }) => void;
  translate_speech: (payload: TranslateSpeechPayload) => void;
};
import type {
  JoinRoomPayload,
  RoomJoinedPayload,
  RoomParticipant,
} from "@/core/@types/room";
