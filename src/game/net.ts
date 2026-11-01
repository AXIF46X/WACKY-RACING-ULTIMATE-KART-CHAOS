// ============================================================================
// WebRTC P2P rooms with manual signaling (invite/answer codes).
// Host is authoritative for bots + race results; peers send their kart state.
// Uses public STUN only. Everything is guarded so it never crashes SSR.
// ============================================================================

export interface RoomPeer {
  id: string;
  name: string;
  channel: RTCDataChannel | null;
}

export type RoomMessageHandler = (from: string, data: unknown) => void;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

function encode(desc: RTCSessionDescriptionInit & { v?: number }): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(desc))));
}

function decode(code: string): RTCSessionDescriptionInit {
  return JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as RTCSessionDescriptionInit;
}

async function waitForIce(pc: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

export class P2PRoom {
  role: "host" | "peer";
  readonly peerId: string;
  readonly name: string;
  peers = new Map<string, RoomPeer>();
  onMessage: RoomMessageHandler | null = null;
  onPeerJoin: ((p: RoomPeer) => void) | null = null;
  onPeerLeave: ((peerId: string) => void) | null = null;
  onClose: (() => void) | null = null;
  closed = false;
  private conns = new Map<string, RTCPeerConnection>();

  constructor(role: "host" | "peer", name: string) {
    this.role = role;
    this.name = name;
    this.peerId = Math.random().toString(36).slice(2, 10);
  }

  /** host: create offer for a new peer slot */
  async createInvite(peerName: string): Promise<string> {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerId = Math.random().toString(36).slice(2, 10);
    const channel = pc.createDataChannel("wacky");
    this.setupPeer(pc, peerId, peerName, channel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIce(pc);
    const desc = pc.localDescription?.toJSON() ?? offer;
    return encode({ ...desc, peerId, peerName } as RTCSessionDescriptionInit & { peerId: string; peerName: string });
  }

  /** peer: consume an invite, produce an answer */
  async joinWithInvite(invite: string, name: string): Promise<string> {
    const data = decode(invite) as RTCSessionDescriptionInit & { peerId?: string };
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const hostId = data.peerId ?? "host";
    this.setupPeer(pc, hostId, "host", null);
    await pc.setRemoteDescription(data);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIce(pc);
    const desc = pc.localDescription?.toJSON() ?? answer;
    return encode(desc);
  }

  /** host: accept a peer's answer */
  async acceptAnswer(answerCode: string): Promise<void> {
    const pc = [...this.conns.values()].find((c) => c.signalingState === "have-local-offer");
    if (!pc) throw new Error("No pending invite — create an invite first.");
    await pc.setRemoteDescription(decode(answerCode));
  }

  private setupPeer(pc: RTCPeerConnection, peerId: string, peerName: string, channel: RTCDataChannel | null): void {
    this.conns.set(peerId, pc);
    const peer: RoomPeer = { id: peerId, name: peerName, channel };
    pc.onicecandidate = () => { /* gathering awaited explicitly */ };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        if (this.peers.has(peerId)) {
          this.peers.delete(peerId);
          this.onPeerLeave?.(peerId);
        }
      }
    };
    const attach = (ch: RTCDataChannel) => {
      peer.channel = ch;
      this.peers.set(peerId, peer);
      this.onPeerJoin?.(peer);
      ch.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as unknown;
          this.onMessage?.(peerId, data);
        } catch { /* ignore malformed */ }
      };
      ch.onclose = () => {
        if (this.peers.has(peerId)) {
          this.peers.delete(peerId);
          this.onPeerLeave?.(peerId);
        }
      };
    };
    if (channel) attach(channel);
    pc.ondatachannel = (ev) => attach(ev.channel);
  }

  send(data: unknown, target?: string): void {
    if (this.closed) return;
    const payload = JSON.stringify(data);
    for (const [id, peer] of this.peers) {
      if (target && id !== target) continue;
      try { peer.channel?.send(payload); } catch { /* ignore */ }
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const pc of this.conns.values()) {
      try { pc.close(); } catch { /* ignore */ }
    }
    this.conns.clear();
    this.peers.clear();
    this.onClose?.();
  }
}

export interface HostSession { room: P2PRoom; invite: string; }
export interface JoinSession { room: P2PRoom; answer: string; }

export function isWebRTCAvailable(): boolean {
  return typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined";
}

export async function hostRoom(name: string): Promise<HostSession> {
  if (!isWebRTCAvailable()) throw new Error("WebRTC is not available in this browser.");
  const room = new P2PRoom("host", name);
  const invite = await room.createInvite("friend");
  return { room, invite };
}

export async function joinRoom(invite: string, name: string): Promise<JoinSession> {
  if (!isWebRTCAvailable()) throw new Error("WebRTC is not available in this browser.");
  const room = new P2PRoom("peer", name);
  const answer = await room.joinWithInvite(invite, name);
  return { room, answer };
}
