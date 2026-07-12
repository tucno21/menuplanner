import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { useAuthStore } from './store/authStore'
import { usePlanificacionStore } from './store/planificacionStore'
import Login from './pages/Login'
import MainLayout from './pages/MainLayout'
import Home from './pages/Home'
import Dia from './pages/Dia'
import Planificar from './pages/Planificar'
import PlatosList from './pages/grupos/PlatosList'
import PlatoDetail from './pages/grupos/PlatoDetail'
import CrearPlato from './pages/grupos/CrearPlato'
import ActualizarPlato from './pages/grupos/ActualizarPlato'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const initialize = usePlanificacionStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!isAuthenticated) return <Navigate to="/" replace />

  return <MainLayout />
}

const App = () => {
  const initialize = useAuthStore((s) => s.initialize)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (loading) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-backdrop shadow-2xl relative overflow-hidden flex justify-center items-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-backdrop shadow-2xl relative overflow-hidden">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<ProtectedRoute />}>
            <Route index element={<Home />} />
            <Route path="dia/:fecha" element={<Dia />} />
            <Route path="planificar/:fecha" element={<Planificar />} />
          </Route>
          <Route path="/platos" element={<ProtectedRoute />}>
            <Route index element={<PlatosList />} />
            <Route path="plato/:platoId" element={<PlatoDetail />} />
            <Route path="crear-plato" element={<CrearPlato />} />
            <Route path="actualizar-plato/:platoId" element={<ActualizarPlato />} />
          </Route>
          <Route path="/settings" element={<ProtectedRoute />}>
            <Route index element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
