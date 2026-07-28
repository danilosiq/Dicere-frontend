export class MockMediaStreamTrack extends EventTarget {
  enabled = true;
  readyState: MediaStreamTrackState = "live";
  stopped = false;

  constructor(
    readonly kind: "audio" | "video",
    readonly id = `${kind}-${crypto.randomUUID()}`,
  ) {
    super();
  }

  stop() {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}

export class MockMediaStream {
  private readonly tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.tracks = [...tracks];
  }

  getTracks() {
    return [...this.tracks];
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "audio");
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === "video");
  }

  addTrack(track: MockMediaStreamTrack) {
    if (!this.tracks.includes(track)) {
      this.tracks.push(track);
    }
  }

  removeTrack(track: MockMediaStreamTrack) {
    const index = this.tracks.indexOf(track);

    if (index >= 0) {
      this.tracks.splice(index, 1);
    }
  }
}

export class MockRtcIceCandidate {
  constructor(private readonly value: RTCIceCandidateInit) {}

  toJSON() {
    return this.value;
  }
}

export class MockPeerConnection extends EventTarget {
  static instances: MockPeerConnection[] = [];

  connectionState: RTCPeerConnectionState = "new";
  iceConnectionState: RTCIceConnectionState = "new";
  iceGatheringState: RTCIceGatheringState = "new";
  signalingState: RTCSignalingState = "stable";
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  onsignalingstatechange: (() => void) | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  readonly configuration: RTCConfiguration | undefined;
  readonly senders: Array<{ track: MockMediaStreamTrack | null }> = [];
  readonly addedIceCandidates: RTCIceCandidateInit[] = [];
  createOfferCalls = 0;
  createAnswerCalls = 0;
  restartIceCalls = 0;
  closed = false;
  onSetLocalDescription?: () => void;

  constructor(configuration?: RTCConfiguration) {
    super();
    this.configuration = configuration;
    MockPeerConnection.instances.push(this);
  }

  getSenders() {
    return this.senders as unknown as RTCRtpSender[];
  }

  addTrack(track: MockMediaStreamTrack) {
    const sender = { track };
    this.senders.push(sender);
    return sender as unknown as RTCRtpSender;
  }

  removeTrack(sender: RTCRtpSender) {
    const index = this.senders.indexOf(
      sender as unknown as { track: MockMediaStreamTrack | null },
    );

    if (index >= 0) {
      this.senders.splice(index, 1);
    }
  }

  async createOffer() {
    this.createOfferCalls += 1;
    return {
      type: "offer" as const,
      sdp: `offer-${this.createOfferCalls}`,
    };
  }

  async createAnswer() {
    this.createAnswerCalls += 1;
    return {
      type: "answer" as const,
      sdp: `answer-${this.createAnswerCalls}`,
    };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description as RTCSessionDescription;
    this.signalingState =
      description.type === "offer" ? "have-local-offer" : "stable";
    this.onSetLocalDescription?.();
    this.onsignalingstatechange?.();
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description as RTCSessionDescription;
    this.signalingState =
      description.type === "offer" ? "have-remote-offer" : "stable";
    this.onsignalingstatechange?.();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    this.addedIceCandidates.push(candidate);
  }

  restartIce() {
    this.restartIceCalls += 1;
  }

  close() {
    this.closed = true;
    this.connectionState = "closed";
    this.signalingState = "closed";
  }

  emitIceCandidate(candidate: RTCIceCandidate | null) {
    const event = Object.assign(new Event("icecandidate"), { candidate });
    this.dispatchEvent(event);
    this.onicecandidate?.(event as RTCPeerConnectionIceEvent);
  }

  emitRemoteTrack(track: MockMediaStreamTrack) {
    this.ontrack?.({ track } as unknown as RTCTrackEvent);
  }

  setConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

export function installWebRtcGlobals() {
  MockPeerConnection.instances = [];
  vi.stubGlobal("MediaStream", MockMediaStream);
  vi.stubGlobal("RTCPeerConnection", MockPeerConnection);
}
import { vi } from "vitest";
