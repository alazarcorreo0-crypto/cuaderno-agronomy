import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, FilterX, RefreshCw, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { formatFecha, formatFechaHora, formatHora, todayLocal } from '../../lib/dates'
import { cx } from '../../lib/utils'
import type { EstadoMuestra, Muestra, TipoMuestra, Usuario } from '../../types'
import {
  Alert,
  EmptyState,
  EstadoBadge,
  LoadingBlock,
  PageHeader,
} from '../../components/ui'
import { SampleValues } from '../../components/SampleValues'

export default function Reporte() {
  const [fecha, setFecha] = useState(todayLocal())
  const [trabajador, setTrabajador] = useState<string>('')
  const [tipo, setTipo] = useState<string>('')
  const [estado, setEstado] = useState<EstadoMuestra | ''>('')
  const [numero, setNumero] = useState('')

  const [muestras, setMuestras] = useState<Muestra[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [tipos, setTipos] = useState<TipoMuestra[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState('')
  const [actualizado, setActualizado] = useState<string | null>(null)
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
        // Los filtros siguen funcionando con lo que esté disponible.
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
      const resultado = await api.muestras.list({
        fecha: fecha || undefined,
        trabajador: trabajador || undefined,
        tipo: tipo || undefined,
        estado,
        numero: numero.trim() || undefined,
      })
      if (requestId !== requestRef.current) return
      setMuestras(resultado.muestras)
      setActualizado(new Date().toISOString())
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.')
    } finally {
      if (requestId === requestRef.current) {
        setCargando(false)
        setRefrescando(false)
      }
    }
  }, [fecha, trabajador, tipo, estado, numero])

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 250)
    return () => clearTimeout(timer)
  }, [cargar])

  useEffect(() => {
    const timer = setInterval(() => void cargar(), 20000)
    return () => clearInterval(timer)
  }, [cargar])

  const conteos = muestras.reduce(
    (acc, muestra) => {
      acc[muestra.estado] += 1
      return acc
    },
    { pendiente: 0, hecha: 0, no_hecha: 0 }
  )

  function verHoy() {
    setFecha(todayLocal())
    setTrabajador('')
    setTipo('')
    setEstado('')
    setNumero('')
  }

  function limpiarFiltros() {
    setFecha('')
    setTrabajador('')
    setTipo('')
    setEstado('')
    setNumero('')
  }

  return (
    <div>
      <PageHeader
        title="Reporte maestro"
        subtitle="Todas las muestras: hechas, no hechas y pendientes. Evita repetir trabajo."
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="filtro-fecha" className="label">
              Día de asignación
            </label>
            <input
              id="filtro-fecha"
              type="date"
              className="input py-2.5"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filtro-trabajador" className="label">
              Trabajador
            </label>
            <select
              id="filtro-trabajador"
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
                    {usuario.activo ? '' : ' (inactivo)'}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-tipo" className="label">
              Tipo
            </label>
            <select
              id="filtro-tipo"
              className="input py-2.5"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
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
            <label htmlFor="filtro-estado" className="label">
              Estado
            </label>
            <select
              id="filtro-estado"
              className="input py-2.5"
              value={estado}
              onChange={(event) => setEstado(event.target.value as EstadoMuestra | '')}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="hecha">Hecha</option>
              <option value="no_hecha">No hecha</option>
            </select>
          </div>
          <div>
            <label htmlFor="filtro-numero" className="label">
              Número de muestra
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="filtro-numero"
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
          <div className="flex flex-wrap gap-1.5">
            <span className="chip bg-stone-100 text-stone-700">{muestras.length} total</span>
            <span className="chip bg-green-100 text-green-800">{conteos.hecha} hechas</span>
            <span className="chip bg-red-100 text-red-700">{conteos.no_hecha} no hechas</span>
            <span className="chip bg-amber-100 text-amber-800">{conteos.pendiente} pendientes</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="btn-ghost min-h-[34px] px-2.5 py-1 text-xs" onClick={verHoy}>
              Hoy
            </button>
            <button
              type="button"
              className="btn-ghost min-h-[34px] px-2.5 py-1 text-xs"
              onClick={limpiarFiltros}
            >
              <FilterX className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>
        </div>
        {actualizado ? (
          <p className="mt-2 text-[11px] text-stone-400">
            Actualizado {formatFechaHora(actualizado)} · se refresca automáticamente
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {cargando ? (
        <LoadingBlock label="Cargando reporte…" />
      ) : muestras.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="No hay muestras con esos filtros"
          detail="Prueba con otro día o limpia los filtros para ver todo el reporte."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden border-b border-stone-100 bg-stone-50/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 md:grid md:grid-cols-[110px_1.4fr_1fr_120px_160px_110px] md:items-center md:gap-3">
            <span>Muestra</span>
            <span>Tipo / detalles</span>
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
                  muestra.estado === 'hecha'
                    ? 'border-l-green-500 bg-green-50/30'
                    : muestra.estado === 'no_hecha'
                      ? 'border-l-red-400'
                      : 'border-l-transparent'
                )}
              >
                <div className="hidden md:grid md:grid-cols-[110px_1.4fr_1fr_120px_160px_110px] md:items-center md:gap-3">
                  <div>
                    <p className="text-lg font-black tracking-tight text-stone-900">
                      #{muestra.numero_muestra}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {formatFecha(muestra.fecha_asignacion)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {muestra.tipo_nombre ?? '—'}
                    </p>
                    <SampleValues muestra={muestra} max={2} className="mt-1" />
                  </div>
                  <p className="text-sm text-stone-600">{muestra.trabajador_nombre ?? '—'}</p>
                  <div>
                    <EstadoBadge estado={muestra.estado} />
                  </div>
                  <div className="text-xs text-stone-500">
                    {muestra.fecha_marcado ? (
                      <>
                        <p className="font-medium text-stone-700">
                          {formatFecha(muestra.fecha_marcado)}
                        </p>
                        <p>{formatHora(muestra.hora_marcado)}</p>
                      </>
                    ) : (
                      <span className="text-stone-400">Sin marcar</span>
                    )}
                  </div>
                  <div>
                    {muestra.enviado ? (
                      <span
                        className="chip bg-green-100 text-green-800"
                        title={formatFechaHora(muestra.fecha_envio)}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Enviada
                      </span>
                    ) : (
                      <span className="chip bg-stone-100 text-stone-500">Local</span>
                    )}
                  </div>
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
                    <div className="flex flex-col items-end gap-1">
                      <EstadoBadge estado={muestra.estado} />
                      {muestra.enviado ? (
                        <span className="chip bg-green-50 text-green-700">Enviada</span>
                      ) : (
                        <span className="chip bg-stone-100 text-stone-500">Local</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-stone-700">
                    {muestra.trabajador_nombre ?? '—'}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Asignada: {formatFecha(muestra.fecha_asignacion)}
                    {muestra.fecha_marcado
                      ? ` · Marcada: ${formatFecha(muestra.fecha_marcado)} ${formatHora(
                          muestra.hora_marcado
                        )}`
                      : ''}
                  </p>
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
