import { useState } from 'react'
import { AssistantView } from '@/components/assistant/AssistantView'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { FamilyView } from '@/components/family/FamilyView'
import { GroceryView } from '@/components/grocery/GroceryView'
import { ImplementationView } from '@/components/implementation/ImplementationView'
import { AppShell } from '@/components/layout/AppShell'
import { MealPlanView } from '@/components/mealplan/MealPlanView'
import { TasksView } from '@/components/tasks/TasksView'
import { useFamilyHub } from '@/hooks/useFamilyHub'
import type { ViewKey } from '@/types/familyHub'

const App = () => {
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const store = useFamilyHub()

  const renderView = () => {
    switch (activeView) {
      case 'groceries':
        return <GroceryView store={store} />
      case 'meals':
        return <MealPlanView store={store} />
      case 'tasks':
        return <TasksView store={store} />
      case 'family':
        return <FamilyView store={store} />
      case 'assistant':
        return <AssistantView store={store} />
      case 'implementation':
        return <ImplementationView store={store} />
      case 'dashboard':
      default:
        return <DashboardView onNavigate={setActiveView} store={store} />
    }
  }

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView} store={store}>
      {renderView()}
    </AppShell>
  )
}

export default App
