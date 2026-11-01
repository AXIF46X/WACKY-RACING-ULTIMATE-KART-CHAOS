// ============================================================================
// WACKY RACING — real peer-to-peer multiplayer over WebRTC DataChannels.
// Room codes are copy/paste invite codes (manual signaling, no server needed).
// Star topology: guests connect to the host, host relays messages.
// ============================================================================

export interface PeerRecord {
  id: string;
  name: string;
  vehicle: string;
  character: string;
  paint: string;
}

export type NetMsg = Record<string, unknown> & { t: string };

const RTC_CFG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }, { urls: ["stun:stun1.l.google.com:19302"] }],
};

function encodeSDP(desc: RTCSessionDescriptionInit): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(desc))));
}
function decodeSDP(code: string): RTCSessionDescriptionInit {
  const cleaned = code.trim().replace(/\s+/g, "");
  return JSON.parse(decodeURIComponent(escape(atob(cleaned))));
}

function waitIce(pc: RTCPeerConnection, ms = 3500): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const to = setTimeout(() => resolve(), ms);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(to);
        resolve();
      }
    });
  });
}

interface Conn {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  open: boolean;
}

export class P2PRoom {
  isHost: boolean;
  selfId: string;
  conns = new Map<string, Conn>();
  peers: PeerRecord[] = [];
  me: PeerRecord;
  private msgCbs = new Set<(from: string, m: NetMsg) => void>();
  private joinCbs = new Set<(p: PeerRecord) => void>();
  private leftCbs = new Set<(id: string) => void>();
  private openCbs = new Set<(id: string) => void>();

  constructor(isHost: boolean, self: PeerRecord) {
    this.isHost = isHost;
    this.selfId = self.id;
    this.me = self;
  }

  static genId(): string {
    return Math.random().toString(36).slice(2, 8);
  }

  // --- host side ------------------------------------------------------------
  static createHost(self: PeerRecord): P2PRoom {
    return new P2PRoom(true, self);
  }

