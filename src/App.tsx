import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router'
import { useAuthStore } from './store/authStore'
import { usePlanificacionStore } from './store/planificacionStore'
import { useSyncStore } from './store/syncStore'
import Login from './pages/Login'
import MainLayout from './pages/MainLayout'
import Home from './pages/Home'
import Dia from './pages/Dia'
import Planificar from './pages/Planificar'
import PlatosList from './pages/grupos/PlatosList'
import PlatoDetail from './pages/grupos/PlatoDetail'
import CrearPlato from './pages/grupos/CrearPlato'
import ActualizarPlato from './pages/grupos/ActualizarPlato'
import Ingredientes from './pages/Ingredientes'
import Unidades from './pages/Unidades'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import Toast from './components/ui/Toast'

const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const initialize = usePlanificacionStore((s) => s.initialize)
  const startAutoSync = useSyncStore((s) => s.startAutoSync)
  const stopAutoSync = useSyncStore((s) => s.stopAutoSync)

  useEffect(() => {
    initialize()
    startAutoSync()
    return () => stopAutoSync()
  }, [initialize, startAutoSync, stopAutoSync])

  if (!isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}

const App = () => {
  const initialize = useAuthStore((s) => s.initialize)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (loading) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-backdrop">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/home/dia/:fecha" element={<Dia />} />
            <Route path="/home/planificar/:fecha" element={<Planificar />} />
            <Route path="/platos" element={<PlatosList />} />
            <Route path="/platos/plato/:platoId" element={<PlatoDetail />} />
            <Route path="/platos/crear-plato" element={<CrearPlato />} />
            <Route path="/platos/actualizar-plato/:platoId" element={<ActualizarPlato />} />
            <Route path="/ingredientes" element={<Ingredientes />} />
            <Route path="/ingredientes/unidades" element={<Unidades />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<div className="max-w-[480px] mx-auto min-h-dvh bg-backdrop shadow-2xl relative overflow-hidden"><NotFound /></div>} />
      </Routes>
      <Toast />
    </BrowserRouter>
  )
}

export default App
