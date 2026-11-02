import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { cx } from '../lib/utils'

const NAV = [
  { to: '/supervisor', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/supervisor/asignar', label: 'Asignar', icon: ClipboardList },
  { to: '/supervisor/tipos', label: 'Tipos', icon: SlidersHorizontal },
  { to: '/supervisor/reporte', label: 'Reporte', icon: ListChecks },
  { to: '/supervisor/historial', label: 'Historial', icon: History },
  { to: '/supervisor/envios', label: 'Envíos', icon: Inbox },
  { to: '/supervisor/usuarios', label: 'Usuarios', icon: Users },
]

export default function SupervisorLayout() {
  const { usuario, salir } = useAuth()
  const navigate = useNavigate()

  function cerrarSesion() {
    salir()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-stone-100 lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-900">Cuaderno de Campo</p>
            <p className="text-xs font-medium text-green-700">Supervisor</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-green-700 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-stone-100 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-semibold text-stone-800">{usuario?.nombre}</p>
            <p className="text-xs text-stone-500">Sesión de supervisor</p>
          </div>
          <button type="button" onClick={cerrarSesion} className="btn-ghost w-full justify-start">
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-safe">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-900">Cuaderno de Campo</p>
                <p className="truncate text-xs text-stone-500">{usuario?.nombre} · Supervisor</p>
              </div>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              className="rounded-xl p-2.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                    isActive ? 'bg-green-700 text-white' : 'text-stone-500 hover:bg-stone-100'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
