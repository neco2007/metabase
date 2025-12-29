/**
 * WebRTC通信管理クラス (2025年最新仕様 - ルーム管理・画面共有対応)
 */
export class WebRTCClient {
  constructor() {
    this.pcs = new Map();
    this.localStream = null;
    this.screenStream = null;
    this.onTrackCallback = null;
    this.config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }

  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      return this.localStream;
    } catch (err) {
      throw new Error(`メディア取得失敗: ${err.name}`);
    }
  }

  /**
   * 接続作成とSDP交換
   */
  async createAndExchange(peerId, url, token, extraData = {}) {
    // 既存の接続があれば閉じる（再ネゴシエーション対策）
    if (this.pcs.has(peerId)) {
      this.pcs.get(peerId).close();
    }

    const pc = new RTCPeerConnection(this.config);
    this.pcs.set(peerId, pc);
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
    }
    
    pc.ontrack = (e) => this.onTrackCallback?.(peerId, e.streams[0]);
    await this._negotiate(pc, url, token, extraData);
  }

  /**
   * 内部的なSDP交渉
   */
  async _negotiate(pc, url, token, extraData) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}` 
      },
      // SDPとroom_idをマージして送信
      body: JSON.stringify({ 
        sdp: offer.sdp, 
        type: offer.type,
        ...extraData 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Signaling Error: ${errorText}`);
    }

    const answer = await response.json();
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addScreenShare(url, token, extraData = {}) {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = this.screenStream.getVideoTracks()[0];
      for (const [peerId, pc] of this.pcs) {
        pc.addTrack(track, this.screenStream);
        await this._negotiate(pc, url, token, extraData);
      }
      return this.screenStream;
    } catch (err) {
      throw new Error(`画面共有失敗: ${err.message}`);
    }
  }
}