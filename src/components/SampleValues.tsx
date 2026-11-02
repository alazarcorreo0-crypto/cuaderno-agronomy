import type { Muestra } from '../types'

export function SampleValues({
  muestra,
  max = 4,
  className,
}: {
  muestra: Pick<Muestra, 'campos' | 'valores'>
  max?: number
  className?: string
}) {
  const entries = muestra.campos
    .map((campo) => ({
      nombre: campo.nombre_campo,
      valor: (muestra.valores[campo.id] ?? '').trim(),
    }))
    .filter((item) => item.valor)

  if (!entries.length) {
    return <p className="text-xs text-stone-400">Sin detalles registrados</p>
  }

  const visibles = entries.slice(0, max)
  const restantes = entries.length - visibles.length

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      {visibles.map((item) => (
        <span
          key={item.nombre}
          className="inline-flex max-w-full items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] leading-tight text-stone-600"
        >
          <span className="font-semibold text-stone-500">{item.nombre}:</span>
          <span className="truncate">{item.valor}</span>
        </span>
      ))}
      {restantes > 0 ? (
        <span className="chip bg-stone-100 text-stone-500">+{restantes} más</span>
      ) : null}
    </div>
  )
}
