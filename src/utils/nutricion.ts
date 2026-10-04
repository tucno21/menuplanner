export interface Nutricion {
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number
}

// Unidades fijas: calorias = kcal, el resto = gramos.
// No se almacenan como texto: el nombre del campo define la unidad.
export const NUTRICION_KEYS = ['calorias', 'proteinas', 'carbohidratos', 'grasas', 'fibra'] as const

export type NutricionKey = (typeof NUTRICION_KEYS)[number]

// Unidades de referencia validas para la nutricion de un ingrediente
export const UNIDADES_BASE = ['gr', 'ml', 'unidad'] as const

export type UnidadBase = (typeof UNIDADES_BASE)[number]

// Nutricion del ingrediente expresada por `base` de `unidadBase`
// (ej: base 100, unidadBase 'gr' = valores por cada 100 gramos;
//  base 1, unidadBase 'unidad' = valores por unidad/huevo/pieza)
export interface NutricionIngrediente {
  base: number
  unidadBase: UnidadBase
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number
}

// Columnas planas para Google Sheets (TABLE_FIELDS de ingredientes)
export const NUTRICION_ING_SYNC_FIELDS = [
  'nutBase',
  'nutUnidadBase',
  'nutCalorias',
  'nutProteinas',
  'nutCarbohidratos',
  'nutGrasas',
  'nutFibra',
] as const

export type NutricionParseResult =
  | { ok: true; porciones?: number; nutricion?: Nutricion }
  | { ok: false; error: string }

export function crearNutricionVacia(): Nutricion {
  return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
}

// Valida porciones + nutricion de una receta entrante (import JSON).
// - porciones: opcional; si viene debe ser numero > 0
// - nutricion: opcional; si viene debe ser objeto; campos faltantes = 0;
//   valores no numericos o negativos rechazan la receta completa
export function validarNutricionReceta(
  input: { porciones?: unknown; nutricion?: unknown },
  nombrePlato: string
): NutricionParseResult {
  let porciones: number | undefined
  const rawPorc = input.porciones
  if (rawPorc !== undefined && rawPorc !== null && rawPorc !== '') {
    const n = Number(rawPorc)
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: `Valor invalido de porciones en el plato "${nombrePlato}"` }
    }
    porciones = n
  }

  const raw = input.nutricion
  if (raw === undefined || raw === null) return { ok: true, porciones }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: `Valor invalido de nutricion en el plato "${nombrePlato}"` }
  }

  const obj = raw as Record<string, unknown>
  let conDatos = false
  const nutricion = crearNutricionVacia()
  for (const key of NUTRICION_KEYS) {
    const v = obj[key]
    if (v === undefined || v === null || v === '') continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `Valor invalido de ${key} en el plato "${nombrePlato}"` }
    }
    nutricion[key] = n
    conDatos = true
  }
  return { ok: true, porciones, nutricion: conDatos ? nutricion : undefined }
}

export type NutricionIngredienteParseResult =
  | { ok: true; nutricion?: NutricionIngrediente }
  | { ok: false; error: string }

function normalizarUnidadBase(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'g') return 'gr'
  return s
}

// Valida la nutricion de un ingrediente entrante (import JSON / sync).
// - undefined/null -> ok sin nutricion (JSONs antiguos siguen validos)
// - base: numero > 0 requerido
// - unidadBase: 'gr' | 'ml' | 'unidad' (acepta 'g' como alias de 'gr')
// - los 5 valores: faltantes -> 0; no numericos o negativos -> error
export function validarNutricionIngrediente(raw: unknown, nombre: string): NutricionIngredienteParseResult {
  if (raw === undefined || raw === null) return { ok: true }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: `Nutricion invalida para "${nombre}"` }
  }

  const obj = raw as Record<string, unknown>

  const baseN = Number(obj.base)
  if (obj.base === undefined || obj.base === null || obj.base === '' || !Number.isFinite(baseN) || baseN <= 0) {
    return { ok: false, error: `Valor invalido de base para "${nombre}"` }
  }

  const unidadBase = normalizarUnidadBase(obj.unidadBase)
  if (!UNIDADES_BASE.includes(unidadBase as UnidadBase)) {
    return { ok: false, error: `Valor invalido de unidadBase para "${nombre}" (usa gr, ml o unidad)` }
  }

  const nutricion: NutricionIngrediente = {
    base: baseN,
    unidadBase: unidadBase as UnidadBase,
    calorias: 0,
    proteinas: 0,
    carbohidratos: 0,
    grasas: 0,
    fibra: 0,
  }
  for (const key of NUTRICION_KEYS) {
    const v = obj[key]
    if (v === undefined || v === null || v === '') continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `Valor invalido de ${key} para "${nombre}"` }
    }
    nutricion[key] = n
  }
  return { ok: true, nutricion }
}

export type PesoPorUnidadParseResult =
  | { ok: true; peso?: number }
  | { ok: false; error: string }

// Valida pesoPorUnidad del ingrediente (gramos que pesa 1 'unidad').
// Opcional. Estricto: solo numero finito > 0 (el string "600" es invalido).
export function validarPesoPorUnidad(valor: unknown, nombre: string): PesoPorUnidadParseResult {
  if (valor === undefined || valor === null) return { ok: true }
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return {
      ok: false,
      error: `Valor invalido de pesoPorUnidad para "${nombre}" (debe ser un numero de gramos mayor a 0)`,
    }
  }
  return { ok: true, peso: valor }
}
