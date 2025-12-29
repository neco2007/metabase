/**
 * WebRTC通信管理クラス (2025年 永続接続・再交渉・ルーム管理対応)
 */
export class WebRTCClient {
  constructor() {
    this.pcs = new Map(); // peerId -> RTCPeerConnection
    this.localStream = null;
    this.screenStream = null;
    this.onTrackCallback = null;
    this.config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }

  /**
   * カメラ・マイクのストリームを開始
   */
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
   * 接続作成または取得、およびSDP交換（再交渉対応）
   */
  async createAndExchange(peerId, url, token, extraData = {}) {
    let pc = this.pcs.get(peerId);
    
    // 既存の接続がなければ新しく作成、あればそのまま使う
    if (!pc || pc.connectionState === 'closed') {
      pc = this._setupNewPeerConnection(peerId);
    }

    // 最新のSDP交渉を実行
    await this._negotiate(pc, url, token, extraData);
  }

  /**
   * 新しいPeerConnectionの初期設定
   */
  _setupNewPeerConnection(peerId) {
    const pc = new RTCPeerConnection(this.config);
    this.pcs.set(peerId, pc);

    // 自分のカメラ等の初期トラックを登録
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
    }

    // 相手の映像を受信した時のイベント
    pc.ontrack = (e) => {
      console.log(`Track受信: ${peerId}`);
      this.onTrackCallback?.(peerId, e.streams[0]);
    };

    return pc;
  }

  /**
   * 画面共有の追加
   */
  async addScreenShare(url, token, extraData = {}) {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = this.screenStream.getVideoTracks()[0];

      // 既存の接続すべてに画面共有トラックを追加
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
   * 画面共有の停止
   */
  async stopScreenShare(url, token, extraData = {}) {
    if (!this.screenStream) return;

    const track = this.screenStream.getVideoTracks()[0];
    for (const [peerId, pc] of this.pcs) {
      const sender = pc.getSenders().find(s => s.track === track);
      if (sender) pc.removeTrack(sender);
      // トラック削除後の状態を同期
      await this._negotiate(pc, url, token, extraData);
    }

    this.screenStream.getTracks().forEach(t => t.stop());
    this.screenStream = null;
  }

  /**
   * 内部的なSDP交換プロセス
   */
  async _negotiate(pc, url, token, extraData) {
    // 2025年 Unified Plan 仕様に基づきOfferを作成
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}` 
      },
      // SDPに room_id (locationName) を含めて送信
      body: JSON.stringify({ 
        sdp: offer.sdp, 
        type: offer.type,
        ...extraData 
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`シグナリング失敗: ${err}`);
    }

    const answer = await response.json();
    // サーバーからのAnswerをセットして接続を確立・更新
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("Renegotiation Complete");
  }
}