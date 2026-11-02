import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CloudUpload,
  LogOut,
  RefreshCw,
  Send,
  SlidersHorizontal,
  WifiOff,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ApiError, api } from '../../lib/api'
import {
  deletePendientes,
  getListaCache,
  getPendientes,
  savePendiente,
  setListaCache,
} from '../../lib/idb'
import { formatFecha, formatFechaHora, formatFechaLarga, timeNow, todayLocal } from '../../lib/dates'
import { cx } from '../../lib/utils'
import type { Muestra, Pendiente } from '../../types'
import { Alert, EstadoBadge, EmptyState, LoadingBlock, Modal, Spinner } from '../../components/ui'
import { CampoInputs } from '../../components/CampoInputs'
import { SampleValues } from '../../components/SampleValues'

type Aviso = { tone: 'success' | 'warning' | 'info' | 'error'; texto: string }

function esErrorDeConexion(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504)
  )
}

function faltanCamposObligatorios(muestra: Muestra, valores: Record<string, string>) {
  return muestra.campos
    .filter((campo) => campo.requerido && !String(valores[campo.id] ?? '').trim())
    .map((campo) => campo.nombre_campo)
}

export default function TrabajadorHome() {
  const { usuario, salir } = useAuth()
  const navigate = useNavigate()
  const usuarioId = usuario?.id ?? null
  const hoy = todayLocal()

  const [base, setBase] = useState<Muestra[]>([])
  const [pendientes, setPendientes] = useState<Record<number, Pendiente>>({})
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [ultimaSync, setUltimaSync] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)

  const [detalleAbierto, setDetalleAbierto] = useState<Muestra | null>(null)
  const [valoresDetalle, setValoresDetalle] = useState<Record<string, string>>({})
  const [guardandoDetalle, setGuardandoDetalle] = useState(false)

  const [confirmarEnvio, setConfirmarEnvio] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')

  const cargarPendientes = useCallback(async () => {
    if (!usuarioId) return
    try {
      const items = await getPendientes(usuarioId)
      const mapa: Record<number, Pendiente> = {}
      for (const item of items) mapa[item.muestra_id] = item
      setPendientes(mapa)
    } catch {
      setAviso({
        tone: 'warning',
        texto: 'No se pudo leer el almacenamiento local del teléfono. Evita cerrar la app.',
      })
    }
  }, [usuarioId])

  const cargarLista = useCallback(
    async (silencioso = false) => {
      if (!usuarioId) return
      if (silencioso) setRefrescando(true)
      else setCargando(true)
      setError('')

      try {
        const resultado = await api.muestras.mias(todayLocal())
        setBase(resultado.muestras)
        setOffline(false)
        const ahora = new Date().toISOString()
        setUltimaSync(ahora)
        try {
          await setListaCache(usuarioId, resultado.fecha, resultado.muestras)
        } catch {
          // La app sigue funcionando en memoria aunque IndexedDB no esté disponible.
        }
      } catch (err) {
        if (esErrorDeConexion(err)) {
          setOffline(true)
          try {
            const cache = await getListaCache(usuarioId)
            if (cache) {
              setBase(cache.muestras)
              setUltimaSync(cache.actualizado_en)
            } else {
              setError('Sin conexión y todavía no hay una lista guardada en este teléfono.')
            }
          } catch {
            setError('Sin conexión y no se pudo leer la lista guardada en este teléfono.')
          }
        } else {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la lista.')
        }
      } finally {
        setCargando(false)
        setRefrescando(false)
      }
    },
    [usuarioId]
  )

  useEffect(() => {
    if (!usuarioId) return
    let activo = true

    async function iniciar() {
      try {
        const cache = await getListaCache(usuarioId as number)
        if (activo && cache) {
          setBase(cache.muestras)
          setUltimaSync(cache.actualizado_en)
        }
      } catch {
        // Sin caché local: se intentará la red.
      }
      await cargarPendientes()
      if (activo) await cargarLista(true)
    }

    void iniciar()
    return () => {
      activo = false
    }
  }, [usuarioId, cargarPendientes, cargarLista])

  useEffect(() => {
    const alVolverOnline = () => {
      setOffline(false)
      void cargarLista(true)
    }
    const alQuedarOffline = () => setOffline(true)
    window.addEventListener('online', alVolverOnline)
    window.addEventListener('offline', alQuedarOffline)
    return () => {
      window.removeEventListener('online', alVolverOnline)
      window.removeEventListener('offline', alQuedarOffline)
    }
  }, [cargarLista])

  useEffect(() => {
    if (!aviso) return
    const timer = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(timer)
  }, [aviso])

  const muestras = useMemo(
    () =>
      base.map((muestra) => {
        const pendiente = pendientes[muestra.id]
        if (!pendiente) return muestra
        return {
          ...muestra,
          estado: pendiente.estado,
          fecha_marcado: pendiente.fecha_marcado ?? muestra.fecha_marcado,
          hora_marcado: pendiente.hora_marcado ?? muestra.hora_marcado,
          valores: { ...muestra.valores, ...pendiente.valores },
        }
      }),
    [base, pendientes]
  )

  const pendientesMarcados = useMemo(
    () => Object.values(pendientes).filter((item) => item.estado !== 'pendiente'),
    [pendientes]
  )
  const borradores = useMemo(
    () => Object.values(pendientes).filter((item) => item.estado === 'pendiente').length,
    [pendientes]
  )
  const conteos = useMemo(() => {
    let hechas = 0
    let noHechas = 0
    let pendientesLista = 0
    for (const muestra of muestras) {
      if (muestra.estado === 'hecha') hechas += 1
      else if (muestra.estado === 'no_hecha') noHechas += 1
      else pendientesLista += 1
    }
    return { hechas, noHechas, pendientes: pendientesLista }
  }, [muestras])

  const totalMarcadas = conteos.hechas + conteos.noHechas
  const progreso = muestras.length ? Math.round((totalMarcadas / muestras.length) * 100) : 0

  async function marcar(muestra: Muestra, estado: 'hecha' | 'no_hecha') {
    if (!usuarioId) return
    const ahora = new Date()
    const pendiente: Pendiente = {
      id: `${usuarioId}:${muestra.id}`,
      usuario_id: usuarioId,
      muestra_id: muestra.id,
      estado,
      fecha_marcado: todayLocal(ahora),
      hora_marcado: timeNow(ahora),
      valores: { ...muestra.valores },
      actualizado_en: ahora.toISOString(),
    }
    setPendientes((prev) => ({ ...prev, [muestra.id]: pendiente }))
    try {
      await savePendiente(pendiente)
    } catch {
      setAviso({
        tone: 'warning',
        texto: 'Se marcó, pero no se pudo guardar en el teléfono. No cierres la app hasta enviar.',
      })
    }
  }

  function abrirDetalle(muestra: Muestra) {
    setDetalleAbierto(muestra)
    setValoresDetalle({ ...muestra.valores })
  }

  async function guardarDetalle() {
    if (!usuarioId || !detalleAbierto) return
    setGuardandoDetalle(true)
    const ahora = new Date()
    const pendiente: Pendiente = {
      id: `${usuarioId}:${detalleAbierto.id}`,
      usuario_id: usuarioId,
      muestra_id: detalleAbierto.id,
      estado: detalleAbierto.estado,
      fecha_marcado: detalleAbierto.fecha_marcado,
      hora_marcado: detalleAbierto.hora_marcado,
      valores: { ...valoresDetalle },
      actualizado_en: ahora.toISOString(),
    }
    setPendientes((prev) => ({ ...prev, [detalleAbierto.id]: pendiente }))
    try {
      await savePendiente(pendiente)
      setAviso({ tone: 'success', texto: 'Detalles guardados en este teléfono.' })
    } catch {
      setAviso({
        tone: 'warning',
        texto: 'Se guardaron solo en memoria. No cierres la app hasta enviar.',
      })
    } finally {
      setGuardandoDetalle(false)
      setDetalleAbierto(null)
    }
  }

  async function enviarLista() {
    if (!pendientesMarcados.length) return
    setErrorEnvio('')

    const incompletas = pendientesMarcados
      .filter((item) => item.estado === 'hecha')
      .map((item) => {
        const muestra = muestras.find((actual) => actual.id === item.muestra_id)
        if (!muestra) return null
        const faltan = faltanCamposObligatorios(muestra, item.valores ?? {})
        return faltan.length ? `#${muestra.numero_muestra}: ${faltan.join(', ')}` : null
      })
      .filter((texto): texto is string => Boolean(texto))

    if (incompletas.length) {
      setErrorEnvio(
        `Completa los campos obligatorios antes de enviar. ${incompletas.join(' · ')}`
      )
      return
    }

    setEnviando(true)

    const items = pendientesMarcados.map((item) => ({
      muestra_id: item.muestra_id,
      estado: item.estado as 'hecha' | 'no_hecha',
      fecha_marcado: item.fecha_marcado ?? todayLocal(),
      hora_marcado: item.hora_marcado ?? timeNow(),
      valores: item.valores,
    }))

    try {
      const resultado = await api.envios.enviar({
        fecha: todayLocal(),
        hora: timeNow(),
        items,
      })

      try {
        await deletePendientes(pendientesMarcados.map((item) => item.id))
      } catch {
        // Si falla IndexedDB, igual limpiamos el estado en memoria tras el envío exitoso.
      }

      setPendientes((prev) => {
        const siguiente = { ...prev }
        for (const item of pendientesMarcados) delete siguiente[item.muestra_id]
        return siguiente
      })

      const porId = new Map(pendientesMarcados.map((item) => [item.muestra_id, item]))
      setBase((prev) =>
        prev.map((muestra) => {
          const marcada = porId.get(muestra.id)
          if (!marcada) return muestra
          return {
            ...muestra,
            estado: marcada.estado,
            fecha_marcado: marcada.fecha_marcado,
            hora_marcado: marcada.hora_marcado,
            valores: marcada.valores,
            enviado: true,
          }
        })
      )

      setConfirmarEnvio(false)
      setOffline(false)
      setAviso({
        tone: 'success',
        texto: `Lista enviada: ${resultado.cantidad} muestra${resultado.cantidad === 1 ? '' : 's'}.`,
      })
      void cargarLista(true)
    } catch (err) {
      if (esErrorDeConexion(err)) {
        setOffline(true)
        setErrorEnvio('')
      } else {
        setErrorEnvio(err instanceof Error ? err.message : 'No se pudo enviar la lista.')
      }
    } finally {
      setEnviando(false)
    }
  }

  function cerrarSesion() {
    salir()
    navigate('/login', { replace: true })
  }

  if (!usuario) return null

  return (
    <div className="min-h-dvh bg-stone-100">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pb-3 pt-safe">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-700 text-base font-bold text-white">
            {usuario.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight text-stone-900">Mi lista</h1>
            <p className="truncate text-xs text-stone-500">
              {usuario.nombre} · {formatFechaLarga(hoy)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargarLista(true)}
            disabled={refrescando || cargando}
            className="rounded-xl p-2.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
            aria-label="Actualizar lista"
          >
            <RefreshCw className={cx('h-5 w-5', refrescando && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={cerrarSesion}
            className="rounded-xl p-2.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        {offline ? (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2">
            <div className="mx-auto flex max-w-2xl items-center gap-2 text-xs font-medium text-amber-900">
              <WifiOff className="h-4 w-4 shrink-0" />
              Sin conexión. Puedes marcar; todo se guarda en este teléfono.
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-44 pt-4">
        {muestras.length > 0 ? (
          <section className="card mb-4 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Progreso de la lista
                </p>
                <p className="mt-0.5 text-2xl font-black tracking-tight text-stone-900">
                  {totalMarcadas}
                  <span className="text-base font-semibold text-stone-400"> / {muestras.length}</span>
                </p>
                <p className="text-xs text-stone-500">muestras marcadas</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <span className="chip bg-green-100 text-green-800">
                  <Check className="h-3.5 w-3.5" /> {conteos.hechas}
                </span>
                <span className="chip bg-red-100 text-red-700">
                  <X className="h-3.5 w-3.5" /> {conteos.noHechas}
                </span>
                <span className="chip bg-amber-100 text-amber-800">{conteos.pendientes} pend.</span>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-300"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              {ultimaSync
                ? `Lista actualizada: ${formatFechaHora(ultimaSync)}`
                : 'Lista cargada en este teléfono'}
            </p>
          </section>
        ) : null}

        {aviso ? (
          <div className="mb-4">
            <Alert tone={aviso.tone} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 space-y-3">
            <Alert tone="error">{error}</Alert>
            <button type="button" className="btn-secondary w-full" onClick={() => void cargarLista()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
        ) : null}

        {cargando && !muestras.length ? (
          <LoadingBlock label="Cargando tu lista…" />
        ) : muestras.length === 0 ? (
          <EmptyState
            icon={<CheckCheck className="h-6 w-6" />}
            title="No tienes muestras asignadas"
            detail="Cuando el supervisor te asigne muestras, aparecerán aquí. También puedes actualizar la lista."
            action={
              <button type="button" className="btn-secondary" onClick={() => void cargarLista()}>
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {muestras.map((muestra) => {
              const tieneCambios = Boolean(pendientes[muestra.id])
              return (
                <article
                  key={muestra.id}
                  className={cx(
                    'card overflow-hidden border-l-4 p-4 transition',
                    muestra.estado === 'hecha'
                      ? 'border-l-green-500'
                      : muestra.estado === 'no_hecha'
                        ? 'border-l-red-500'
                        : 'border-l-amber-400'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                        {muestra.tipo_nombre ?? 'Muestra'}
                      </p>
                      <p className="mt-0.5 text-3xl font-black leading-none tracking-tight text-stone-900">
                        #{muestra.numero_muestra}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-500">
                        <CalendarDays className="h-3 w-3" />
                        {muestra.fecha_asignacion === hoy
                          ? 'Asignada hoy'
                          : `Asignada el ${formatFecha(muestra.fecha_asignacion)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <EstadoBadge estado={muestra.estado} />
                      {tieneCambios && pendientes[muestra.id]?.estado !== 'pendiente' ? (
                        <span className="chip bg-amber-100 text-amber-800">Sin enviar</span>
                      ) : muestra.enviado ? (
                        <span className="chip bg-green-50 text-green-700">Enviada</span>
                      ) : null}
                      {tieneCambios && pendientes[muestra.id]?.estado === 'pendiente' ? (
                        <span className="chip bg-sky-50 text-sky-700">Detalle guardado</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3">
                    <SampleValues muestra={muestra} max={4} />
                  </div>

                  <button
                    type="button"
                    onClick={() => abrirDetalle(muestra)}
                    className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-left text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-stone-400" />
                      Ver / ajustar detalles
                    </span>
                    <ChevronRight className="h-4 w-4 text-stone-400" />
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={muestra.estado === 'hecha'}
                      onClick={() => void marcar(muestra, 'hecha')}
                      className={cx(
                        'flex min-h-[58px] items-center justify-center gap-2 rounded-xl border-2 text-sm font-extrabold transition active:scale-[0.98]',
                        muestra.estado === 'hecha'
                          ? 'border-green-600 bg-green-600 text-white shadow-sm'
                          : 'border-green-200 bg-green-50 text-green-800 hover:border-green-300'
                      )}
                    >
                      <Check className="h-6 w-6" strokeWidth={3} />
                      HECHO
                    </button>
                    <button
                      type="button"
                      aria-pressed={muestra.estado === 'no_hecha'}
                      onClick={() => void marcar(muestra, 'no_hecha')}
                      className={cx(
                        'flex min-h-[58px] items-center justify-center gap-2 rounded-xl border-2 text-sm font-extrabold transition active:scale-[0.98]',
                        muestra.estado === 'no_hecha'
                          ? 'border-red-600 bg-red-600 text-white shadow-sm'
                          : 'border-red-200 bg-red-50 text-red-700 hover:border-red-300'
                      )}
                    >
                      <X className="h-6 w-6" strokeWidth={3} />
                      NO HECHO
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {muestras.length > 0 ? (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-stone-400">
            Tus marcas quedan guardadas en este teléfono hasta que pulses ENVIAR.
          </p>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 pb-safe">
          <button
            type="button"
            disabled={pendientesMarcados.length === 0}
            onClick={() => {
              setErrorEnvio('')
              setConfirmarEnvio(true)
            }}
            className={cx(
              'flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-xl text-base font-extrabold tracking-wide transition active:scale-[0.99]',
              pendientesMarcados.length
                ? 'bg-green-700 text-white shadow-sm hover:bg-green-800'
                : 'cursor-not-allowed bg-stone-200 text-stone-500'
            )}
          >
            <Send className="h-5 w-5" />
            {pendientesMarcados.length
              ? `ENVIAR LISTA (${pendientesMarcados.length})`
              : 'NADA POR ENVIAR'}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-stone-500">
            {pendientesMarcados.length
              ? 'Se sincronizará con el supervisor al enviar.'
              : borradores > 0
                ? `${borradores} detalle(s) guardado(s). Marca la muestra para poder enviarla.`
                : 'Marca cada muestra como hecha o no hecha.'}
          </p>
        </div>
      </div>

      <Modal
        open={Boolean(detalleAbierto)}
        onClose={() => setDetalleAbierto(null)}
        title={detalleAbierto ? `Muestra #${detalleAbierto.numero_muestra}` : 'Muestra'}
        subtitle={detalleAbierto?.tipo_nombre ?? undefined}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setDetalleAbierto(null)}
              disabled={guardandoDetalle}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => void guardarDetalle()}
              disabled={guardandoDetalle}
            >
              {guardandoDetalle ? <Spinner /> : <Check className="h-4 w-4" />}
              Guardar detalles
            </button>
          </div>
        }
      >
        {detalleAbierto ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <EstadoBadge estado={detalleAbierto.estado} />
              {detalleAbierto.fecha_marcado ? (
                <span className="chip bg-stone-100 text-stone-600">
                  Marcada: {formatFecha(detalleAbierto.fecha_marcado)}{' '}
                  {detalleAbierto.hora_marcado?.slice(0, 5)}
                </span>
              ) : null}
            </div>
            <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-800">
              Ajusta los detalles si la realidad del campo difiere de lo asignado. Se guardan en
              este teléfono y se envían con tu lista.
            </p>
            <CampoInputs
              campos={detalleAbierto.campos}
              valores={valoresDetalle}
              onChange={(campoId, valor) =>
                setValoresDetalle((prev) => ({ ...prev, [campoId]: valor }))
              }
              idPrefix={`detalle-${detalleAbierto.id}`}
            />
            <p className="text-[11px] text-stone-400">Los campos con * son requeridos.</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={confirmarEnvio}
        onClose={() => {
          if (enviando) return
          setConfirmarEnvio(false)
        }}
        title="¿Enviar tu lista?"
        subtitle="El supervisor verá estas muestras en su reporte maestro."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setConfirmarEnvio(false)}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => void enviarLista()}
              disabled={enviando || pendientesMarcados.length === 0}
            >
              {enviando ? <Spinner /> : <CloudUpload className="h-4 w-4" />}
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-green-50 px-3 py-3 text-center">
              <p className="text-2xl font-black text-green-800">
                {pendientesMarcados.filter((item) => item.estado === 'hecha').length}
              </p>
              <p className="text-xs font-semibold text-green-700">Hechas</p>
            </div>
            <div className="rounded-xl bg-red-50 px-3 py-3 text-center">
              <p className="text-2xl font-black text-red-700">
                {pendientesMarcados.filter((item) => item.estado === 'no_hecha').length}
              </p>
              <p className="text-xs font-semibold text-red-600">No hechas</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-stone-600">
            Se enviarán <strong>{pendientesMarcados.length}</strong> muestra
            {pendientesMarcados.length === 1 ? '' : 's'} con la fecha y hora en que las marcaste.
            {borradores > 0
              ? ` Los ${borradores} detalle(s) sin marcar quedan guardados para después.`
              : ''}
          </p>

          {offline ? (
            <Alert tone="warning">
              No hay conexión. Tus marcas están a salvo en el teléfono; conéctate y vuelve a
              intentar.
            </Alert>
          ) : null}

          {errorEnvio ? <Alert tone="error">{errorEnvio}</Alert> : null}

          <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-xs leading-relaxed text-stone-500">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
            Después de enviar, esas muestras se marcan automáticamente en el reporte maestro. Si
            necesitas corregir algo, puedes volver a marcarla y enviar de nuevo.
          </div>
        </div>
      </Modal>
    </div>
  )
}
