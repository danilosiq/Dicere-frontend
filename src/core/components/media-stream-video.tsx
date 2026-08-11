"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/core/utils/cn";

type MediaStreamVideoProps = {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
};

export function MediaStreamVideo({
  stream,
  label,
  muted = false,
  mirrored = false,
  className,
}: MediaStreamVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = stream;

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      aria-label={label}
      autoPlay
      className={cn(
        "h-full w-full bg-gray-900 object-cover",
        mirrored && "-scale-x-100",
        className,
      )}
      muted={muted}
      playsInline
    />
  );
}
