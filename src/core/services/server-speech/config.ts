const roomIdPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function isServerSpeechEnabled(roomId?: string) {
  // The current release is pilot-only. A legacy global flag cannot bypass
  // the unresolved quality/capacity gates or widen the selected rooms.
  if (!roomId) return false;
  const rooms = (process.env.NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS ?? "")
    .split(",")
    .map((value) => value.trim());
  // This selects the UI only. The backend independently authorizes the room,
  // participant and pilot; public room ids are never credentials.
  return (
    rooms.length <= 10 &&
    rooms.every((value) => roomIdPattern.test(value)) &&
    rooms.includes(roomId)
  );
}
