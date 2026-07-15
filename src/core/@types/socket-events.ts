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

export type ServerToClientEvents = {
  "call-joined": (payload: CallJoinedPayload) => void;
  "waiting-for-participant": (payload: WaitingForParticipantPayload) => void;
  "call-ready": (payload: CallReadyPayload) => void;
  error: (payload: SocketEventErrorPayload) => void;
};

export type ClientToServerEvents = {
  "join-call": () => void;
  "participant-ready": () => void;
};
