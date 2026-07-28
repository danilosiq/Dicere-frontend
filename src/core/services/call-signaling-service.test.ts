import { beforeEach, describe, expect, it, vi } from "vitest";

const socketMock = vi.hoisted(() => {
  type Handler = (...args: never[]) => void;
  const handlers = new Map<string, Set<Handler>>();
  const emitted: Array<{ event: string; args: unknown[] }> = [];

  const socket = {
    connected: true,
    id: "socket-1" as string | undefined,
    on(event: string, handler: Handler) {
      const eventHandlers = handlers.get(event) ?? new Set<Handler>();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
      return socket;
    },
    off(event: string, handler: Handler) {
      handlers.get(event)?.delete(handler);
      return socket;
    },
    emit(event: string, ...args: unknown[]) {
      emitted.push({ event, args });
      return socket;
    },
  };

  return {
    socket,
    emitted,
    reset() {
      handlers.clear();
      emitted.length = 0;
      socket.connected = true;
      socket.id = "socket-1";
    },
    serverEmit(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload as never));
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
  };
});

vi.mock("./socket-service", () => ({
  getSocket: () => socketMock.socket,
}));

import {
  JoinCallRequestError,
  joinCall,
  notifyParticipantReady,
  resetCallSignaling,
  resetJoinCall,
  sendWebRtcIceCandidate,
  subscribeToWebRtcSignaling,
} from "./call-signaling-service";

