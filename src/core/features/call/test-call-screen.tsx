"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/core/components/button";
import { Column } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import {
  connectSocket,
  disconnectSocket,
} from "@/core/services/socket-service";

import { CallExperience } from ".";

type SocketConnectionState = "connecting" | "connected" | "error";

export function TestCallScreen() {
  const router = useRouter();
  const [connectionState, setConnectionState] =
    useState<SocketConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    let socket: ReturnType<typeof connectSocket> | null = null;

    const handleConnect = () => {
      setConnectionState("connected");
      setErrorMessage(null);
    };

    const handleConnectError = (cause: Error) => {
      setConnectionState("error");
      setErrorMessage(
        cause.message || "Não foi possível conectar ao servidor da chamada.",
      );
    };

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      try {
        socket = connectSocket();
        socket.on("connect", handleConnect);
        socket.on("connect_error", handleConnectError);

        if (socket.connected) {
          handleConnect();
        }
      } catch (cause: unknown) {
        setConnectionState("error");
        setErrorMessage(
          cause instanceof Error
            ? cause.message
            : "Não foi possível preparar a conexão da chamada.",
        );
      }
    });

    return () => {
      isCancelled = true;
      socket?.off("connect", handleConnect);
      socket?.off("connect_error", handleConnectError);
      disconnectSocket();
    };
  }, [connectionAttempt]);

  const retryConnection = () => {
    setConnectionState("connecting");
    setErrorMessage(null);
    setConnectionAttempt((attempt) => attempt + 1);
  };

  if (connectionState === "connected") {
    return (
      <CallExperience
        title="Teste de chamada"
        onLeave={() => router.push("/")}
      />
    );
  }

  return (
    <main className="bg-background text-foreground grid min-h-screen place-items-center p-6">
      <Column className="bg-component border-border w-full max-w-md items-center gap-5 rounded-2xl border p-8 text-center shadow-sm">
        <Typography fontFamily="baloo2" fontWeight="semibold" size="xl">
          Teste de chamada
        </Typography>

        <Typography className="text-gray-400 dark:text-gray-200">
          {connectionState === "connecting"
            ? "Conectando ao servidor da chamada..."
            : errorMessage}
        </Typography>

        {connectionState === "error" && (
          <Button
            label="Tentar novamente"
            startIcon={<RefreshCw />}
            onClick={retryConnection}
          />
        )}
      </Column>
    </main>
  );
}
