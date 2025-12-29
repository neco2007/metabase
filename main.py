import uvicorn
import logging
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from contextlib import asynccontextmanager

from backend.api.v1.signaling import signaling_handler
from backend.api.v1.notifications import router as sse_router
from backend.core.rtc_manager import create_peer_connection, cleanup_all_connections

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await cleanup_all_connections()

app = FastAPI(lifespan=lifespan)

# --- 【修正】CORSミドルウェアの追加 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 開発時はすべて許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sse_router)

@app.post("/api/v1/signaling")
async def signaling_endpoint(offer: dict, authorization: Optional[str] = Header(None)):
    pc = create_peer_connection()
    try:
        return await signaling_handler(offer, pc, authorization)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8099, reload=True)