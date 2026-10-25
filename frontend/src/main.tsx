import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import '@fontsource-variable/fraunces'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import './styles.css'
import { useAuth } from './stores/auth'

// Wake the free-tier backend and AI service the moment the app opens, so they are ready by
// the time the visitor has logged in (they sleep after 15 idle minutes; waking takes 30-60 s).
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
fetch(`${API_BASE_URL}/health/wake`).catch(() => undefined)

function AuthBoot({ children }: { children: React.ReactNode }) {
  const init = useAuth((s) => s.init)
  useEffect(() => { init() }, [init])
  return <>{children}</>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthBoot>
        <App />
      </AuthBoot>
    </BrowserRouter>
  </React.StrictMode>
)
