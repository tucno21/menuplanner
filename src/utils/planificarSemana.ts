// Planificador semanal local (sin IA, offline).
// Genera la propuesta de planificaciones para llenar los dias vacios de una semana.

export interface SlotPlanSemanal {
  fecha: string
  platoId: number
}

export interface OpcionesPlanificador {
  // platos por dia vacio (default 2)
  porDia?: number
  // aleatoriedad inyectable para tests (default Math.random)
  rng?: () => number
}

function elegir(
  ids: number[],
  usadosHoy: Set<number>,
  prohibidos: Set<number>,
  rng: () => number
): number | undefined {
  // 1er intento: que no este usado hoy NI prohibido (dia anterior) -> evita repetir consecutivo
  const pool1 = ids.filter((id) => !usadosHoy.has(id) && !prohibidos.has(id))
  if (pool1.length > 0) return pool1[Math.floor(rng() * pool1.length)]
  // 2do intento: solo evita duplicar el mismo dia (permite repetir vs dia anterior si no hay alternativa)
  const pool2 = ids.filter((id) => !usadosHoy.has(id))
  if (pool2.length > 0) return pool2[Math.floor(rng() * pool2.length)]
  // 3er intento: menos candidatos que porDia -> rellena igual (el mismo plato puede salir 2 veces el mismo dia)
  if (ids.length > 0) return ids[Math.floor(rng() * ids.length)]
  return undefined
}

// YYYY-MM-DD -> YYYY-MM-DD del dia anterior (aritmetica UTC, sin shift local)
function fechaAnterior(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// - Solo asigna a fechas SIN planificaciones previas (existentesPorFecha[fecha] vacio).
//   Los dias con platos ya asignados se saltan (no destructivo).
// - Cada dia vacio recibe `porDia` platos distintos entre si (si hay suficientes candidatos).
// - Evita repetir platos del dia anterior (calendario real o asignado en esta pasada)
//   mientras existan alternativas.
// - Puro: devuelve la propuesta, no escribe nada.
export function generarPlanSemanal(
  candidatos: { id: number }[],
  fechas: string[],
  existentesPorFecha: Map<string, number[]>,
  opciones: OpcionesPlanificador = {}
): SlotPlanSemanal[] {
  const porDia = opciones.porDia ?? 2
  const rng = opciones.rng ?? Math.random
  const slots: SlotPlanSemanal[] = []

  const ids = candidatos.map((c) => c.id)
  if (ids.length === 0 || fechas.length === 0) return slots

  let asignadosAyer = new Set<number>()

  for (const fecha of fechas) {
    const existentes = existentesPorFecha.get(fecha) ?? []
    if (existentes.length > 0) {
      asignadosAyer = new Set(existentes)
      continue
    }

    const prohibidos = new Set(asignadosAyer)
    for (const id of existentesPorFecha.get(fechaAnterior(fecha)) ?? []) {
      prohibidos.add(id)
    }

    const usadosHoy = new Set<number>()
    for (let i = 0; i < porDia; i++) {
      const elegido = elegir(ids, usadosHoy, prohibidos, rng)
      if (elegido === undefined) break
      slots.push({ fecha, platoId: elegido })
      usadosHoy.add(elegido)
    }
    asignadosAyer = new Set(usadosHoy)
  }

  return slots
}
