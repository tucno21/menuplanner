import { crearNutricionVacia, type Nutricion, type NutricionIngrediente } from './nutricion'

// Factores de conversion EXACTOS hacia la unidad canonica del grupo.
// No se inventan conversiones: taza, lata, cucharada, etc. NO son convertibles
// (solo funcionan si la nutricion del ingrediente esta definida en esa misma unidad).
const FACTORES_MASA: Record<string, number> = {
  gr: 1,
  kg: 1000,
  libra: 453.592,
  onza: 28.3495,
}

const FACTORES_VOLUMEN: Record<string, number> = {
  ml: 1,
  l: 1000,
}

// Factor para pasar una cantidad desde `desde` a `hacia`.
// Devuelve null si no existe una conversion exacta.
export function factorConversion(desde: string, hacia: string): number | null {
  const d = String(desde ?? '').trim().toLowerCase()
  const h = String(hacia ?? '').trim().toLowerCase()
  if (!d || !h) return null
  if (d === h) return 1
  if (FACTORES_MASA[d] !== undefined && FACTORES_MASA[h] !== undefined) {
    return FACTORES_MASA[d] / FACTORES_MASA[h]
  }
  if (FACTORES_VOLUMEN[d] !== undefined && FACTORES_VOLUMEN[h] !== undefined) {
    return FACTORES_VOLUMEN[d] / FACTORES_VOLUMEN[h]
  }
  return null
}

export interface LineaReceta {
  nombre: string
  cantidad: number
  unidad: string
  nutricion?: NutricionIngrediente | null
}

export type EstadoCalculo = 'calculado' | 'parcial' | 'sin-informacion'

export interface ResultadoCalculo {
  estado: EstadoCalculo
  total: Nutricion | null
  porPorcion: Nutricion | null
  porciones: number | null
  faltantes: string[]
}

function redondear(n: Nutricion): Nutricion {
  return {
    calorias: Math.round(n.calorias * 10) / 10,
    proteinas: Math.round(n.proteinas * 10) / 10,
    carbohidratos: Math.round(n.carbohidratos * 10) / 10,
    grasas: Math.round(n.grasas * 10) / 10,
    fibra: Math.round(n.fibra * 10) / 10,
  }
}

// Calcula la nutricion de una receta a partir de sus lineas de ingredientes.
// nutricion del ingrediente x cantidad (convertida a unidadBase) / base = aporte
// - estado 'calculado': todas las lineas aportaron datos
// - estado 'parcial': algunas lineas no tienen datos o su unidad no es convertible
// - estado 'sin-informacion': ninguna linea aportó datos (no se inventan valores)
// - porPorcion solo se calcula si porciones > 0
export function calcularNutricionReceta(lineas: LineaReceta[], porciones?: number): ResultadoCalculo {
  const nombresFaltantes = new Set<string>()
  const total = crearNutricionVacia()
  let conDatos = false

  for (const linea of lineas) {
    if (!linea.nutricion || !Number.isFinite(linea.cantidad) || linea.cantidad <= 0 || linea.nutricion.base <= 0) {
      nombresFaltantes.add(linea.nombre)
      continue
    }
    const factor = factorConversion(linea.unidad, linea.nutricion.unidadBase)
    if (factor === null) {
      nombresFaltantes.add(linea.nombre)
      continue
    }
    const coef = (linea.cantidad * factor) / linea.nutricion.base
    total.calorias += linea.nutricion.calorias * coef
    total.proteinas += linea.nutricion.proteinas * coef
    total.carbohidratos += linea.nutricion.carbohidratos * coef
    total.grasas += linea.nutricion.grasas * coef
    total.fibra += linea.nutricion.fibra * coef
    conDatos = true
  }

  const porc = Number(porciones)
  const porcionesValidas = Number.isFinite(porc) && porc > 0 ? porc : null

  const totalRedondeado = conDatos ? redondear(total) : null
  const porPorcion = conDatos && porcionesValidas
    ? redondear({
        calorias: total.calorias / porcionesValidas!,
        proteinas: total.proteinas / porcionesValidas!,
        carbohidratos: total.carbohidratos / porcionesValidas!,
        grasas: total.grasas / porcionesValidas!,
        fibra: total.fibra / porcionesValidas!,
      })
    : null

  const estado: EstadoCalculo = !conDatos
    ? 'sin-informacion'
    : nombresFaltantes.size > 0
      ? 'parcial'
      : 'calculado'

  return {
    estado,
    total: totalRedondeado,
    porPorcion,
    porciones: porcionesValidas,
    faltantes: [...nombresFaltantes],
  }
}

// Formato para UI: 1 decimal maximo, sin ceros de mas
export function formatarNutricional(n: number): string {
  return String(Math.round(n * 10) / 10)
}
