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

export type ServerToClientEvents = {
  "call-joined": (payload: CallJoinedPayload) => void;
  error: (payload: SocketEventErrorPayload) => void;
};

export type ClientToServerEvents = {
  "join-call": () => void;
};
