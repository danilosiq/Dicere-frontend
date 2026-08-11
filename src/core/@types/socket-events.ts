import type {
  ChatMessagesListPayload,
  ChatMessage,
  ListChatMessagesPayload,
  SendChatMessagePayload,
} from "@/core/@types/chat";
import type {
  JoinRoomPayload,
  RoomJoinedPayload,
  RoomParticipant,
} from "@/core/@types/room";

export type CallJoinedPayload = {
  roomId: string;
  participantId: string;
  participantCount: number;
};

export type SocketEventErrorPayload = {
  event?: string;
  code?: string;
  message: string;
  issues?: unknown;
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

export type SpeechSegmentStatus = "provisional" | "final";

export type SpeechTranslationTimings = {
  queueWaitMs?: number;
  processingMs?: number;
  translationDurationMs?: number;
};

export type SpeechTranslationMetadata = {
  segmentId: string;
  sequence: number;
  revision: number;
  status: SpeechSegmentStatus;
  traceId: string;
  clientSentAt: number | string;
  sourceLanguage: string;
  previousContext?: string;
};

export type TranslateSpeechPayload = {
  roomId: string;
  text: string;
} & Partial<SpeechTranslationMetadata>;

export type TranslateSpeechAcknowledgement = {
  result: "ok" | "duplicate" | "error";
  segmentId?: string;
  revision?: number;
  traceId?: string;
  timings?: SpeechTranslationTimings;
  error?: {
    code: string;
    message: string;
  };
};

export type VoiceTranslationReceivedPayload = {
  roomId: string;
  fromParticipantId: string;
  fromParticipantName: string;
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  serverSentAt?: number;
  timings?: SpeechTranslationTimings;
} & Partial<SpeechTranslationMetadata>;

export type ServerToClientEvents = {
  room_joined: (payload: RoomJoinedPayload) => void;
  participant_joined: (payload: RoomParticipant) => void;
  message_sent: (payload: ChatMessage) => void;
  message_received: (payload: ChatMessage) => void;
  messages_list: (payload: ChatMessagesListPayload) => void;
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
  send_message: (payload: SendChatMessagePayload) => void;
  list_messages: (payload: ListChatMessagesPayload) => void;
  "join-call": () => void;
  "participant-ready": () => void;
  "webrtc-offer": (payload: WebRtcOfferPayload) => void;
  "webrtc-answer": (payload: WebRtcAnswerPayload) => void;
  "webrtc-ice-candidate": (payload: WebRtcIceCandidatePayload) => void;
  "leave-call": (payload: { reason?: CallLeaveReason }) => void;
  translate_speech: (
    payload: TranslateSpeechPayload,
    acknowledgement: (payload: TranslateSpeechAcknowledgement) => void,
  ) => void;
};
