import type { Metadata } from "next";

import { TestCallScreen } from "@/core/features/call/test-call-screen";

export const metadata: Metadata = {
  title: "Teste de chamada",
  description: "Página temporária para validar câmera, microfone e WebRTC.",
};

export default function TestCallPage() {
  return <TestCallScreen />;
}