describe("call-signaling-service", () => {
  beforeEach(() => {
    resetCallSignaling();
    socketMock.reset();
  });

  it("deduplica join-call e aguarda a confirmação do backend", async () => {
    const firstRequest = joinCall();
    const secondRequest = joinCall();

    expect(secondRequest).toBe(firstRequest);
    expect(
      socketMock.emitted.filter(({ event }) => event === "join-call"),
    ).toHaveLength(1);

    socketMock.serverEmit("call-joined", {
      roomId: "room-1",
      participantId: "participant-1",
      participantCount: 1,
    });

    await expect(firstRequest).resolves.toMatchObject({ roomId: "room-1" });
    expect(socketMock.listenerCount("call-joined")).toBe(0);
    expect(socketMock.listenerCount("error")).toBe(0);
  });

  it("propaga erros de sala cheia recebidos durante join-call", async () => {
    const request = joinCall();

    socketMock.serverEmit("error", {
      event: "join-call",
      code: "CALL_FULL",
      message: "Chamada cheia",
    });

    await expect(request).rejects.toMatchObject({
      code: "CALL_FULL",
      message: "Chamada cheia",
    });
  });

  it("repete join-call enquanto a presença anterior ainda está sendo limpa", async () => {
    vi.useFakeTimers();
    const request = joinCall();

    socketMock.serverEmit("error", {
      event: "join-call",
      code: "PARTICIPANT_ALREADY_IN_CALL",
      message: "Participante já está na chamada",
    });

    await vi.advanceTimersByTimeAsync(300);

    expect(
      socketMock.emitted.filter(({ event }) => event === "join-call"),
    ).toHaveLength(2);

    socketMock.serverEmit("call-joined", {
      roomId: "room-1",
      participantId: "participant-1",
      participantCount: 2,
    });

    await expect(request).resolves.toMatchObject({
      roomId: "room-1",
      participantId: "participant-1",
    });
    vi.useRealTimers();
  });

  it("encerra o retry quando a presença anterior não é liberada", async () => {
    vi.useFakeTimers();
    const request = joinCall();
    const alreadyJoinedError = {
      event: "join-call",
      code: "PARTICIPANT_ALREADY_IN_CALL",
      message: "Participante já está na chamada",
    };

    for (let attempt = 1; attempt < 4; attempt += 1) {
      socketMock.serverEmit("error", alreadyJoinedError);
      await vi.advanceTimersByTimeAsync(300);
    }

    socketMock.serverEmit("error", alreadyJoinedError);

    await expect(request).rejects.toMatchObject({
      code: "PARTICIPANT_ALREADY_IN_CALL",
    });
    expect(
      socketMock.emitted.filter(({ event }) => event === "join-call"),
    ).toHaveLength(4);
    vi.useRealTimers();
  });

  it("cancela join-call pendente e remove timeout e listeners", async () => {
    const request = joinCall();

    resetJoinCall();

    await expect(request).rejects.toEqual(
      expect.objectContaining<Partial<JoinCallRequestError>>({
        code: "JOIN_CALL_CANCELLED",
      }),
    );
    expect(socketMock.listenerCount("call-joined")).toBe(0);
    expect(socketMock.listenerCount("disconnect")).toBe(0);
  });

  it("encerra join-call quando a confirmação excede o timeout", async () => {
    vi.useFakeTimers();
    const request = joinCall();
    const assertion = expect(request).rejects.toMatchObject({
      code: "JOIN_CALL_TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(10_000);

    await assertion;
    expect(socketMock.listenerCount("call-joined")).toBe(0);
    vi.useRealTimers();
  });

  it("emite participant-ready uma única vez por socket e chamada", () => {
    const params = { roomId: "room-1", participantId: "participant-1" };

    expect(notifyParticipantReady(params)).toBe(true);
    expect(notifyParticipantReady(params)).toBe(false);
    expect(
      socketMock.emitted.filter(({ event }) => event === "participant-ready"),
    ).toHaveLength(1);
  });

  it("envia ICE candidates para o backend sem identificadores fornecidos pelo cliente", () => {
    const candidate = {
      candidate: "candidate:1 1 UDP 2122260223 192.168.1.10 54400 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: "abc123",
    };

    sendWebRtcIceCandidate({ candidate });

    expect(socketMock.emitted).toContainEqual({
      event: "webrtc-ice-candidate",
      args: [{ candidate }],
    });
  });

  it.each([
    "USER_LEFT",
    "CONNECTION_CLOSED",
    "PARTICIPANT_REMOVED",
    "ROOM_CLOSED",
    "ROOM_EXPIRED",
  ])("aceita o motivo de término %s", (reason) => {
    const onParticipantLeft = vi.fn();
    const unsubscribe = subscribeToWebRtcSignaling({
      onOffer: vi.fn(),
      onAnswer: vi.fn(),
      onIceCandidate: vi.fn(),
      onParticipantLeft,
      onLocalParticipantRemoved: vi.fn(),
      onRoomExpired: vi.fn(),
      onError: vi.fn(),
      onDisconnect: vi.fn(),
    });

    socketMock.serverEmit("participant-left-call", {
      participantId: "participant-2",
      reason,
    });

    expect(onParticipantLeft).toHaveBeenCalledWith({
      participantId: "participant-2",
      reason,
    });
    unsubscribe();
  });

  it("assina remoção local e expiração e remove os listeners no cleanup", () => {
    const onLocalParticipantRemoved = vi.fn();
    const onRoomExpired = vi.fn();
    const unsubscribe = subscribeToWebRtcSignaling({
      onOffer: vi.fn(),
      onAnswer: vi.fn(),
      onIceCandidate: vi.fn(),
      onParticipantLeft: vi.fn(),
      onLocalParticipantRemoved,
      onRoomExpired,
      onError: vi.fn(),
      onDisconnect: vi.fn(),
    });

    socketMock.serverEmit("participant_removed_success");
    socketMock.serverEmit("room_expired", {
      roomId: "room-1",
      status: "EXPIRED",
      reason: "INACTIVITY",
    });

    expect(onLocalParticipantRemoved).toHaveBeenCalledOnce();
    expect(onRoomExpired).toHaveBeenCalledWith({
      roomId: "room-1",
      status: "EXPIRED",
      reason: "INACTIVITY",
    });

    unsubscribe();

    expect(socketMock.listenerCount("participant_removed_success")).toBe(0);
    expect(socketMock.listenerCount("room_expired")).toBe(0);
    expect(socketMock.listenerCount("disconnect")).toBe(0);
  });
});
