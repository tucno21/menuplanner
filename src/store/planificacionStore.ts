import { create } from 'zustand'
import {
  db,
  type Plato,
  type Ingrediente,
  type Compra,
  type EstadoPlato,
  type Planificacion,
  type Unidad,
  type Etiqueta,
  type PlatoEtiqueta,
} from '../db/dexie'
import { validarNutricionReceta, validarNutricionIngrediente, type Nutricion, type NutricionIngrediente } from '../utils/nutricion'
import { generarPlanSemanal, type SlotPlanSemanal } from '../utils/planificarSemana'
import { planificarConIA, type PlatoParaIA } from '../utils/planificarSemanaIA'
import { calcularNutricionReceta } from '../utils/calcularNutricion'

const nowISO = () => new Date().toISOString()
const newSyncId = () => crypto.randomUUID()

export interface IngredienteImport {
  nombre: string
  unidad?: string
  nutricion?: unknown
}

export interface PlatoReceta {
  nombre: string
  descripcion?: string
  etiquetas?: string[]
  porciones?: number
  nutricion?: Nutricion
  ingredientes: { nombre: string; cantidad: number; unidad: string }[]
}

export type ImportResult = { ok: true; total: number } | { ok: false; error: string }

export interface PlatoPlanificacion {
  planificacionId: number
  platoId: number
  nombre: string
  descripcion: string
  estado: EstadoPlato
}

export interface DataPlanificacion {
  fecha: string
  platos: PlatoPlanificacion[]
}

export interface PlatoWithIngredientes {
  id: number
  nombre: string
  descripcion: string
  porciones?: number
  nutricion?: Nutricion
  ingredientes: { id: number; nombre: string; cantidad: string; unidad: string; nutricion?: NutricionIngrediente }[]
  etiquetas: { id: number; nombre: string }[]
}

export interface ResultadoPlanificador {
  ok: boolean
  dias: number
  platosAsignados: number
  error?: string
  // Aviso de que parte (o todo) el plan se genero con el algoritmo local
  avisoLocal?: string
}

export interface ListaItem {
  id: number
  ingrediente: string
  cantidad_total: string
  unidad: string
}

interface PlanificacionState {
  planificacion: DataPlanificacion[]
  platos: Plato[]
  ingredientes: Ingrediente[]
  unidades: Unidad[]
  etiquetas: Etiqueta[]
  platoEtiquetas: PlatoEtiqueta[]
  compras: Compra[]
  loading: boolean

  initialize: () => Promise<void>

  getPlatosFecha: (fecha: string) => DataPlanificacion | null
  addPlatoToFecha: (platoId: number, fecha: string, estado: EstadoPlato) => Promise<boolean>
  planificarSemana: (fechas: string[], etiquetasSeleccionadas: string[]) => Promise<ResultadoPlanificador>
  planificarSemanaConIA: (fechas: string[], etiquetasSeleccionadas: string[], comentario: string) => Promise<ResultadoPlanificador>
  setModificarEstado: (planificacionId: number) => Promise<void>
  removePlanificacion: (planificacionId: number) => Promise<boolean>
  getPlanificacionBetweenDates: (fechaInicio: string, fechaFin: string) => DataPlanificacion[]

  loadPlatos: () => Promise<void>
  createPlato: (data: { nombre: string; descripcion: string; ingredientes: { id: number; cantidad: number }[]; etiquetas: number[]; porciones?: number; nutricion?: Nutricion }) => Promise<void>
  updatePlato: (id: number, data: { nombre: string; descripcion: string; ingredientes: { id: number; cantidad: number }[]; etiquetas: number[]; porciones?: number; nutricion?: Nutricion }) => Promise<void>
  deletePlato: (id: number) => Promise<void>
  getPlatoById: (id: number) => Promise<PlatoWithIngredientes | null>

  loadIngredientes: () => Promise<void>
  createIngrediente: (data: { nombre: string; unidad: string; nutricion?: NutricionIngrediente }) => Promise<void>
  updateIngrediente: (id: number, data: { nombre: string; unidad: string; nutricion?: NutricionIngrediente }) => Promise<void>
  deleteIngrediente: (id: number) => Promise<void>
  importarIngredientes: (items: IngredienteImport[]) => Promise<ImportResult>

  loadUnidades: () => Promise<void>
  createUnidad: (data: { nombre: string }) => Promise<void>
  updateUnidad: (id: number, data: { nombre: string }) => Promise<void>
  deleteUnidad: (id: number) => Promise<void>
  reemplazarUnidades: (nombres: string[]) => Promise<number>

  loadEtiquetas: () => Promise<void>
  createEtiqueta: (data: { nombre: string }) => Promise<void>
  updateEtiqueta: (id: number, data: { nombre: string }) => Promise<void>
  deleteEtiqueta: (id: number) => Promise<void>
  importarEtiquetas: (nombres: string[]) => Promise<ImportResult>

  importarPlatos: (recetas: PlatoReceta[]) => Promise<ImportResult>

