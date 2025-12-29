import jwt
import datetime
from typing import Dict, Any, Optional

SECRET_KEY = "your-secret-key-for-metaschool" # 実際は環境変数から取得
ALGORITHM = "HS256"

def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    JWTトークンの妥当性を検証します。
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload if _is_token_valid(payload) else None
    except jwt.PyJWTError:
        return None

def _is_token_valid(payload: Dict[str, Any]) -> bool:
    """
    トークンの有効期限などを内部的にチェックします。
    """
    exp = payload.get("exp")
    if not exp:
        return False
    return datetime.datetime.fromtimestamp(exp) > datetime.datetime.now()

def generate_debug_token(user_id: str) -> str:
    """
    開発・デバッグ用のトークン生成関数です。
    """
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.now() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)