import { generarPlanSemanal, type SlotPlanSemanal } from './planificarSemana'

const MODELO_GEMINI = 'gemini-3.8-flash'
// Google retira modelos viejos periodicamente (gemini-2.0-flash dejo de existir).
// Si el modelo principal responde 404, se reintenta con el alias movil mas reciente.
const MODELO_GEMINI_FALLBACK = 'gemini-flash-latest'
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_IA_MS = 30_000

// La IA decide cuantos platos por dia dentro de este rango
export const MAX_PLATOS_POR_DIA_IA = 3

export interface NutricionPorPorcion {
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number
}

// Informacion que se envia a la IA por cada plato candidato:
// nombre, etiquetas, ingredientes (solo nombres) y nutricion aproximada
// por porcion cuando se pudo calcular (decisiones de salud)
export interface PlatoParaIA {
  id: number
  nombre: string
  etiquetas: string[]
  ingredientes: string[]
  nutricionPorPorcion?: NutricionPorPorcion
  porciones?: number
}

export function construirPromptIA(
  candidatos: PlatoParaIA[],
  fechasVacias: string[],
  existentesPorFecha: Map<string, number[]>,
  comentario: string
): string {
  const lineas: string[] = []
  lineas.push('Eres un planificador de comidas. Asigna platos a los dias indicados.')
  lineas.push('')
  lineas.push('PLATOS DISPONIBLES (solo puedes usar estos ids):')
  for (const p of candidatos) {
    let linea = `- id ${p.id}: "${p.nombre}"`
    if (p.etiquetas.length > 0) linea += ` (etiquetas: ${p.etiquetas.join(', ')})`
    lineas.push(linea)
    if (p.ingredientes.length > 0) {
      lineas.push(`  Ingredientes: ${p.ingredientes.join(', ')}`)
    }
    if (p.nutricionPorPorcion) {
      const n = p.nutricionPorPorcion
      lineas.push(
        `  Aprox. por porcion: ${n.calorias} kcal, ${n.proteinas} g proteina, ${n.carbohidratos} g carbohidratos, ${n.grasas} g grasas, ${n.fibra} g fibra`
      )
    }
    if (p.porciones !== undefined) {
      lineas.push(`  Porciones: ${p.porciones}`)
    }
  }
  lineas.push('')
  lineas.push('DIAS A PLANIFICAR (vacios):')
  lineas.push(fechasVacias.join(', '))

  const ocupados = [...existentesPorFecha.entries()].filter(([, ids]) => ids.length > 0)
  if (ocupados.length > 0) {
    lineas.push('')
    lineas.push('DIAS QUE YA TIENEN PLATOS (no los cambies ni repitas esos platos al dia siguiente):')
    for (const [fecha, ids] of ocupados) {
      const nombres = ids.map((id) => candidatos.find((c) => c.id === id)?.nombre ?? `id ${id}`)
      lineas.push(`- ${fecha}: ${nombres.join(', ')}`)
    }
  }

  lineas.push('')
  lineas.push('REGLAS:')
  lineas.push('- Decide cuantos platos por dia (entre 1 y 3) segun el contexto.')
  lineas.push('- No repitas el mismo plato el mismo dia.')
  lineas.push('- Evita repetir platos del dia anterior.')
  lineas.push('- Usa unicamente ids de la lista de platos disponibles.')
  lineas.push('- Considera los ingredientes y la nutricion aproximada para decisiones de salud.')
  lineas.push('- Todos los dias indicados deben quedar planificados.')
  lineas.push('- Toda la semana debe quedar planificada.')

  if (comentario.trim()) {
    lineas.push('')
    lineas.push('INDICACIONES DEL USUARIO (prioridad alta):')
    lineas.push(comentario.trim())
  }

  lineas.push('')
  lineas.push('Responde SOLO con un array JSON (sin texto adicional), con este formato exacto:')
  lineas.push('[{"fecha": "YYYY-MM-DD", "platos": [id1, id2]}]')
  lineas.push(`Incluye TODOS estos dias: ${fechasVacias.join(', ')}`)
  return lineas.join('\n')
}

