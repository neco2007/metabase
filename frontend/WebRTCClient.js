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

  /**
   * カメラ・マイクのストリームを開始します。
   */
  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      return this.localStream;
    } catch (err) {
      console.error("メディア取得失敗:", err);
      throw new Error(`カメラ・マイクの取得に失敗しました: ${err.name}`);
    }
  }

  /**
   * 新規接続を作成し、サーバーとSDP交換を行います。
   * @param {string} peerId 接続先ID
   * @param {string} url シグナリングURL
   * @param {string} token JWTトークン
   * @param {Object} extraData 追加データ (room_id など)
   */
  async createAndExchange(peerId, url, token, extraData = {}) {
    const pc = new RTCPeerConnection(this.config);
    this.pcs.set(peerId, pc);
    
    // 自分のトラック（カメラ映像等）を接続に追加
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
    }
    
    // 相手のトラックを受信した時の処理
    pc.ontrack = (e) => {
      console.log(`トラック受信: ${peerId}`);
      this.onTrackCallback?.(peerId, e.streams[0]);
    };

    await this._negotiate(pc, url, token, extraData);
  }

  /**
   * 画面共有を追加し、再交渉を行います。
   */
  async addScreenShare(url, token, extraData = {}) {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = this.screenStream.getVideoTracks()[0];

      for (const [peerId, pc] of this.pcs) {
        pc.addTrack(track, this.screenStream);
        await this._negotiate(pc, url, token, extraData);
      }

      track.onended = () => this.stopScreenShare(url, token, extraData);
      return this.screenStream;
    } catch (err) {
      throw new Error(`画面共有開始失敗: ${err.message}`);
    }
  }

  /**
   * 画面共有を停止します。
   */
  async stopScreenShare(url, token, extraData = {}) {
    if (!this.screenStream) return;

    const track = this.screenStream.getVideoTracks()[0];
    for (const [peerId, pc] of this.pcs) {
      const sender = pc.getSenders().find(s => s.track === track);
      if (sender) pc.removeTrack(sender);
      await this._negotiate(pc, url, token, extraData);
    }

    this.screenStream.getTracks().forEach(t => t.stop());
    this.screenStream = null;
  }

  /**
   * 内部的なSDP交渉ロジック。
   * 2025年仕様として、room_id 等のメタデータを body に含めて送信します。
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
      // SDPに加えて room_id (locationName) を一緒に送る
      body: JSON.stringify({ 
        sdp: offer.sdp, 
        type: offer.type,
        ...extraData 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`サーバーエラー: ${errorText}`);
    }

    const answer = await response.json();
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("SDP交換が完了しました。");
  }
}