  calcularListaCompras: (fechaInicio: string, fechaFin: string) => Promise<ListaItem[]>
  loadCompras: (numeroSemana: number, anio: number) => Promise<void>
  toggleCompra: (ingredienteId: number, cantidad: string, numeroSemana: number, anio: number) => Promise<void>
}

const construirPlanificacion = async (): Promise<DataPlanificacion[]> => {
  const allPlanificaciones = await db.planificaciones.toArray()
  const allPlatos = await db.platos.toArray()

  const mapa: Record<string, DataPlanificacion> = {}

  for (const plan of allPlanificaciones) {
    if (!plan.id) continue
    const fecha = plan.fecha
    let plato = allPlatos.find((p) => p.id === plan.platoId)
    if (!plato && plan.platoSyncId) {
      plato = allPlatos.find((p) => p.syncId === plan.platoSyncId)
    }
    if (!plato) continue

    if (!mapa[fecha]) {
      mapa[fecha] = { fecha, platos: [] }
    }

    mapa[fecha].platos.push({
      planificacionId: plan.id,
      platoId: plan.platoId,
      nombre: plato.nombre,
      descripcion: plato.descripcion,
      estado: plan.estado,
    })
  }

  return Object.values(mapa)
}

async function trackDeletion(syncId: string, table: string) {
  await db.deletions.add({ syncId, table, deletedAt: nowISO() })
}

// ── Planificador de semana (local e IA) ──

function construirMapaEtiquetas(etiquetas: Etiqueta[], platoEtiquetas: PlatoEtiqueta[]): Map<number, string[]> {
  const mapa = new Map<number, string[]>()
  for (const pe of platoEtiquetas) {
    const etq = etiquetas.find((e) => e.id === pe.etiquetaId)
    if (!etq || pe.platoId == null) continue
    const lista = mapa.get(pe.platoId) ?? []
    lista.push(etq.nombre)
    mapa.set(pe.platoId, lista)
  }
  return mapa
}

// Un plato coincide si tiene ALGUNA de las etiquetas seleccionadas (OR, sin tildes)
function filtrarCandidatosPorEtiquetas(
  platos: Plato[],
  mapaEtiquetas: Map<number, string[]>,
  seleccion: string[]
): { id: number; nombre: string }[] {
  const claves = new Set(seleccion.map((e) => e.toLowerCase()))
  return platos
    .filter((p) => {
      if (p.id == null) return false
      const etqs = mapaEtiquetas.get(p.id) ?? []
      return etqs.some((nombre) => claves.has(nombre.toLowerCase()))
    })
    .map((p) => ({ id: p.id as number, nombre: p.nombre }))
}

async function construirCandidatosIA(
  candidatos: { id: number; nombre: string }[],
  mapaEtiquetas: Map<number, string[]>,
  platos: Plato[],
  ingredientes: Ingrediente[]
): Promise<PlatoParaIA[]> {
  if (candidatos.length === 0) return []
  const junctions = await db.platoIngredientes
    .where('platoId')
    .anyOf(candidatos.map((c) => c.id))
    .toArray()
  const ingPorId = new Map(ingredientes.map((i) => [i.id as number, i]))

  return candidatos.map((c) => {
    const nombres: string[] = []
    const lineas: { nombre: string; cantidad: number; unidad: string; nutricion: NutricionIngrediente | null }[] = []
    for (const pi of junctions) {
      if (pi.platoId !== c.id) continue
      const ing = ingPorId.get(pi.ingredienteId)
      if (!ing) continue
      nombres.push(ing.nombre)
      lineas.push({ nombre: ing.nombre, cantidad: pi.cantidad, unidad: ing.unidad, nutricion: ing.nutricion ?? null })
    }
    const platoRow = platos.find((p) => p.id === c.id)
    const calculo = calcularNutricionReceta(lineas, platoRow?.porciones)
    return {
      id: c.id,
      nombre: c.nombre,
      etiquetas: mapaEtiquetas.get(c.id) ?? [],
      ingredientes: nombres,
      nutricionPorPorcion: calculo.porPorcion ?? undefined,
      porciones: platoRow?.porciones,
    }
  })
}

async function insertarPlanificaciones(
  slots: SlotPlanSemanal[],
  platos: Plato[],
  refrescar: () => Promise<void>
): Promise<{ dias: number; platosAsignados: number }> {
  if (slots.length === 0) return { dias: 0, platosAsignados: 0 }
  const ts = nowISO()
  const registros: Planificacion[] = slots.map((s) => {
    const plato = platos.find((p) => p.id === s.platoId)
    return {
      syncId: newSyncId(),
      platoId: s.platoId,
      platoSyncId: plato?.syncId ?? '',
      fecha: s.fecha,
      estado: 'pendiente' as EstadoPlato,
      updatedAt: ts,
    }
  })
  await db.planificaciones.bulkAdd(registros)
  await refrescar()
  return {
    dias: new Set(slots.map((s) => s.fecha)).size,
    platosAsignados: slots.length,
  }
}

