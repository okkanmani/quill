import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyLoginAppearance, applyActiveUserAppearance } from './loginAppearance.js'

if (localStorage.getItem('token')) {
  applyActiveUserAppearance()
} else {
  applyLoginAppearance()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
