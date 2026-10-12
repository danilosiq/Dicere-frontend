import type { RoomJoinedPayload } from "@/core/@types/room";
import { getSocket } from "./socket-service";
import { joinRoomWithReconnectRetry, RoomAccessError } from "./room-service";
import { getRoomCredentials } from "./room-reconnect-credentials";
import { speechRecoveryDelay } from "./server-speech/recovery-policy";

type Options = {
  roomId: string;
  participantId: string;
  lost: () => void;
  recovered: (joined: RoomJoinedPayload) => void;
  blocked: (code: string) => void;
};
const transient = new Set([
  "SOCKET_DISCONNECTED",
  "SOCKET_CONNECTION_FAILED",
  "JOIN_ROOM_TIMEOUT",
  "PARTICIPANT_ALREADY_CONNECTED",
  "INTERNAL_ERROR",
  "ROOM_ACCESS_FAILED",
]);

/** Re-admit the same identity; transport reconnect alone is not room membership. */
export class RoomConnectionRecovery {
  socketId = getSocket().id;
  private stopped = false;
  private pending = false;
  private inFlight = false;
  private attempt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private stableTimer?: ReturnType<typeof setTimeout>;
  private readonly abort = new AbortController();
  private readonly visibility = () => {
    if (document.visibilityState === "visible") this.wake();
  };
  private readonly lost = () => {
    if (this.stopped || this.pending) return;
    this.pending = true;
    clearTimeout(this.stableTimer);
    this.options.lost();
    this.schedule();
  };
  private readonly offline = () => {
    if (this.stopped) return;
    this.lost();
    // Re-admission requires a fresh transport, not a half-open authenticated socket.
    getSocket().disconnect();
  };
  private readonly wake = () => {
    if (
      this.stopped ||
      !this.pending ||
      this.inFlight ||
      navigator.onLine === false
    )
      return;
    clearTimeout(this.timer);
    void this.rejoin();
  };

  constructor(private readonly options: Options) {}

  start() {
    getSocket().on("disconnect", this.lost);
    window.addEventListener("offline", this.offline);
    window.addEventListener("online", this.wake);
    document.addEventListener("visibilitychange", this.visibility);
    document.addEventListener("resume", this.wake);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.stableTimer);
    getSocket().off("disconnect", this.lost);
    window.removeEventListener("offline", this.offline);
    window.removeEventListener("online", this.wake);
    document.removeEventListener("visibilitychange", this.visibility);
    document.removeEventListener("resume", this.wake);
    this.abort.abort();
  }

  private schedule() {
    if (this.stopped || !this.pending) return;
    this.attempt++;
    if (navigator.onLine !== false)
      this.timer = setTimeout(
        () => void this.rejoin(),
        speechRecoveryDelay(this.attempt),
      );
  }

  private async rejoin() {
    if (this.stopped || this.inFlight || navigator.onLine === false) return;
    const access = getRoomCredentials(
      this.options.roomId,
      this.options.participantId,
    );
    if (!access) {
      this.pending = false;
      this.stop();
      this.options.blocked("ROOM_ACCESS_REQUIRED");
      return;
    }
    this.inFlight = true;
    try {
      const joined = await joinRoomWithReconnectRetry(
        access.payload,
        this.abort.signal,
      );
      if (this.stopped) return;
      if (
        joined.room.id !== this.options.roomId ||
        joined.participant.id !== this.options.participantId
      ) {
        this.pending = false;
        this.stop();
        this.options.blocked("ROOM_IDENTITY_CHANGED");
        return;
      }
      this.pending = false;
      this.socketId = getSocket().id;
      this.options.recovered(joined);
      this.stableTimer = setTimeout(() => {
        this.attempt = 0;
      }, 30000);
    } catch (error) {
      if (this.stopped) return;
      const code =
        error instanceof RoomAccessError ? error.code : "ROOM_ACCESS_FAILED";
      console.warn("[Dicere][RoomRecovery]", {
        code,
        attempt: this.attempt,
        recovering: transient.has(code),
      });
      if (transient.has(code)) this.schedule();
      else {
        this.pending = false;
        this.stop();
        this.options.blocked(code);
      }
    } finally {
      this.inFlight = false;
    }
  }
}
