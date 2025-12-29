from backend.core.auth import generate_debug_token

# テストユーザー "user_001" のトークンを発行
token = generate_debug_token("user_001")
print(f"Your Debug Token:\n{token}")