  // Host generates an invite code for a NEW guest slot.
  async makeInvite(guestId: string): Promise<string> {
    const pc = new RTCPeerConnection(RTC_CFG);
    const dc = pc.createDataChannel("wacky", { ordered: true });
    const conn: Conn = { pc, dc, open: false };
    this.conns.set(guestId, conn);
    this.setupHostConn(guestId, conn);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);
    return encodeSDP(pc.localDescription!);
  }

  async acceptAnswer(guestId: string, answerCode: string) {
    const conn = this.conns.get(guestId);
    if (!conn) throw new Error("Unknown guest slot");
    await conn.pc.setRemoteDescription(decodeSDP(answerCode));
  }

  private setupHostConn(guestId: string, conn: Conn) {
    const dc = conn.dc!;
    dc.onopen = () => {
      conn.open = true;
      this.emitOpen(guestId);
      // ask for identity
      this.sendTo(guestId, { t: "who", hello: "host" });
    };
    dc.onclose = () => this.handleClosed(guestId);
    conn.pc.onconnectionstatechange = () => {
      const st = conn.pc.connectionState;
      if (st === "failed" || st === "disconnected" || st === "closed") this.handleClosed(guestId);
    };
    dc.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data as string) as NetMsg;
        this.emitMsg(guestId, m);
        // rebroadcast to other guests (star relay)
        if (m.t !== "who" && m.t !== "hello") {
          for (const [id, c] of this.conns) {
            if (id !== guestId && c.open) c.dc?.send(JSON.stringify({ ...m, __from: guestId }));
          }
        }
      } catch { /* junk */ }
    };
  }

  // --- guest side -----------------------------------------------------------
  static async join(inviteCode: string, self: PeerRecord): Promise<{ room: P2PRoom; answer: string }> {
    const room = new P2PRoom(false, self);
    const pc = new RTCPeerConnection(RTC_CFG);
    const conn: Conn = { pc, dc: null, open: false };
    room.conns.set("host", conn);
    pc.ondatachannel = (ev) => {
      conn.dc = ev.channel;
      conn.dc.onopen = () => {
        conn.open = true;
        room.emitOpen("host");
        // send identity
        room.sendRaw({ t: "hello", peer: self });
      };
      conn.dc.onclose = () => room.handleClosed("host");
      conn.dc.onmessage = (ev2) => {
        try {
          const m = JSON.parse(ev2.data as string) as NetMsg & { __from?: string };
          const origin = m.__from ?? "host-player";
          room.emitMsg(origin, m);
        } catch { /* junk */ }
      };
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "failed" || st === "disconnected" || st === "closed") room.handleClosed("host");
    };
    await pc.setRemoteDescription(decodeSDP(inviteCode));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIce(pc);
    return { room, answer: encodeSDP(pc.localDescription!) };
  }

  // --- common ---------------------------------------------------------------
  sendRaw(m: NetMsg) {
    const s = JSON.stringify(m);
    for (const c of this.conns.values()) {
      if (c.open && c.dc?.readyState === "open") c.dc.send(s);
    }
  }

  send(m: NetMsg) {
    if (this.isHost) {
      const s = JSON.stringify({ ...m, __from: "host-player" });
      for (const c of this.conns.values()) if (c.open && c.dc?.readyState === "open") c.dc.send(s);
    } else {
      this.sendRaw(m);
    }
  }

  sendTo(id: string, m: NetMsg) {
    const c = this.conns.get(id);
    if (c?.open && c.dc?.readyState === "open") c.dc.send(JSON.stringify(m));
  }

  onMessage(cb: (from: string, m: NetMsg) => void): () => void {
    this.msgCbs.add(cb);
    return () => this.msgCbs.delete(cb);
  }
  onPeerJoined(cb: (p: PeerRecord) => void): () => void {
    this.joinCbs.add(cb);
    return () => this.joinCbs.delete(cb);
  }
  onPeerLeft(cb: (id: string) => void): () => void {
    this.leftCbs.add(cb);
    return () => this.leftCbs.delete(cb);
  }
  onOpen(cb: (id: string) => void): () => void {
    this.openCbs.add(cb);
    return () => this.openCbs.delete(cb);
  }

  registerPeer(p: PeerRecord) {
    if (!this.peers.find((x) => x.id === p.id)) {
      this.peers.push(p);
      this.joinCbs.forEach((cb) => cb(p));
    }
  }

  private pendingSlot: string | null = null;
  tagPending(slotId: string) { this.pendingSlot = slotId; }

  // Re-key the most recent pending guest slot to the guest's real peer id
  // (called by the host UI when the guest's hello arrives).
  rekeyLastTo(newId: string) {
    const oldId = this.pendingSlot;
    if (!oldId || oldId === newId) return;
    const conn = this.conns.get(oldId);
    if (!conn) return;
    this.conns.delete(oldId);
    this.conns.set(newId, conn);
    this.pendingSlot = null;
  }

  private handleClosed(id: string) {
    const c = this.conns.get(id);
    if (c && c.open) {
      c.open = false;
      this.peers = this.peers.filter((p) => p.id !== id && !(c.dc ? false : false));
      this.peers = this.peers.filter((p) => p.id !== id);
      this.leftCbs.forEach((cb) => cb(id));
    }
    try { c?.pc.close(); } catch { /*noop*/ }
  }

  private emitMsg(from: string, m: NetMsg) {
    this.msgCbs.forEach((cb) => cb(from, m));
  }
  private emitOpen(id: string) {
    this.openCbs.forEach((cb) => cb(id));
  }

  close() {
    for (const c of this.conns.values()) {
      try { c.dc?.close(); } catch { /*noop*/ }
      try { c.pc.close(); } catch { /*noop*/ }
    }
    this.conns.clear();
    this.msgCbs.clear();
    this.joinCbs.clear();
    this.leftCbs.clear();
    this.openCbs.clear();
  }
}
