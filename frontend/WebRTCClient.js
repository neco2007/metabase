/**
 * WebRTC通信管理クラス (2025 Mesh対応版 - 画面共有高度化)
 */
export class WebRTCClient {
  constructor() {
    this.pcs = new Map();
    this.localStream = null;
    this.screenStream = null;
    this.onTrackCallback = null;
    this.config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }

  // カメラ・マイクの起動
  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      return this.localStream;
    } catch (err) {
      throw new Error(`カメラ取得失敗: ${err.name}`);
    }
  }

  /**
   * 画面共有を追加し、既存の接続に対して再ネゴシエーションを行います
   */
  async addScreenShare(url, token) {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = this.screenStream.getVideoTracks()[0];

      // 全てのPeerConnectionにトラックを追加
      for (const [peerId, pc] of this.pcs) {
        pc.addTrack(track, this.screenStream);
        await this._negotiate(pc, url, token); // 追加後に再SDP交換
      }

      track.onended = () => this.stopScreenShare(url, token);
      return this.screenStream;
    } catch (err) {
      throw new Error(`画面共有開始失敗: ${err.message}`);
    }
  }

  /**
   * 画面共有を停止し、接続から削除します
   */
  async stopScreenShare(url, token) {
    if (!this.screenStream) return;

    const track = this.screenStream.getVideoTracks()[0];
    for (const [peerId, pc] of this.pcs) {
      const sender = pc.getSenders().find(s => s.track === track);
      if (sender) pc.removeTrack(sender);
      await this._negotiate(pc, url, token); // 削除後に再SDP交換
    }

    this.screenStream.getTracks().forEach(t => t.stop());
    this.screenStream = null;
  }

  async createAndExchange(peerId, url, token) {
    const pc = new RTCPeerConnection(this.config);
    this.pcs.set(peerId, pc);
    
    // カメラトラックを追加
    this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
    
    pc.ontrack = (e) => this.onTrackCallback?.(peerId, e.streams[0]);
    await this._negotiate(pc, url, token);
  }

  async _negotiate(pc, url, token) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ sdp: offer.sdp, type: offer.type }),
    });

    const answer = await response.json();
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}