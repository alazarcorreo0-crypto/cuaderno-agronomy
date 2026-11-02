import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import { FullScreenLoader } from './components/ui'
import type { Rol } from './types'
import Login from './pages/Login'
import SupervisorLayout from './layouts/SupervisorLayout'
import Dashboard from './pages/supervisor/Dashboard'
import Asignar from './pages/supervisor/Asignar'
import Tipos from './pages/supervisor/Tipos'
import Reporte from './pages/supervisor/Reporte'
import Historial from './pages/supervisor/Historial'
import Envios from './pages/supervisor/Envios'
import Usuarios from './pages/supervisor/Usuarios'
import TrabajadorHome from './pages/trabajador/TrabajadorHome'

function homeFor(rol: Rol) {
  return rol === 'supervisor' ? '/supervisor' : '/trabajador'
}

function Protected({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <FullScreenLoader />
  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== rol) return <Navigate to={homeFor(usuario.rol)} replace />
  return <>{children}</>
}

function Inicio() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <FullScreenLoader />
  return <Navigate to={usuario ? homeFor(usuario.rol) : '/login'} replace />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/trabajador"
          element={
            <Protected rol="trabajador">
              <TrabajadorHome />
            </Protected>
          }
        />
        <Route
          path="/supervisor"
          element={
            <Protected rol="supervisor">
              <SupervisorLayout />
            </Protected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="asignar" element={<Asignar />} />
          <Route path="tipos" element={<Tipos />} />
          <Route path="reporte" element={<Reporte />} />
          <Route path="historial" element={<Historial />} />
          <Route path="envios" element={<Envios />} />
          <Route path="usuarios" element={<Usuarios />} />
        </Route>
        <Route path="/" element={<Inicio />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
