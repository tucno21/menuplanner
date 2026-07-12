import { useEffect } from 'react'
import { Outlet, NavLink } from 'react-router'
import { Home as HomeIcon, UtensilsCrossed, Leaf, Settings as SettingsIcon } from 'lucide-react'
import { usePlanificacionStore } from '../store/planificacionStore'

const MainLayout = () => {
  const initialize = usePlanificacionStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="flex flex-col min-h-screen bg-backdrop">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-secondary-dark flex justify-around items-center h-[60px] z-40 border-t border-secondary-dark">
        <NavLink
          to="/home"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer transition-colors ${isActive ? 'text-primary' : 'text-[#adb5bd]'}`
          }
        >
          <HomeIcon size={24} />
          <span className="text-xs font-medium">Inicio</span>
        </NavLink>
        <NavLink
          to="/platos"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer transition-colors ${isActive ? 'text-primary' : 'text-[#adb5bd]'}`
          }
        >
          <UtensilsCrossed size={24} />
          <span className="text-xs font-medium">Platos</span>
        </NavLink>
        <NavLink
          to="/ingredientes"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer transition-colors ${isActive ? 'text-primary' : 'text-[#adb5bd]'}`
          }
        >
          <Leaf size={24} />
          <span className="text-xs font-medium">Ingredientes</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer transition-colors ${isActive ? 'text-primary' : 'text-[#adb5bd]'}`
          }
        >
          <SettingsIcon size={24} />
          <span className="text-xs font-medium">Configuraciones</span>
        </NavLink>
      </nav>
    </div>
  )
}

export default MainLayout