async function deleteTracked(table: 'platos' | 'ingredientes' | 'platoIngredientes' | 'planificaciones' | 'compras' | 'unidades' | 'etiquetas' | 'platoEtiquetas', id: number) {
  const record = await db[table].get(id) as { syncId?: string } | undefined
  if (record?.syncId) await trackDeletion(record.syncId, table)
  await db[table].delete(id)
}

export const usePlanificacionStore = create<PlanificacionState>((set, get) => ({
  planificacion: [],
  platos: [],
  ingredientes: [],
  unidades: [],
  etiquetas: [],
  platoEtiquetas: [],
  compras: [],
  loading: true,

  initialize: async () => {
    const [planificacion, platos, ingredientes, unidades, etiquetas, platoEtiquetas] = await Promise.all([
      construirPlanificacion(),
      db.platos.toArray(),
      db.ingredientes.toArray(),
      db.unidades.toArray(),
      db.etiquetas.toArray(),
      db.platoEtiquetas.toArray(),
    ])
    set({ planificacion, platos, ingredientes, unidades, etiquetas, platoEtiquetas, loading: false })
  },

  getPlatosFecha: (fecha: string) => {
    const { planificacion } = get()
    return planificacion.find((p) => p.fecha === fecha) ?? null
  },

  addPlatoToFecha: async (platoId: number, fecha: string, estado: EstadoPlato) => {
    const plato = await db.platos.get(platoId)
    if (!plato) return false

    const ts = nowISO()
    const newId = await db.planificaciones.add({
      syncId: newSyncId(),
      platoId,
      platoSyncId: plato.syncId,
      fecha,
      estado,
      updatedAt: ts,
    })
    const planificacionId = newId as number

    const { planificacion } = get()
    const existing = planificacion.find((p) => p.fecha === fecha)

    if (existing) {
      const updated = planificacion.map((p) => {
        if (p.fecha === fecha) {
          return {
            ...p,
            platos: [...p.platos, {
              planificacionId,
              platoId,
              nombre: plato.nombre,
              descripcion: plato.descripcion,
              estado,
            }],
          }
        }
        return p
      })
      set({ planificacion: updated })
    } else {
      set({
        planificacion: [...planificacion, {
          fecha,
          platos: [{
            planificacionId,
            platoId,
            nombre: plato.nombre,
            descripcion: plato.descripcion,
            estado,
          }],
        }],
      })
    }

    return true
  },

  // Planificador semanal local: llena los dias vacios de la semana con 2 platos
  // que tengan ALGUNA de las etiquetas seleccionadas. No toca dias ya planificados.
  planificarSemana: async (fechas, etiquetasSeleccionadas) => {
    const { platos, etiquetas, platoEtiquetas } = get()
    const mapaEtiquetas = construirMapaEtiquetas(etiquetas, platoEtiquetas)
    const candidatos = filtrarCandidatosPorEtiquetas(platos, mapaEtiquetas, etiquetasSeleccionadas)

    if (candidatos.length === 0) {
      return { ok: false, dias: 0, platosAsignados: 0, error: 'No hay platos con las etiquetas seleccionadas' }
    }

    const existentesPorFecha = new Map<string, number[]>()
    const planes = await db.planificaciones.where('fecha').anyOf(fechas).toArray()
    for (const plan of planes) {
      const lista = existentesPorFecha.get(plan.fecha) ?? []
      lista.push(plan.platoId)
      existentesPorFecha.set(plan.fecha, lista)
    }

    const slots = generarPlanSemanal(candidatos, fechas, existentesPorFecha)
    if (slots.length === 0) {
      return { ok: true, dias: 0, platosAsignados: 0 }
    }

    const { dias, platosAsignados } = await insertarPlanificaciones(slots, platos, get().initialize)
    return { ok: true, dias, platosAsignados }
  },

  // Planificador con IA (Gemini): envia platos candidatos con ingredientes y
  // nutricion aproximada; la IA decide cuantos platos por dia (1-3).
  // Si la IA falla -> fallback automatico al planificador local con aviso.
  planificarSemanaConIA: async (fechas, etiquetasSeleccionadas, comentario) => {
    const key = (await db.config.get('aiApiKey'))?.value ?? ''
    if (!key) {
      return { ok: false, dias: 0, platosAsignados: 0, error: 'Configura tu API key de Gemini en Ajustes' }
    }

    const { platos, ingredientes, etiquetas, platoEtiquetas } = get()
    const mapaEtiquetas = construirMapaEtiquetas(etiquetas, platoEtiquetas)
    const candidatos = filtrarCandidatosPorEtiquetas(platos, mapaEtiquetas, etiquetasSeleccionadas)
    if (candidatos.length === 0) {
      return { ok: false, dias: 0, platosAsignados: 0, error: 'No hay platos con las etiquetas seleccionadas' }
    }

    const existentesPorFecha = new Map<string, number[]>()
    const planes = await db.planificaciones.where('fecha').anyOf(fechas).toArray()
    for (const plan of planes) {
      const lista = existentesPorFecha.get(plan.fecha) ?? []
      lista.push(plan.platoId)
      existentesPorFecha.set(plan.fecha, lista)
    }

    if (comentario.trim()) {
      await db.config.put({ key: 'aiComentario', value: comentario.trim() })
    }
    const candidatosIA = await construirCandidatosIA(candidatos, mapaEtiquetas, platos, ingredientes)

    const ia = await planificarConIA({
      candidatos: candidatosIA,
      fechas,
      existentesPorFecha,
      comentario,
      apiKey: key,
    })

    if (!ia.ok) {
      // Fallback automatico al planificador local
      const local = await get().planificarSemana(fechas, etiquetasSeleccionadas)
      if (!local.ok) {
        return { ...local, error: `${ia.error}. ${local.error ?? ''}`.trim() }
      }
      return { ...local, avisoLocal: `IA no disponible (${ia.error}). Se uso el plan local.` }
    }

    if (ia.slots.length === 0) {
      return { ok: true, dias: 0, platosAsignados: 0 }
    }

    const { dias, platosAsignados } = await insertarPlanificaciones(ia.slots, platos, get().initialize)
    return { ok: true, dias, platosAsignados, avisoLocal: ia.avisoLocal }
  },

  setModificarEstado: async (planificacionId: number) => {
    const plan = await db.planificaciones.get(planificacionId)
    if (!plan) return

    const nuevoEstado: EstadoPlato = plan.estado === 'pendiente' ? 'preparado' : 'pendiente'
    await db.planificaciones.update(planificacionId, { estado: nuevoEstado, updatedAt: nowISO() })

    const { planificacion } = get()
    const updated = planificacion.map((p) => ({
      ...p,
      platos: p.platos.map((pl) =>
        pl.planificacionId === planificacionId ? { ...pl, estado: nuevoEstado } : pl
      ),
    }))
    set({ planificacion: updated })
  },

  removePlanificacion: async (planificacionId: number) => {
    await deleteTracked('planificaciones', planificacionId)

    const { planificacion } = get()
    const updated = planificacion
      .map((p) => ({
        ...p,
        platos: p.platos.filter((pl) => pl.planificacionId !== planificacionId),
      }))
      .filter((p) => p.platos.length > 0)

    set({ planificacion: updated })
    return true
  },

  getPlanificacionBetweenDates: (fechaInicio: string, fechaFin: string) => {
    const { planificacion } = get()
    return planificacion.filter((p) => p.fecha >= fechaInicio && p.fecha <= fechaFin)
  },

  loadPlatos: async () => {
    const platos = await db.platos.toArray()
    set({ platos })
  },

  createPlato: async (data) => {
    const ts = nowISO()
    const platoSyncId = newSyncId()
    const nuevoPlato: Plato = {
      syncId: platoSyncId,
      nombre: data.nombre,
      descripcion: data.descripcion,
      updatedAt: ts,
    }
    if (data.porciones !== undefined) nuevoPlato.porciones = data.porciones
    if (data.nutricion) nuevoPlato.nutricion = data.nutricion
    const platoId = await db.platos.add(nuevoPlato)

    for (const ing of data.ingredientes) {
      const ingrediente = await db.ingredientes.get(ing.id)
      await db.platoIngredientes.add({
        syncId: newSyncId(),
        platoId: platoId as number,
        platoSyncId,
        ingredienteId: ing.id,
        ingredienteSyncId: ingrediente?.syncId ?? '',
        cantidad: ing.cantidad,
        updatedAt: ts,
      })
    }

    for (const etqId of data.etiquetas) {
      const etiqueta = await db.etiquetas.get(etqId)
      await db.platoEtiquetas.add({
        syncId: newSyncId(),
        platoId: platoId as number,
        platoSyncId,
        etiquetaId: etqId,
        etiquetaSyncId: etiqueta?.syncId ?? '',
        updatedAt: ts,
      })
    }

    await Promise.all([get().loadPlatos(), get().loadEtiquetas()])
  },

  updatePlato: async (id: number, data) => {
    const ts = nowISO()
    const plato = await db.platos.get(id)
    const platoSyncId = plato?.syncId ?? newSyncId()

    if (plato) {
      const actualizado: Plato = {
        ...plato,
        nombre: data.nombre,
        descripcion: data.descripcion,
        updatedAt: ts,
      }
      if (data.porciones !== undefined) actualizado.porciones = data.porciones
      else delete actualizado.porciones
      if (data.nutricion) actualizado.nutricion = data.nutricion
      else delete actualizado.nutricion
      await db.platos.put(actualizado)
    } else {
      await db.platos.update(id, { nombre: data.nombre, descripcion: data.descripcion, updatedAt: ts })
    }

    const oldIngredientes = await db.platoIngredientes.where('platoId').equals(id).toArray()
    for (const old of oldIngredientes) {
      if (old.id) await deleteTracked('platoIngredientes', old.id)
    }

    const oldEtiquetas = await db.platoEtiquetas.where('platoId').equals(id).toArray()
    for (const old of oldEtiquetas) {
      if (old.id) await deleteTracked('platoEtiquetas', old.id)
    }

    for (const ing of data.ingredientes) {
      const ingrediente = await db.ingredientes.get(ing.id)
      await db.platoIngredientes.add({
        syncId: newSyncId(),
        platoId: id,
        platoSyncId,
        ingredienteId: ing.id,
        ingredienteSyncId: ingrediente?.syncId ?? '',
        cantidad: ing.cantidad,
        updatedAt: ts,
      })
    }

    for (const etqId of data.etiquetas) {
      const etiqueta = await db.etiquetas.get(etqId)
      await db.platoEtiquetas.add({
        syncId: newSyncId(),
        platoId: id,
        platoSyncId,
        etiquetaId: etqId,
        etiquetaSyncId: etiqueta?.syncId ?? '',
        updatedAt: ts,
      })
    }

    const [platos, planificacion, platoEtiquetas] = await Promise.all([
      db.platos.toArray(),
      construirPlanificacion(),
      db.platoEtiquetas.toArray(),
    ])
    set({ platos, planificacion, platoEtiquetas })
  },

  deletePlato: async (id: number) => {
    const platoIngredientes = await db.platoIngredientes.where('platoId').equals(id).toArray()
    for (const pi of platoIngredientes) {
      if (pi.id) await deleteTracked('platoIngredientes', pi.id)
    }
    const platoEtiquetas = await db.platoEtiquetas.where('platoId').equals(id).toArray()
    for (const pe of platoEtiquetas) {
      if (pe.id) await deleteTracked('platoEtiquetas', pe.id)
    }
    const planificaciones = await db.planificaciones.where('platoId').equals(id).toArray()
    for (const plan of planificaciones) {
      if (plan.id) await deleteTracked('planificaciones', plan.id)
    }
    await deleteTracked('platos', id)

    await get().initialize()
  },

  getPlatoById: async (id: number) => {
    const plato = await db.platos.get(id)
    if (!plato) return null

    const platoIngredientes = await db.platoIngredientes.where('platoId').equals(id).toArray()

    const ingredientesData = await Promise.all(
      platoIngredientes.map(async (pi) => {
        const ing = await db.ingredientes.get(pi.ingredienteId)
        return {
          id: pi.ingredienteId,
          nombre: ing?.nombre ?? '',
          cantidad: String(pi.cantidad),
          unidad: ing?.unidad ?? '',
          nutricion: ing?.nutricion,
        }
      })
    )

    const platoEtiquetas = await db.platoEtiquetas.where('platoId').equals(id).toArray()
    const etiquetasData = await Promise.all(
      platoEtiquetas.map(async (pe) => {
        const etq = await db.etiquetas.get(pe.etiquetaId)
        return { id: pe.etiquetaId, nombre: etq?.nombre ?? '' }
      })
    )

    return {
      id,
      nombre: plato.nombre,
      descripcion: plato.descripcion,
      porciones: plato.porciones,
      nutricion: plato.nutricion,
      ingredientes: ingredientesData,
      etiquetas: etiquetasData,
    }
  },

  loadIngredientes: async () => {
    const ingredientes = await db.ingredientes.toArray()
    set({ ingredientes })
  },

  createIngrediente: async (data) => {
    const nuevo: Ingrediente = {
      syncId: newSyncId(),
      nombre: data.nombre,
      unidad: data.unidad,
      updatedAt: nowISO(),
    }
    if (data.nutricion) nuevo.nutricion = data.nutricion
    await db.ingredientes.add(nuevo)
    await get().loadIngredientes()
  },

  updateIngrediente: async (id, data) => {
    const actual = await db.ingredientes.get(id)
    if (actual) {
      const actualizado: Ingrediente = { ...actual, nombre: data.nombre, unidad: data.unidad, updatedAt: nowISO() }
      if (data.nutricion) actualizado.nutricion = data.nutricion
      else delete actualizado.nutricion
      await db.ingredientes.put(actualizado)
    } else {
      await db.ingredientes.update(id, { nombre: data.nombre, unidad: data.unidad, updatedAt: nowISO() })
    }
    await get().loadIngredientes()
  },

  deleteIngrediente: async (id) => {
    const platoIngredientes = await db.platoIngredientes.where('ingredienteId').equals(id).toArray()
    for (const pi of platoIngredientes) {
      if (pi.id) await deleteTracked('platoIngredientes', pi.id)
    }
    await deleteTracked('ingredientes', id)
    await get().loadIngredientes()
  },

  loadUnidades: async () => {
    const unidades = await db.unidades.toArray()
    set({ unidades })
  },

  createUnidad: async (data) => {
    await db.unidades.add({
      syncId: newSyncId(),
      nombre: data.nombre,
      updatedAt: nowISO(),
    })
    await get().loadUnidades()
  },

  updateUnidad: async (id, data) => {
    await db.unidades.update(id, { nombre: data.nombre, updatedAt: nowISO() })
    await get().loadUnidades()
  },

  deleteUnidad: async (id) => {
    await deleteTracked('unidades', id)
    await get().loadUnidades()
  },

  reemplazarUnidades: async (nombres) => {
    const actuales = await db.unidades.toArray()
    for (const u of actuales) {
      if (u.id) await deleteTracked('unidades', u.id)
    }

    const vistas = new Set<string>()
    const nuevas: Unidad[] = []
    for (const nombre of nombres) {
      const limpio = nombre.trim()
      if (!limpio) continue
      const clave = limpio.toLowerCase()
      if (vistas.has(clave)) continue
      vistas.add(clave)
      nuevas.push({
        syncId: newSyncId(),
        nombre: limpio,
        updatedAt: nowISO(),
      })
    }
    if (nuevas.length > 0) {
      await db.unidades.bulkAdd(nuevas)
    }
    await get().loadUnidades()
    return nuevas.length
  },

  loadEtiquetas: async () => {
    const [etiquetas, platoEtiquetas] = await Promise.all([
      db.etiquetas.toArray(),
      db.platoEtiquetas.toArray(),
    ])
    set({ etiquetas, platoEtiquetas })
  },

  createEtiqueta: async (data) => {
    await db.etiquetas.add({
      syncId: newSyncId(),
      nombre: data.nombre,
      updatedAt: nowISO(),
    })
    await get().loadEtiquetas()
  },

  updateEtiqueta: async (id, data) => {
    await db.etiquetas.update(id, { nombre: data.nombre, updatedAt: nowISO() })
    await get().loadEtiquetas()
  },

  deleteEtiqueta: async (id) => {
    const junctions = await db.platoEtiquetas.where('etiquetaId').equals(id).toArray()
    for (const j of junctions) {
      if (j.id) await deleteTracked('platoEtiquetas', j.id)
    }
    await deleteTracked('etiquetas', id)
    await get().loadEtiquetas()
  },

  importarEtiquetas: async (nombres) => {
    const limpios: string[] = []
    const vistas = new Set<string>()
    for (const n of nombres) {
      const limpio = (n ?? '').trim()
      if (!limpio) continue
      const clave = limpio.toLowerCase()
      if (vistas.has(clave)) continue
      vistas.add(clave)
      limpios.push(limpio)
    }
    if (limpios.length === 0) {
      return { ok: false, error: 'El archivo no contiene etiquetas validas' }
    }

    const actuales = await db.etiquetas.toArray()
    const actualesClaves = new Set(actuales.map((e) => e.nombre.toLowerCase()))

    const junctions = await db.platoEtiquetas.toArray()
    if (junctions.length > 0) {
      const usadas = new Set<string>()
      for (const j of junctions) {
        const etq = actuales.find((e) => e.id === j.etiquetaId)
        if (etq) usadas.add(etq.nombre.toLowerCase())
      }
      for (const usada of usadas) {
        if (!limpios.some((l) => l.toLowerCase() === usada)) {
          const original = actuales.find((e) => e.nombre.toLowerCase() === usada)
          return { ok: false, error: `No se puede importar: la etiqueta "${original?.nombre ?? usada}" esta siendo usada por platos y no esta en el archivo` }
        }
      }
    }

    for (const e of actuales) {
      if (e.id && !limpios.some((l) => l.toLowerCase() === e.nombre.toLowerCase())) {
        await deleteTracked('etiquetas', e.id)
      }
    }

    const ts = nowISO()
    const nuevas: Etiqueta[] = limpios
      .filter((l) => !actualesClaves.has(l.toLowerCase()))
      .map((l) => ({ syncId: newSyncId(), nombre: l, updatedAt: ts }))
    if (nuevas.length > 0) {
      await db.etiquetas.bulkAdd(nuevas)
    }

    await get().loadEtiquetas()
    return { ok: true, total: limpios.length }
  },

  importarIngredientes: async (items) => {
    const limpios: { nombre: string; unidad: string; nutricion?: NutricionIngrediente }[] = []
    const vistas = new Set<string>()
    for (const it of items) {
      const nombre = (it?.nombre ?? '').trim()
      if (!nombre) continue
      const clave = nombre.toLowerCase()
      if (vistas.has(clave)) continue
      vistas.add(clave)
      const nutri = validarNutricionIngrediente(it.nutricion, nombre)
      if (!nutri.ok) return { ok: false, error: nutri.error }
      limpios.push({ nombre, unidad: (it.unidad ?? '').trim() || 'unidad', nutricion: nutri.nutricion })
    }
    if (limpios.length === 0) {
      return { ok: false, error: 'El archivo no contiene ingredientes validos' }
    }

    const actuales = await db.ingredientes.toArray()

    const junctions = await db.platoIngredientes.toArray()
    if (junctions.length > 0) {
      const usadosIds = new Set(junctions.map((j) => j.ingredienteId))
      for (const id of usadosIds) {
        const ing = actuales.find((a) => a.id === id)
        if (ing && !limpios.some((l) => l.nombre.toLowerCase() === ing.nombre.toLowerCase())) {
          return { ok: false, error: `No se puede importar: el ingrediente "${ing.nombre}" esta siendo usado por platos y no esta en el archivo` }
        }
      }
    }

    const ts = nowISO()
    const actualesClaves = new Set(actuales.map((a) => a.nombre.toLowerCase()))

    for (const l of limpios) {
      const actual = actuales.find((a) => a.nombre.toLowerCase() === l.nombre.toLowerCase())
      if (actual?.id) {
        const nutricionCambia = JSON.stringify(actual.nutricion ?? null) !== JSON.stringify(l.nutricion ?? null)
        if (actual.unidad !== l.unidad || nutricionCambia) {
          const actualizado: Ingrediente = { ...actual, unidad: l.unidad, updatedAt: ts }
          if (l.nutricion) actualizado.nutricion = l.nutricion
          else delete actualizado.nutricion
          await db.ingredientes.put(actualizado)
        }
      }
    }

    for (const a of actuales) {
      if (a.id && !limpios.some((l) => l.nombre.toLowerCase() === a.nombre.toLowerCase())) {
        await deleteTracked('ingredientes', a.id)
      }
    }

    const nuevas: Ingrediente[] = limpios
      .filter((l) => !actualesClaves.has(l.nombre.toLowerCase()))
      .map((l) => {
        const nueva: Ingrediente = { syncId: newSyncId(), nombre: l.nombre, unidad: l.unidad, updatedAt: ts }
        if (l.nutricion) nueva.nutricion = l.nutricion
        return nueva
      })
    if (nuevas.length > 0) {
      await db.ingredientes.bulkAdd(nuevas)
    }

    await get().loadIngredientes()
    return { ok: true, total: limpios.length }
  },

  importarPlatos: async (recetas) => {
    if (!Array.isArray(recetas) || recetas.length === 0) {
      return { ok: false, error: 'El archivo no contiene platos validos' }
    }

    const ingredientes = await db.ingredientes.toArray()
    const ingByNombre = new Map(ingredientes.map((i) => [i.nombre.toLowerCase(), i]))
    const unidades = await db.unidades.toArray()
    const uniClaves = new Set(unidades.map((u) => u.nombre.toLowerCase()))
    const etiquetas = await db.etiquetas.toArray()
    const etqByNombre = new Map(etiquetas.map((e) => [e.nombre.toLowerCase(), e]))

    interface RecetaResuelta {
      nombre: string
      descripcion: string
      etiquetaIds: number[]
      porciones?: number
      nutricion?: Nutricion
      ings: { ing: Ingrediente; cantidad: number }[]
    }

    const resueltas: RecetaResuelta[] = []
    const nombresVistos = new Set<string>()

    for (const r of recetas) {
      const nombre = (r?.nombre ?? '').trim()
      if (!nombre) {
        return { ok: false, error: 'Hay un plato sin nombre en el archivo' }
      }
      const claveNombre = nombre.toLowerCase()
      if (nombresVistos.has(claveNombre)) {
        return { ok: false, error: `Plato duplicado en el archivo: "${nombre}"` }
      }
      nombresVistos.add(claveNombre)

      if (!Array.isArray(r.ingredientes) || r.ingredientes.length === 0) {
        return { ok: false, error: `El plato "${nombre}" no tiene ingredientes` }
      }

      const ings: { ing: Ingrediente; cantidad: number }[] = []
      for (const ri of r.ingredientes) {
        const ing = ingByNombre.get((ri?.nombre ?? '').trim().toLowerCase())
        if (!ing) {
          return { ok: false, error: `Ingrediente no encontrado: "${ri?.nombre}" (plato "${nombre}")` }
        }
        const cantidad = Number(ri?.cantidad)
        if (!cantidad || cantidad <= 0) {
          return { ok: false, error: `Cantidad invalida para "${ri?.nombre}" en el plato "${nombre}"` }
        }
        const unidad = (ri?.unidad ?? '').trim().toLowerCase()
        if (!unidad || !uniClaves.has(unidad)) {
          return { ok: false, error: `Unidad no encontrada: "${ri?.unidad}" (plato "${nombre}")` }
        }
        ings.push({ ing, cantidad })
      }

      const etiquetaIds: number[] = []
      for (const ne of r.etiquetas ?? []) {
        const etq = etqByNombre.get(String(ne ?? '').trim().toLowerCase())
        if (!etq) {
          return { ok: false, error: `Etiqueta no encontrada: "${ne}" (plato "${nombre}")` }
        }
        etiquetaIds.push(etq.id as number)
      }

      const nutri = validarNutricionReceta(r, nombre)
      if (!nutri.ok) {
        return { ok: false, error: nutri.error }
      }

      resueltas.push({ nombre, descripcion: (r.descripcion ?? '').trim(), etiquetaIds, porciones: nutri.porciones, nutricion: nutri.nutricion, ings })
    }

    const platosActuales = await db.platos.toArray()
    const ts = nowISO()

    for (const r of resueltas) {
      const existente = platosActuales.find((p) => p.nombre.toLowerCase() === r.nombre.toLowerCase())
      let platoId: number
      let platoSyncId: string

      if (existente?.id) {
        platoId = existente.id
        platoSyncId = existente.syncId
        const platoActualizado: Plato = {
          ...existente,
          nombre: r.nombre,
          descripcion: r.descripcion,
          updatedAt: ts,
        }
        if (r.porciones !== undefined) platoActualizado.porciones = r.porciones
        else delete platoActualizado.porciones
        if (r.nutricion) platoActualizado.nutricion = r.nutricion
        else delete platoActualizado.nutricion
        await db.platos.put(platoActualizado)
      } else {
        platoSyncId = newSyncId()
        const nuevoPlato: Plato = {
          syncId: platoSyncId,
          nombre: r.nombre,
          descripcion: r.descripcion,
          updatedAt: ts,
        }
        if (r.porciones !== undefined) nuevoPlato.porciones = r.porciones
        if (r.nutricion) nuevoPlato.nutricion = r.nutricion
        platoId = (await db.platos.add(nuevoPlato)) as number
      }

      const oldIngs = await db.platoIngredientes.where('platoId').equals(platoId).toArray()
      for (const old of oldIngs) {
        if (old.id) await deleteTracked('platoIngredientes', old.id)
      }
      const oldEtq = await db.platoEtiquetas.where('platoId').equals(platoId).toArray()
      for (const old of oldEtq) {
        if (old.id) await deleteTracked('platoEtiquetas', old.id)
      }

      for (const { ing, cantidad } of r.ings) {
        await db.platoIngredientes.add({
          syncId: newSyncId(),
          platoId,
          platoSyncId,
          ingredienteId: ing.id as number,
          ingredienteSyncId: ing.syncId,
          cantidad,
          updatedAt: ts,
        })
      }
      for (const etqId of r.etiquetaIds) {
        const etq = etiquetas.find((e) => e.id === etqId)
        await db.platoEtiquetas.add({
          syncId: newSyncId(),
          platoId,
          platoSyncId,
          etiquetaId: etqId,
          etiquetaSyncId: etq?.syncId ?? '',
          updatedAt: ts,
        })
      }
    }

    await get().initialize()
    return { ok: true, total: resueltas.length }
  },

  calcularListaCompras: async (fechaInicio: string, fechaFin: string) => {
    const allPlanificaciones: Planificacion[] = await db.planificaciones
      .where('fecha')
      .between(fechaInicio, fechaFin, true, true)
      .toArray()

    const platoIds = [...new Set(allPlanificaciones.map((p) => p.platoId))]

    const mapaIngredientes: Record<string, { id: number; nombre: string; cantidad: number; unidad: string }> = {}

    for (const platoId of platoIds) {
      const platoIngredientes = await db.platoIngredientes.where('platoId').equals(platoId).toArray()

      for (const pi of platoIngredientes) {
        const ing = await db.ingredientes.get(pi.ingredienteId)
        if (!ing) continue

        const key = `${pi.ingredienteId}-${ing.unidad}`
        const vecesEnSemana = allPlanificaciones.filter((p) => p.platoId === platoId).length
        const cantidadTotal = Math.round((pi.cantidad * vecesEnSemana) * 100) / 100

        if (mapaIngredientes[key]) {
          mapaIngredientes[key].cantidad += cantidadTotal
        } else {
          mapaIngredientes[key] = {
            id: pi.ingredienteId,
            nombre: ing.nombre,
            cantidad: cantidadTotal,
            unidad: ing.unidad,
          }
        }
      }
    }

    return Object.values(mapaIngredientes).map((item) => ({
      id: item.id,
      ingrediente: item.nombre,
      cantidad_total: String(item.cantidad),
      unidad: item.unidad,
    }))
  },

  loadCompras: async (numeroSemana: number, anio: number) => {
    const compras = await db.compras
      .where({ numeroSemana, anio })
      .toArray()
    set({ compras })
  },

  toggleCompra: async (ingredienteId: number, cantidad: string, numeroSemana: number, anio: number) => {
    const existing = await db.compras
      .where({ ingredienteId, numeroSemana, anio })
      .first()

    if (existing && existing.id) {
      const nuevoEstado = existing.estado === 'comprado' ? 'pendiente' : 'comprado'
      await db.compras.update(existing.id, { estado: nuevoEstado, updatedAt: nowISO() })
    } else {
      const ingrediente = await db.ingredientes.get(ingredienteId)
      await db.compras.add({
        syncId: newSyncId(),
        ingredienteId,
        ingredienteSyncId: ingrediente?.syncId ?? '',
        cantidad,
        estado: 'comprado',
        numeroSemana,
        anio,
        updatedAt: nowISO(),
      })
    }

    await get().loadCompras(numeroSemana, anio)
  },
}))
