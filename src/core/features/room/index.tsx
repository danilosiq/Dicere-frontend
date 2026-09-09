"use client";

import { Column, Row } from "@/core/components/layout";
import { useCallSession } from "@/core/hooks/use-call-session";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatSection } from "./components/chat/chat-section";
import {
  CallTools,
  type CopyInviteStatus,
} from "./components/video/call-tools";
import { VideoSection } from "./components/video/video-section";

export function RoomScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const call = useCallSession();
  const [copyInviteStatus, setCopyInviteStatus] =
    useState<CopyInviteStatus>("idle");
  const clearRoomSession = useRoomSessionStore((state) => state.clearSession);

  useEffect(() => {
    if (
      !call.termination ||
      call.termination.type === "participant-left" ||
      call.termination.type === "socket-disconnected"
    ) {
      return;
    }

    clearRoomSession();
    router.replace("/");
  }, [call.termination, clearRoomSession, router]);

  useEffect(() => {
    if (copyInviteStatus === "idle" || copyInviteStatus === "copying") return;

    const resetCopyStatus = window.setTimeout(
      () => setCopyInviteStatus("idle"),
      2_000,
    );

    return () => window.clearTimeout(resetCopyStatus);
  }, [copyInviteStatus]);

  function handleLeaveCall() {
    call.leaveCall();
    clearRoomSession();
    router.replace("/");
  }

  async function handleCopyInviteLink() {
    if (copyInviteStatus === "copying") return;

    setCopyInviteStatus("copying");

    try {
      const roomCode = id.trim();

      if (!roomCode || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      const inviteLink = new URL(
        `/room/${encodeURIComponent(roomCode)}`,
        window.location.origin,
      ).toString();

      await navigator.clipboard.writeText(inviteLink);
      setCopyInviteStatus("success");
    } catch {
      setCopyInviteStatus("error");
    }
  }

  return (
    <Column className="h-screen flex-1">
      <Row className="min-h-0 flex-1 flex-col sm:flex-row">
        <VideoSection call={call} />
        <ChatSection />
      </Row>
      <CallTools
        copyInviteStatus={copyInviteStatus}
        hasCamera={call.hasCamera}
        hasMicrophone={call.hasMicrophone}
        isLeaving={call.isLeaving}
        isMuted={!call.microphoneEnabled}
        isVideoEnabled={call.cameraEnabled}
        onLeave={handleLeaveCall}
        onCopyInviteLink={handleCopyInviteLink}
        onMute={call.toggleMicrophone}
        onToggleVideo={call.toggleCamera}
      />
    </Column>
  );
}
