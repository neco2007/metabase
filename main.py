import uvicorn
import logging
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from contextlib import asynccontextmanager

# 内部モジュールのインポート
from backend.api.v1.signaling import signaling_handler
from backend.api.v1.notifications import router as sse_router
from backend.core.rtc_manager import get_or_create_pc, cleanup_all_connections
from backend.core.auth import verify_access_token

# ログの設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rtc_main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """サーバー起動・終了時のライフサイクル管理"""
    logger.info("WebRTC Server Starting...")
    yield
    logger.info("WebRTC Server Shutting Down...")
    await cleanup_all_connections()

app = FastAPI(lifespan=lifespan)

# CORSミドルウェアの設定（OPTIONSリクエストと全メソッドを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSE通知ルーターの登録
app.include_router(sse_router)

@app.post("/api/v1/signaling")
async def signaling_endpoint(offer: dict, authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else ""
    payload = verify_access_token(token)
    if not payload: raise HTTPException(status_code=401)
    
    user_id = payload["user_id"]
    pc = get_or_create_pc(user_id)
    
    try:
        return await signaling_handler(offer, pc, authorization)
    except Exception as e:
        # 【修正ポイント】終了・失敗時は正常レスポンスを返すようにし、エラー扱いにしない
        if pc.connectionState in ["failed", "closed"]:
            logger.info(f"ユーザー {user_id} のシグナリングを正常にクローズしました。")
            return {"type": "answer", "sdp": "", "status": "closed"}
        
        logger.exception(f"Signaling Error for {user_id}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # ConohaVPS環境での実行設定
    uvicorn.run("main:app", host="0.0.0.0", port=8099, reload=True)