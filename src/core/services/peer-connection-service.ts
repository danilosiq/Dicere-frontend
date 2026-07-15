export const DEFAULT_ICE_SERVERS = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
] satisfies RTCIceServer[];

export const DEFAULT_PEER_CONNECTION_CONFIGURATION = {
  iceServers: DEFAULT_ICE_SERVERS,
} satisfies RTCConfiguration;

type CreatePeerConnectionParams = {
  configuration?: RTCConfiguration;
};

type SyncLocalStreamTracksParams = {
  peerConnection: RTCPeerConnection;
  stream: MediaStream | null;
};

type ClosePeerConnectionParams = {
  peerConnection: RTCPeerConnection | null;
};

export function createPeerConnection({
  configuration = DEFAULT_PEER_CONNECTION_CONFIGURATION,
}: CreatePeerConnectionParams = {}) {
  if (typeof RTCPeerConnection === "undefined") {
    const error = new Error(
      "O navegador não oferece suporte a chamadas WebRTC.",
    );
    error.name = "NotSupportedError";
    throw error;
  }

  return new RTCPeerConnection(configuration);
}

export function syncLocalStreamTracks({
  peerConnection,
  stream,
}: SyncLocalStreamTracksParams) {
  const localTracks = new Set(stream?.getTracks() ?? []);

  peerConnection.getSenders().forEach((sender) => {
    if (sender.track && !localTracks.has(sender.track)) {
      peerConnection.removeTrack(sender);
    }
  });

  if (!stream) {
    return;
  }

  const senderTracks = new Set(
    peerConnection
      .getSenders()
      .map((sender) => sender.track)
      .filter((track): track is MediaStreamTrack => track !== null),
  );

  stream.getTracks().forEach((track) => {
    if (!senderTracks.has(track)) {
      peerConnection.addTrack(track, stream);
    }
  });
}

export function closePeerConnection({
  peerConnection,
}: ClosePeerConnectionParams) {
  if (!peerConnection) {
    return;
  }

  peerConnection.onconnectionstatechange = null;
  peerConnection.oniceconnectionstatechange = null;
  peerConnection.onicegatheringstatechange = null;
  peerConnection.onsignalingstatechange = null;
  peerConnection.ontrack = null;

  if (peerConnection.signalingState !== "closed") {
    peerConnection.close();
  }
}
