import type {
  SpeechRecognitionDiagnosticCode,
  SpeechRecognitionDiagnosticPayload,
  SpeechRecognitionMode,
} from "@/core/@types/socket-events";
import { getSocket } from "@/core/services/socket-service";

export type SpeechRecognitionDiagnosticInput = {
  code: SpeechRecognitionDiagnosticCode;
  fallbackStatus?: SpeechRecognitionDiagnosticPayload["fallbackStatus"];
  sourceError?: SpeechRecognitionDiagnosticCode;
  errorName?: string;
  locale: string;
  mode: SpeechRecognitionMode;
  retryAttempt: number;
  stage: SpeechRecognitionDiagnosticPayload["stage"];
};

async function getMicrophonePermission() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown" as const;
  }

  try {
    const permission = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return permission.state;
  } catch {
    return "unknown" as const;
  }
}

function resolveDiagnosticReason(
  input: SpeechRecognitionDiagnosticInput,
  environment: {
    microphonePermission: PermissionState | "unknown";
    online: boolean;
    secureContext: boolean;
  },
): SpeechRecognitionDiagnosticPayload["reason"] {
  if (!environment.online) return "OFFLINE";
  if (!environment.secureContext) return "INSECURE_CONTEXT";
  if (environment.microphonePermission === "denied") {
    return "MICROPHONE_PERMISSION_DENIED";
  }

  switch (input.code) {
    case "network":
      return "REMOTE_SERVICE_NETWORK_FAILURE";
    case "not-allowed":
      return "MICROPHONE_PERMISSION_DENIED";
    case "service-not-allowed":
      return "RECOGNITION_SERVICE_BLOCKED";
    case "audio-capture":
      return "AUDIO_CAPTURE_UNAVAILABLE";
    case "language-not-supported":
      return "LANGUAGE_NOT_SUPPORTED";
    case "unsupported-browser":
      return "BROWSER_UNSUPPORTED";
    case "local-fallback-activated":
      return "ON_DEVICE_FALLBACK_ACTIVATED";
    case "local-fallback-failed":
      return "ON_DEVICE_FALLBACK_FAILED";
    case "local-fallback-unavailable":
      return "ON_DEVICE_FALLBACK_UNAVAILABLE";
    case "start-failed":
      return "RECOGNITION_START_FAILED";
    default:
      return "UNKNOWN_RECOGNITION_FAILURE";
  }
}

function writeDiagnosticToConsole(payload: SpeechRecognitionDiagnosticPayload) {
  const label = "[Dicere][SpeechRecognition]";

  if (payload.code === "local-fallback-activated") {
    console.info(label, payload);
    return;
  }

  if (
    payload.code === "network" ||
    payload.code === "local-fallback-unavailable"
  ) {
    console.warn(label, payload);
    return;
  }

  console.error(label, payload);
}

export async function reportSpeechRecognitionDiagnostic(
  input: SpeechRecognitionDiagnosticInput,
) {
  const microphonePermission = await getMicrophonePermission();
  const online = typeof navigator === "undefined" ? false : navigator.onLine;
  const secureContext = globalThis.isSecureContext ?? false;
  const payload: SpeechRecognitionDiagnosticPayload = {
    ...input,
    microphonePermission,
    occurredAt: new Date().toISOString(),
    online,
    reason: resolveDiagnosticReason(input, {
      microphonePermission,
      online,
      secureContext,
    }),
    secureContext,
    userAgent:
      typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
    visibilityState:
      typeof document === "undefined" ? "unknown" : document.visibilityState,
  };

  writeDiagnosticToConsole(payload);

  try {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("speech_recognition_diagnostic", payload);
    }
  } catch {
    // O console local continua sendo o fallback quando o socket não existe.
  }
}
