"use client";

import { Column, Row } from "@/core/components/layout";
import { useCallSession } from "@/core/hooks/use-call-session";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import { useParams, useRouter } from "next/navigation";
import { ChatSection } from "./components/chat/chat-section";
import { CallTools } from "./components/video/call-tools";
import { VideoSection } from "./components/video/video-section";

export function RoomScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const call = useCallSession();
  const clearRoomSession = useRoomSessionStore((state) => state.clearSession);

  function handleLeaveCall() {
    call.leaveCall();
    clearRoomSession();
    router.replace("/");
  }

  return (
    <Column className="h-screen flex-1">
      <Row className="flex-1">
        <VideoSection call={call} />
        <ChatSection />
      </Row>
      <CallTools
        callCode={id}
        hasCamera={call.hasCamera}
        hasMicrophone={call.hasMicrophone}
        isLeaving={call.isLeaving}
        isMuted={!call.microphoneEnabled}
        isVideoEnabled={call.cameraEnabled}
        onLeave={handleLeaveCall}
        onMute={call.toggleMicrophone}
        onToggleVideo={call.toggleCamera}
      />
    </Column>
  );
}
