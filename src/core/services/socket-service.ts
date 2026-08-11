import { io, type Socket } from "socket.io-client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/core/@types/socket-events";

export type DicereSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: DicereSocket | null = null;

function getSocketUrl() {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

  if (!socketUrl) {
    throw new Error("A URL do servidor Socket.IO não foi configurada.");
  }

  return socketUrl;
}

export function getSocket() {
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      transports: ["websocket"],
    });
  }

  return socket;
}

export function connectSocket() {
  const currentSocket = getSocket();

  if (!currentSocket.connected) {
    currentSocket.connect();
  }

  return currentSocket;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
