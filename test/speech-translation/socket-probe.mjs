import { io } from "socket.io-client";

export async function connectAndJoin(endpoint, payload, clients) {
  const socket = io(endpoint, {
    autoConnect: false,
    reconnection: false,
    transports: ["websocket"],
    timeout: 8000,
  });
  clients.push(socket);
  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      socket.off("connect", join);
      socket.off("connect_error", failed);
      socket.off("error", failed);
      socket.off("room_joined", joined);
      if (error) reject(error);
      else resolve();
    };
    const join = () => socket.emit("join_room", payload);
    const failed = (error) => finish(new Error(error.code ?? "JOIN_FAILED"));
    const joined = () => finish();
    const timer = setTimeout(() => finish(new Error("JOIN_TIMEOUT")), 10000);
    socket.on("connect", join);
    socket.on("connect_error", failed);
    socket.on("error", failed);
    socket.on("room_joined", joined);
    socket.connect();
  });
  return socket;
}

export function translate(sender, receiver, payload) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    let result;
    let acknowledgement;
    const finish = (error) => {
      clearTimeout(timer);
      receiver.off("voice_translation_received", received);
      sender.off("disconnect", disconnected);
      receiver.off("disconnect", disconnected);
      if (error) reject(error);
      else resolve({ ...result, acknowledgement });
    };
    const received = (event) => {
      if (event.segmentId !== payload.segmentId) return;
      result = { event, roundTripMs: Math.round(performance.now() - started) };
      if (acknowledgement) finish();
    };
    const disconnected = () => finish(new Error("SOCKET_DISCONNECTED"));
    const timer = setTimeout(
      () => finish(new Error("TRANSLATION_TIMEOUT")),
      10000,
    );
    receiver.on("voice_translation_received", received);
    sender.on("disconnect", disconnected);
    receiver.on("disconnect", disconnected);
    sender.emit("translate_speech", payload, (ack) => {
      if (ack?.result !== "ok") {
        finish(new Error(ack?.error?.code ?? "TRANSLATION_ACK_FAILED"));
        return;
      }
      acknowledgement = ack;
      if (result) finish();
    });
  });
}
