import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// ============================================================================
// TEST LOG - Verify code execution
// ============================================================================
// Debug logs removed - console visibility issue on user's Chrome

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)