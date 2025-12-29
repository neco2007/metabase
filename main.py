from fastapi import FastAPI, HTTPException, Header
from api.v1.signaling import signaling_handler
from core.rtc_manager import create_peer_connection
from typing import Optional
import uvicorn

app = FastAPI()

@app.post("/api/v1/signaling")
async def signaling_endpoint(
    offer: dict, 
    authorization: Optional[str] = Header(None)
):
    """
    SDP Offerを受け取り、転送処理を含むAnswerを返します。
    """
    # 2025年仕様: 接続ごとに独立したPCを生成
    pc = create_peer_connection()
    
    try:
        return await signaling_handler(offer, pc, authorization)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)