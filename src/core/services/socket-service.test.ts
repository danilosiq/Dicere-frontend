import { afterEach, beforeEach, expect, it, vi } from "vitest";

const socket = vi.hoisted(() => ({
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("socket.io-client", () => ({ io: () => socket }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "http://localhost:3333");
});
afterEach(() => vi.unstubAllEnvs());

it("cancels pending connection/reconnection even before the socket connects", async () => {
  const service = await import("./socket-service");
  service.connectSocket();
  expect(socket.connect).toHaveBeenCalledOnce();
  service.disconnectSocket();
  expect(socket.disconnect).toHaveBeenCalledOnce();
});
