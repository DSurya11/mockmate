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

// Pages load on demand. After a deploy, a tab opened earlier asks for page files that no longer
// exist and the page stays blank. Reload, but only when a new version really is deployed: the
// server's page names a different main script than the one running. Firefox also reports a load
// cancelled by leaving the page as failed; reloading then bounced people back (seen in a test).
window.addEventListener('vite:preloadError', (event) => {
  const running = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src
  event.preventDefault()
  fetch('/', { cache: 'no-store' })
    .then((r) => r.text())
    .then((html) => {
      const deployed = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
      if (running && deployed && !running.endsWith(deployed)) window.location.reload()
    })
    .catch(() => undefined)
})

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
