import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  TriangleAlert,
  X,
  XCircle,
} from 'lucide-react'
import type { EstadoMuestra } from '../types'
import { cx } from '../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin', className)} aria-hidden="true" />
}

export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-stone-100 text-stone-500">
      <Spinner className="h-7 w-7 text-green-700" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-stone-500">
      <Spinner className="text-green-700" />
      {label}
    </div>
  )
}

const ESTADOS: Record<
  EstadoMuestra,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  hecha: {
    label: 'Hecha',
    className: 'bg-green-100 text-green-800',
    Icon: CheckCircle2,
  },
  no_hecha: {
    label: 'No hecha',
    className: 'bg-red-100 text-red-700',
    Icon: XCircle,
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-800',
    Icon: Clock3,
  },
}

export function EstadoBadge({
  estado,
  size = 'md',
}: {
  estado: EstadoMuestra
  size?: 'sm' | 'md'
}) {
  const info = ESTADOS[estado]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        info.className,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      <info.Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {info.label}
    </span>
  )
}

const TONES = {
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-800',
    Icon: AlertCircle,
  },
  success: {
    wrap: 'border-green-200 bg-green-50 text-green-800',
    Icon: CheckCircle2,
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-900',
    Icon: TriangleAlert,
  },
  info: {
    wrap: 'border-sky-200 bg-sky-50 text-sky-800',
    Icon: Info,
  },
}

export function Alert({
  tone = 'error',
  children,
  onClose,
}: {
  tone?: keyof typeof TONES
  children: ReactNode
  onClose?: () => void
}) {
  const info = TONES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', info.wrap)}
    >
      <info.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="-m-1 shrink-0 rounded-lg p-1 opacity-60 transition hover:opacity-100"
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  detail,
  icon,
  action,
}: {
  title: string
  detail?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      {detail ? <p className="mt-1 max-w-xs text-sm text-stone-500">{detail}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-stone-900/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Cerrar ventana"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-start gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-stone-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-xl p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-stone-100 bg-stone-50/70 px-5 py-4 pb-safe">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirmar',
  tone = 'danger',
  busy = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-sm leading-relaxed text-stone-600">{children}</div>
    </Modal>
  )
}

