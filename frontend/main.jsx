import React from 'react'
import ReactDOM from 'react-dom/client'
import VCComponent from './VCComponent'

// 実際はメタバース側から動的に取得する想定
const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlcl8wMDEiLCJleHAiOjE3NjcwOTQ2NDd9.FPyV7gMyaeyzH3lx60V_FlMUiLuxYMeosu7euIc2Xok"; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* locationName を追加することで room_id=undefined を解消します */}
    <VCComponent userId="user_001" token={testToken} locationName="教室1" />
  </React.StrictMode>
)