import { RoomRouteGate } from "@/core/features/room/utils/room-route-gate";

export default async function RoomByCode({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <RoomRouteGate roomCode={id} />;
}
