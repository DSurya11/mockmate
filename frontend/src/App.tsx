import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'

// The first pages a visitor sees load with the app; the rest load when first opened, so the
// landing page does not wait for the charts library or the interview room.
import Landing from './routes/index'
import LoginPage, { AuthShell } from './routes/login'
import RegisterPage from './routes/register'
const DashboardLayout = lazy(() => import('./routes/dashboard'))
const OverviewTab = lazy(() => import('./routes/dashboard.index'))
const InterviewsTab = lazy(() => import('./routes/dashboard.interviews'))
const ResumesTab = lazy(() => import('./routes/dashboard.resumes'))
const PracticeTab = lazy(() => import('./routes/dashboard.practice'))
const AnalyticsTab = lazy(() => import('./routes/dashboard.analytics'))
const InterviewRoom = lazy(() => import('./routes/interview.$id'))

const queryClient = new QueryClient()

function PageFallback() {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading…
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Interview session — standalone, outside dashboard layout */}
          <Route path="/interview/new" element={<Navigate to="/dashboard/practice" replace />} />
          <Route path="/interview/:id" element={<InterviewRoom />} />

          {/* Dashboard — nested layout with sub-routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="interviews" element={<InterviewsTab />} />
            <Route path="resumes" element={<ResumesTab />} />
            <Route path="practice" element={<PracticeTab />} />
            <Route path="analytics" element={<AnalyticsTab />} />
          </Route>

          {/* 404 — catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </QueryClientProvider>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  )
}

// Re-export AuthShell so register.tsx can still import from './login'
export { AuthShell }
