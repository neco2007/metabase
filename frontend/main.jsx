import React from 'react'
import ReactDOM from 'react-dom/client'
import VCComponent from './VCComponent'

const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlcl8wMDEiLCJleHAiOjE3NjcwOTQ2NDd9.FPyV7gMyaeyzH3lx60V_FlMUiLuxYMeosu7euIc2Xok"; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* locationName を渡すように修正 */}
    <VCComponent userId="user_001" token={testToken} locationName="教室1" />
  </React.StrictMode>
)