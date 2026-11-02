import type { Campo } from '../types'
import { cx } from '../lib/utils'

const TIPO_LABEL: Record<Campo['tipo_dato'], string> = {
  texto: 'Texto',
  numero: 'Número',
  seleccion: 'Selección',
  rango: 'Rango',
}

export function CampoInputs({
  campos,
  valores,
  onChange,
  idPrefix,
  disabled = false,
}: {
  campos: Campo[]
  valores: Record<string, string>
  onChange: (campoId: string, valor: string) => void
  idPrefix: string
  disabled?: boolean
}) {
  if (!campos.length) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500">
        Este tipo de muestra todavía no tiene campos configurados.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {campos.map((campo) => {
        const inputId = `${idPrefix}-${campo.id}`
        const value = valores[campo.id] ?? ''
        return (
          <div key={campo.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor={inputId} className="label mb-0">
                {campo.nombre_campo}
                {campo.requerido ? <span className="ml-0.5 text-red-500">*</span> : null}
              </label>
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-stone-400">
                {TIPO_LABEL[campo.tipo_dato]}
              </span>
            </div>

            {campo.tipo_dato === 'seleccion' || campo.tipo_dato === 'rango' ? (
              <select
                id={inputId}
                className={cx('input', !value && 'text-stone-400')}
                value={value}
                onChange={(event) => onChange(campo.id, event.target.value)}
                disabled={disabled}
              >
                <option value="">Seleccionar…</option>
                {(campo.opciones ?? []).map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={inputId}
                className="input"
                type={campo.tipo_dato === 'numero' ? 'number' : 'text'}
                inputMode={campo.tipo_dato === 'numero' ? 'decimal' : 'text'}
                step={campo.tipo_dato === 'numero' ? 'any' : undefined}
                value={value}
                placeholder={campo.tipo_dato === 'numero' ? '0' : 'Escribe aquí…'}
                onChange={(event) => onChange(campo.id, event.target.value)}
                disabled={disabled}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
