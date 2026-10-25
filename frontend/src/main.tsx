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
import { keepAwake } from './lib/keepAwake'

// Wake the free-tier services when the app opens, and keep them awake while it is in use.
keepAwake()

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
