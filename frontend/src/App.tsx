import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DeviceBlocked } from '@/components/auth/DeviceBlocked'
import { LoginPage } from '@/components/auth/LoginPage'
import { VerificationPage } from '@/components/auth/VerificationPage'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'
import { AssistantView } from '@/components/assistant/AssistantView'
import { CommandCenterView } from '@/components/command-center/CommandCenterView'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { FamilyView } from '@/components/family/FamilyView'
import { GroceryView } from '@/components/grocery/GroceryView'
import { HistoryView } from '@/components/history/HistoryView'
import { DemoView } from '@/components/demo/DemoView'
import { AppShell } from '@/components/layout/AppShell'
import { MealPlanView } from '@/components/mealplan/MealPlanView'
import { TasksView } from '@/components/tasks/TasksView'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useFridgeHub } from '@/hooks/useFridgeHub'
import { useTheme } from '@/hooks/useTheme'
import { viewForPath, viewPaths } from '@/navigation'
import type { ScopedNavigationOptions, ViewKey } from '@/types/familyHub'

const App = () => {
  const auth = useAuth()
  const store = useFridgeHub(auth.isAuthenticated, auth.userId, auth.capabilities, auth.role)
  const theme = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const activeView = viewForPath(location.pathname)

  const navigateTo = (view: ViewKey, options?: ScopedNavigationOptions) => {
    const query = options?.scope ? `?scope=${options.scope}` : ''
    navigate(`${viewPaths[view]}${query}`)
  }

  if (!auth.isAuthenticated) {
    if (auth.isCheckingAuth) {
      return <DashboardSkeleton />
    }
    if (auth.isDeviceBlocked) {
      return <DeviceBlocked onRetry={auth.retryFromBlocked} />
    }
    if (auth.pendingVerification) {
      return (
        <VerificationPage
          status={auth.pendingVerification}
          onVerify={auth.verifyOtp}
          onResend={auth.resendOtp}
          onCancel={auth.dismissVerification}
        />
      )
    }
    return (
      <LoginPage
        error={auth.authError}
        onBootstrapSignup={auth.bootstrapSignup}
        onInviteSignup={auth.inviteSignup}
        onLogin={auth.login}
      />
    )
  }

  if (!store.state.family.id) {
    return <DashboardSkeleton />
  }

  return (
    <AppShell
      activeView={activeView}
      onLogout={auth.logout}
      onNavigate={navigateTo}
      onToggleTheme={theme.toggleTheme}
      store={store}
      theme={theme.theme}
      username={auth.username}
    >
      <CommandPalette store={store} />
      <Routes>
        <Route element={<DashboardView onNavigate={navigateTo} store={store} />} path={viewPaths.dashboard} />
        <Route element={<TasksView store={store} />} path={viewPaths.tasks} />
        <Route element={<GroceryView store={store} />} path={viewPaths.groceries} />
        <Route element={<MealPlanView store={store} />} path={viewPaths.meals} />
        <Route element={<FamilyView store={store} />} path={viewPaths.family} />
        <Route element={<AnalyticsView store={store} />} path={viewPaths.analytics} />
        <Route element={<AssistantView store={store} />} path={viewPaths.assistant} />
        <Route
          element={
            store.can('manage_family') ? (
              <CommandCenterView store={store} />
            ) : (
              <Navigate replace to={viewPaths.dashboard} />
            )
          }
          path={viewPaths['command-center']}
        />
        <Route
          element={
            store.can('view_audit') ? (
              <HistoryView store={store} />
            ) : (
              <Navigate replace to={viewPaths.dashboard} />
            )
          }
          path={viewPaths.history}
        />
        <Route element={<DemoView store={store} />} path={viewPaths.demo} />
        <Route element={<Navigate replace to={viewPaths.dashboard} />} path="*" />
      </Routes>
    </AppShell>
  )
}

export default App
