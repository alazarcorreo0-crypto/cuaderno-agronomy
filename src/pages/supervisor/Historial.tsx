import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, FilterX, History as HistoryIcon, RefreshCw, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { formatFecha, formatFechaHora, formatHora, todayLocal } from '../../lib/dates'
import { cx } from '../../lib/utils'
import type { Muestra, TipoMuestra, Usuario } from '../../types'
import { Alert, EmptyState, EstadoBadge, LoadingBlock, PageHeader } from '../../components/ui'
import { SampleValues } from '../../components/SampleValues'

export default function Historial() {
  const [fecha, setFecha] = useState(todayLocal())
  const [trabajador, setTrabajador] = useState<number | ''>('')
  const [tipo, setTipo] = useState<number | ''>('')
  const [numero, setNumero] = useState('')

  const [muestras, setMuestras] = useState<Muestra[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [tipos, setTipos] = useState<TipoMuestra[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  useEffect(() => {
    let activo = true
    async function cargarFiltros() {
      try {
        const [usuariosRes, tiposRes] = await Promise.all([
          api.usuarios.list(),
          api.tipos.list(true),
        ])
        if (!activo) return
        setUsuarios(usuariosRes.usuarios)
        setTipos(tiposRes.tipos)
      } catch {
        // Filtros opcionales.
      }
    }
    void cargarFiltros()
    return () => {
      activo = false
    }
  }, [])

  const cargar = useCallback(async () => {
    const requestId = ++requestRef.current
    setRefrescando(true)
    setError('')
    try {
      const resultado = await api.reportes.historial({
        fecha: fecha || undefined,
        trabajador: trabajador || undefined,
        tipo: tipo || undefined,
        numero: numero.trim() || undefined,
      })
      if (requestId !== requestRef.current) return
      setMuestras(resultado.muestras)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
    } finally {
      if (requestId === requestRef.current) {
        setCargando(false)
        setRefrescando(false)
      }
    }
  }, [fecha, trabajador, tipo, numero])

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 250)
    return () => clearTimeout(timer)
  }, [cargar])

  function limpiar() {
    setFecha('')
    setTrabajador('')
    setTipo('')
    setNumero('')
  }

  return (
    <div>
      <PageHeader
        title="Historial"
        subtitle="Consulta por día, trabajador o número de muestra. Cada marcado conserva fecha y hora."
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="hist-fecha" className="label">
              Día de marcado
            </label>
            <input
              id="hist-fecha"
              type="date"
              className="input py-2.5"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="hist-trabajador" className="label">
              Trabajador
            </label>
            <select
              id="hist-trabajador"
              className="input py-2.5"
              value={trabajador}
              onChange={(event) =>
                setTrabajador(event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">Todos</option>
              {usuarios
                .filter((usuario) => usuario.rol === 'trabajador')
                .map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                    {usuario.activo ? '' : ' (inactivo)'}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="hist-tipo" className="label">
              Tipo
            </label>
            <select
              id="hist-tipo"
              className="input py-2.5"
              value={tipo}
              onChange={(event) => setTipo(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">Todos</option>
              {tipos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                  {item.activo ? '' : ' (inactivo)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hist-numero" className="label">
              Número de muestra
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="hist-numero"
                type="search"
                className="input py-2.5 pl-9"
                placeholder="Buscar…"
                value={numero}
                onChange={(event) => setNumero(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-stone-500">
            {muestras.length} muestra{muestras.length === 1 ? '' : 's'} marcada
            {muestras.length === 1 ? '' : 's'} · deja los filtros vacíos para ver todo
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn-ghost min-h-[34px] px-2.5 py-1 text-xs"
              onClick={() => setFecha(todayLocal())}
            >
              Hoy
            </button>
            <button
              type="button"
              className="btn-ghost min-h-[34px] px-2.5 py-1 text-xs"
              onClick={limpiar}
            >
              <FilterX className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {cargando ? (
        <LoadingBlock label="Cargando historial…" />
      ) : muestras.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="h-6 w-6" />}
          title="Sin marcados para esos filtros"
          detail="Las muestras aparecen aquí cuando el trabajador las marca y las envía."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden border-b border-stone-100 bg-stone-50/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 md:grid md:grid-cols-[110px_1.3fr_1fr_110px_150px_150px] md:gap-3">
            <span>Muestra</span>
            <span>Tipo</span>
            <span>Trabajador</span>
            <span>Estado</span>
            <span>Marcado</span>
            <span>Envío</span>
          </div>
          <ul className="divide-y divide-stone-100">
            {muestras.map((muestra) => (
              <li
                key={muestra.id}
                className={cx(
                  'border-l-4 px-4 py-3.5',
                  muestra.estado === 'hecha' ? 'border-l-green-500' : 'border-l-red-400'
                )}
              >
                <div className="hidden md:grid md:grid-cols-[110px_1.3fr_1fr_110px_150px_150px] md:items-center md:gap-3">
                  <p className="text-lg font-black tracking-tight text-stone-900">
                    #{muestra.numero_muestra}
                  </p>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {muestra.tipo_nombre ?? '—'}
                    </p>
                    <SampleValues muestra={muestra} max={2} className="mt-1" />
                  </div>
                  <div>
                    <p className="text-sm text-stone-700">{muestra.trabajador_nombre ?? '—'}</p>
                    <p className="text-[11px] text-stone-400">
                      Asignó: {muestra.asignado_por_nombre ?? '—'}
                    </p>
                  </div>
                  <EstadoBadge estado={muestra.estado} />
                  <div className="text-xs text-stone-600">
                    <p className="flex items-center gap-1 font-medium text-stone-800">
                      <CalendarClock className="h-3.5 w-3.5 text-stone-400" />
                      {formatFecha(muestra.fecha_marcado)}
                    </p>
                    <p className="mt-0.5 pl-4 text-stone-500">
                      {formatHora(muestra.hora_marcado)}
                    </p>
                  </div>
                  <p className="text-xs text-stone-500" title={formatFechaHora(muestra.fecha_envio)}>
                    {formatFechaHora(muestra.fecha_envio)}
                  </p>
                </div>

                <div className="md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                        {muestra.tipo_nombre ?? 'Muestra'}
                      </p>
                      <p className="text-2xl font-black leading-tight tracking-tight text-stone-900">
                        #{muestra.numero_muestra}
                      </p>
                    </div>
                    <EstadoBadge estado={muestra.estado} />
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-stone-700">
                    {muestra.trabajador_nombre ?? '—'}
                  </p>
                  <div className="mt-1 space-y-0.5 text-[11px] text-stone-500">
                    <p className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Marcada: {formatFecha(muestra.fecha_marcado)} ·{' '}
                      {formatHora(muestra.hora_marcado)}
                    </p>
                    <p>Envío: {formatFechaHora(muestra.fecha_envio)}</p>
                    <p>Asignó: {muestra.asignado_por_nombre ?? '—'}</p>
                  </div>
                  <div className="mt-2">
                    <SampleValues muestra={muestra} max={3} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
