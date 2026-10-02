import { io } from "socket.io-client";
import { randomUUID } from "node:crypto";

function waitEvent(socket, event, action) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new Error("PROBE_EVENT_TIMEOUT")),
      5000,
    );
    const success = (value) => finish(null, value);
    const failure = (value) =>
      finish(new Error(value?.code ?? "PROBE_SOCKET_FAILED"));
    function finish(error, value) {
      clearTimeout(timer);
      socket.off(event, success);
      socket.off("error", failure);
      socket.off("connect_error", failure);
      error ? reject(error) : resolve(value);
    }
    socket.once(event, success);
    socket.once("error", failure);
    socket.once("connect_error", failure);
    action();
  });
}

export async function probeRoom(apiUrl, targetLanguage) {
  const password = randomUUID();
  const response = await fetch(`${apiUrl}/room`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Ensaio privado multilíngue",
      password,
      participantName: "Motor QA",
      targetLanguage,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("PROBE_CREATE_ROOM_FAILED");
  const { data: room } = await response.json();
  const clients = [];
  const close = async () => {
    clients.forEach((client) => client.disconnect());
    const result = await fetch(`${apiUrl}/room/${room.roomId}`, {
      method: "PATCH",
      signal: AbortSignal.timeout(5000),
    });
    if (!result.ok) throw new Error("PROBE_CLEANUP_FAILED");
  };
  try {
    for (let index = 0; index < 2; index++) {
      const client = io(apiUrl, {
        autoConnect: false,
        transports: ["websocket"],
        reconnection: false,
      });
      clients.push(client);
      await waitEvent(client, "connect", () => client.connect());
      await waitEvent(client, "room_joined", () =>
        client.emit("join_room", {
          roomCode: room.code,
          password,
          nickname: index ? "Destinatário QA" : "Motor QA",
          targetLanguage,
          ...(index ? {} : { participantId: room.adminParticipantId }),
        }),
      );
    }
    return {
      roomId: room.roomId,
      sender: clients[0],
      receiver: clients[1],
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function speechAck(socket, event, payload) {
  const response = await socket.timeout(5000).emitWithAck(event, payload);
  if (response.result !== "ok")
    throw new Error(response.code ?? "PROBE_ACK_FAILED");
  return response;
}
