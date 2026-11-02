import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Inbox, RefreshCw, Send } from 'lucide-react'
import { api } from '../../lib/api'
import { formatFecha, formatFechaHora, formatHora, todayLocal } from '../../lib/dates'
import { cx } from '../../lib/utils'
import type { Envio, Usuario } from '../../types'
import {
  Alert,
  EmptyState,
  EstadoBadge,
  LoadingBlock,
  PageHeader,
} from '../../components/ui'

export default function Envios() {
  const [fecha, setFecha] = useState(todayLocal())
  const [trabajador, setTrabajador] = useState<string>('')
  const [envios, setEnvios] = useState<Envio[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  useEffect(() => {
    let activo = true
    api.usuarios
      .list()
      .then((res) => {
        if (activo) setUsuarios(res.usuarios)
      })
      .catch(() => {
        // El filtro de trabajador queda vacío si falla.
      })
    return () => {
      activo = false
    }
  }, [])

  const cargar = useCallback(async () => {
    const requestId = ++requestRef.current
    setRefrescando(true)
    setError('')
    try {
      const resultado = await api.envios.list({
        fecha: fecha || undefined,
        trabajador: trabajador || undefined,
      })
      if (requestId !== requestRef.current) return
      setEnvios(resultado.envios)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los envíos.')
    } finally {
      if (requestId === requestRef.current) {
        setCargando(false)
        setRefrescando(false)
      }
    }
  }, [fecha, trabajador])

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 200)
    return () => clearTimeout(timer)
  }, [cargar])

  useEffect(() => {
    const timer = setInterval(() => void cargar(), 25000)
    return () => clearInterval(timer)
  }, [cargar])

  const totalMuestras = envios.reduce((total, envio) => total + envio.cantidad_muestras, 0)

  return (
    <div>
      <PageHeader
        title="Envíos recibidos"
        subtitle="Listas que los trabajadores enviaron desde su teléfono."
        action={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void cargar()}
            disabled={refrescando}
          >
            <RefreshCw className={cx('h-4 w-4', refrescando && 'animate-spin')} />
            Actualizar
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="envio-fecha" className="label">
              Fecha del envío
            </label>
            <input
              id="envio-fecha"
              type="date"
              className="input py-2.5"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="envio-trabajador" className="label">
              Trabajador
            </label>
            <select
              id="envio-trabajador"
              className="input py-2.5"
              value={trabajador}
              onChange={(event) =>
                setTrabajador(event.target.value)
              }
            >
              <option value="">Todos</option>
              {usuarios
                .filter((usuario) => usuario.rol === 'trabajador')
                .map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="chip bg-stone-100 text-stone-700">{envios.length} envío(s)</span>
          <span className="chip bg-green-100 text-green-800">{totalMuestras} muestra(s)</span>
          <span className="ml-auto text-[11px] text-stone-400">
            {fecha ? formatFecha(fecha) : 'Todas las fechas'} · actualización automática
          </span>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {cargando ? (
        <LoadingBlock label="Cargando envíos…" />
      ) : envios.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="No hay envíos recibidos"
          detail="Cuando un trabajador pulse ENVIAR, su lista aparecerá en esta bandeja."
        />
      ) : (
        <div className="space-y-3">
          {envios.map((envio) => (
            <details key={envio.id} className="card group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-700 text-base font-bold text-white">
                  {envio.trabajador_nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-900">
                    {envio.trabajador_nombre}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {formatFecha(envio.fecha)} · {formatHora(envio.hora)} ·{' '}
                    {envio.cantidad_muestras} muestra
                    {envio.cantidad_muestras === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="chip hidden bg-green-100 text-green-800 sm:inline-flex">
                  <Send className="h-3 w-3" />
                  Recibido
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-stone-400 transition group-open:rotate-180" />
              </summary>

              <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                  <span>Recibido en el servidor: {formatFechaHora(envio.creado_en)}</span>
                  <span>Envío #{envio.id}</span>
                </div>
                <ul className="space-y-2">
                  {envio.detalle.items.map((item) => (
                    <li
                      key={item.muestra_id}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-stone-900">
                            #{item.numero_muestra}
                          </span>
                          <span className="text-xs text-stone-500">{item.tipo_nombre ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-stone-500">
                            {formatFecha(item.fecha_marcado)} {formatHora(item.hora_marcado)}
                          </span>
                          <EstadoBadge estado={item.estado} size="sm" />
                        </div>
                      </div>
                      {item.valores.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.valores.map((valor) => (
                            <span
                              key={valor.campo_tipo_id}
                              className="inline-flex max-w-full items-center gap-1 rounded-lg bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600"
                            >
                              <span className="font-semibold text-stone-500">
                                {valor.nombre_campo}:
                              </span>
                              <span className="truncate">{valor.valor}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
