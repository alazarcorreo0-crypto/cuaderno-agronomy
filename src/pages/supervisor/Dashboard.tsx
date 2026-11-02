import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatFechaLarga, todayLocal } from '../../lib/dates'
import { cx } from '../../lib/utils'
import type { Resumen } from '../../types'
import { Alert, EmptyState, LoadingBlock, PageHeader } from '../../components/ui'

const STATS = [
  {
    key: 'asignadas',
    label: 'Asignadas',
    icon: ClipboardList,
    color: 'bg-stone-100 text-stone-700',
  },
  {
    key: 'hechas',
    label: 'Hechas',
    icon: CheckCircle2,
    color: 'bg-green-100 text-green-700',
  },
  {
    key: 'no_hechas',
    label: 'No hechas',
    icon: XCircle,
    color: 'bg-red-100 text-red-700',
  },
  {
    key: 'pendientes',
    label: 'Pendientes',
    icon: Clock3,
    color: 'bg-amber-100 text-amber-700',
  },
] as const

export default function Dashboard() {
  const [fecha, setFecha] = useState(todayLocal())
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(
    async (silencioso = false) => {
      if (silencioso) setRefrescando(true)
      else setCargando(true)
      setError('')
      try {
        const data = await api.reportes.resumen(fecha)
        setResumen(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.')
      } finally {
        setCargando(false)
        setRefrescando(false)
      }
    },
    [fecha]
  )

  useEffect(() => {
    void cargar()
    const timer = setInterval(() => void cargar(true), 30000)
    return () => clearInterval(timer)
  }, [cargar])

  return (
    <div>
      <PageHeader
        title="Resumen del día"
        subtitle={formatFechaLarga(fecha)}
        action={
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input w-auto py-2.5"
              value={fecha}
              onChange={(event) => setFecha(event.target.value || todayLocal())}
              aria-label="Fecha del resumen"
            />
            <button
              type="button"
              className="btn-secondary px-3"
              onClick={() => void cargar(true)}
              disabled={refrescando || cargando}
              aria-label="Actualizar resumen"
            >
              <RefreshCw className={cx('h-4 w-4', refrescando && 'animate-spin')} />
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {cargando && !resumen ? (
        <LoadingBlock label="Cargando resumen…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map((stat) => {
              const valor = resumen?.totales[stat.key] ?? 0
              return (
                <div key={stat.key} className="card p-4">
                  <div
                    className={cx(
                      'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
                      stat.color
                    )}
                  >
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <p className="text-3xl font-black tracking-tight text-stone-900">{valor}</p>
                  <p className="mt-0.5 text-xs font-semibold text-stone-500">{stat.label}</p>
                </div>
              )
            })}
          </div>

          <section className="card mt-5">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-400" />
                <h2 className="text-sm font-bold text-stone-800">Por trabajador</h2>
              </div>
              <span className="text-xs font-medium text-stone-500">
                {resumen?.totales.enviadas ?? 0} enviada(s)
              </span>
            </div>

            {!resumen || resumen.trabajadores.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={<ClipboardList className="h-6 w-6" />}
                  title="Sin muestras asignadas este día"
                  detail="Asigna números de muestra a un trabajador para empezar."
                  action={
                    <Link to="/supervisor/asignar" className="btn-primary">
                      Asignar muestras
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {resumen.trabajadores.map((trabajador) => {
                  const total = trabajador.asignadas || 1
                  return (
                    <li key={trabajador.id} className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-sm font-bold text-green-800">
                            {trabajador.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-stone-800">
                              {trabajador.nombre}
                            </p>
                            <p className="text-xs text-stone-500">
                              {trabajador.asignadas} asignada(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                          <span className="chip bg-green-100 text-green-800">
                            {trabajador.hechas} hechas
                          </span>
                          <span className="chip bg-red-100 text-red-700">
                            {trabajador.no_hechas} no
                          </span>
                          <span className="chip bg-amber-100 text-amber-800">
                            {trabajador.pendientes} pend.
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="bg-green-500"
                          style={{ width: `${(trabajador.hechas / total) * 100}%` }}
                        />
                        <div
                          className="bg-red-400"
                          style={{ width: `${(trabajador.no_hechas / total) * 100}%` }}
                        />
                        <div
                          className="bg-amber-300"
                          style={{ width: `${(trabajador.pendientes / total) * 100}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="mt-4 flex justify-end">
            <Link
              to="/supervisor/reporte"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-800 hover:text-green-900"
            >
              Ver reporte maestro
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
