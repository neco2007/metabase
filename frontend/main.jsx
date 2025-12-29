import React from 'react'
import ReactDOM from 'react-dom/client'
import VCComponent from './VCComponent'

// テスト用：実際は認証システムから取得したトークンを渡します
const testToken = "YOUR_DEBUG_TOKEN_HERE"; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VCComponent userId="user_001" token={testToken} />
  </React.StrictMode>
)