import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { useAuth } from './stores/auth'

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