// Valida la respuesta de la IA (all-or-nothing):
// - JSON array, fechas solo de los dias vacios, ids existentes en candidatos,
//   entre 1 y MAX_PLATOS_POR_DIA_IA platos por dia, sin repetir plato el mismo dia
export function validarRespuestaIA(
  texto: string,
  idsValidos: Set<number>,
  fechasVacias: string[]
): { ok: true; slots: SlotPlanSemanal[] } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(texto)
  } catch {
    return { ok: false, error: 'La IA devolvio un JSON invalido' }
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'La IA no devolvio el formato esperado' }
  }

  const fechasPermitidas = new Set(fechasVacias)
  const slots: SlotPlanSemanal[] = []

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'La IA devolvio un formato inesperado' }
    }
    const { fecha, platos } = item as { fecha?: unknown; platos?: unknown }
    if (typeof fecha !== 'string' || !fechasPermitidas.has(fecha)) {
      return { ok: false, error: `La IA devolvio una fecha inesperada: ${JSON.stringify(fecha)}` }
    }
    if (!Array.isArray(platos) || platos.length === 0 || platos.length > MAX_PLATOS_POR_DIA_IA) {
      return { ok: false, error: `Cantidad de platos invalida para ${fecha}` }
    }
    const vistos = new Set<number>()
    for (const id of platos) {
      if (typeof id !== 'number' || !idsValidos.has(id)) {
        return { ok: false, error: `La IA eligio un plato inexistente (id ${JSON.stringify(id)})` }
      }
      if (vistos.has(id)) {
        return { ok: false, error: `La IA repitio un plato el mismo dia (${fecha})` }
      }
      vistos.add(id)
      slots.push({ fecha, platoId: id })
    }
  }
  return { ok: true, slots }
}

export interface ResultadoIA {
  ok: boolean
  slots: SlotPlanSemanal[]
  // Dias que la IA omitio y fueron rellenados con el plan local
  avisoLocal?: string
  error?: string
}

// Llama a Gemini, valida la respuesta y completa dias omitidos con el
// planificador local (hibrido). La validacion es all-or-nothing: si la IA
// devuelve algo invalido, no se guarda nada (el llamador decide el fallback).
export async function planificarConIA(opciones: {
  candidatos: PlatoParaIA[]
  fechas: string[]
  existentesPorFecha: Map<string, number[]>
  comentario: string
  apiKey: string
  fetchFn?: typeof fetch
}): Promise<ResultadoIA> {
  const { candidatos, fechas, existentesPorFecha, comentario, apiKey, fetchFn = fetch } = opciones

  const fechasVacias = fechas.filter((f) => (existentesPorFecha.get(f) ?? []).length === 0)
  if (fechasVacias.length === 0) return { ok: true, slots: [] }
  if (candidatos.length === 0) {
    return { ok: false, slots: [], error: 'No hay platos con las etiquetas seleccionadas' }
  }

  const prompt = construirPromptIA(candidatos, fechasVacias, existentesPorFecha, comentario)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_IA_MS)
  try {
    const llamada = (modelo: string) =>
      fetchFn(
        `${URL_GEMINI}/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
          }),
        }
      )

    let res = await llamada(MODELO_GEMINI)
    // Modelo retirado por Google (404) -> reintenta con el alias mas reciente
    if (res.status === 404) {
      res = await llamada(MODELO_GEMINI_FALLBACK)
    }

    if (!res.ok) {
      const error =
        res.status === 400 || res.status === 401 || res.status === 403
          ? 'API key de Gemini invalida'
          : `Error de Gemini (HTTP ${res.status})`
      return { ok: false, slots: [], error }
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const validacion = validarRespuestaIA(texto, new Set(candidatos.map((c) => c.id)), fechasVacias)
    if (!validacion.ok) {
      return { ok: false, slots: [], error: validacion.error }
    }

    // Dias que la IA omitio -> rellenar con el planificador local
    const slotsPorFecha = new Map<string, number[]>()
    for (const s of validacion.slots) {
      const lista = slotsPorFecha.get(s.fecha) ?? []
      lista.push(s.platoId)
      slotsPorFecha.set(s.fecha, lista)
    }
    const mapaCompleto = new Map(existentesPorFecha)
    for (const [f, ids] of slotsPorFecha) mapaCompleto.set(f, ids)

    const cubiertas = new Set(validacion.slots.map((s) => s.fecha))
    const omitidas = fechasVacias.filter((f) => !cubiertas.has(f))
    const slots = [...validacion.slots]
    let avisoLocal: string | undefined
    if (omitidas.length > 0) {
      slots.push(...generarPlanSemanal(candidatos, omitidas, mapaCompleto))
      avisoLocal = `La IA no planifico ${omitidas.length} dia(s), se completaron con el plan local`
    }

    return { ok: true, slots, avisoLocal }
  } catch (err) {
    const error =
      err instanceof Error && err.name === 'AbortError'
        ? 'Tiempo agotado con Gemini'
        : 'No se pudo conectar con Gemini'
    return { ok: false, slots: [], error }
  } finally {
    clearTimeout(timer)
  }
}
