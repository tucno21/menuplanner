import { create } from 'zustand'
import {
  db,
  type Plato,
  type Ingrediente,
  type Compra,
  type EstadoPlato,
  type Planificacion,
  type Unidad,
} from '../db/dexie'

const nowISO = () => new Date().toISOString()
const newSyncId = () => crypto.randomUUID()

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
  ingredientes: { id: number; nombre: string; cantidad: string; unidad: string }[]
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
  compras: Compra[]
  loading: boolean

  initialize: () => Promise<void>

  getPlatosFecha: (fecha: string) => DataPlanificacion | null
  addPlatoToFecha: (platoId: number, fecha: string, estado: EstadoPlato) => Promise<boolean>
  setModificarEstado: (planificacionId: number) => Promise<void>
  removePlanificacion: (planificacionId: number) => Promise<boolean>
  getPlanificacionBetweenDates: (fechaInicio: string, fechaFin: string) => DataPlanificacion[]

  loadPlatos: () => Promise<void>
  createPlato: (data: { nombre: string; descripcion: string; ingredientes: { id: number; cantidad: number }[] }) => Promise<void>
  updatePlato: (id: number, data: { nombre: string; descripcion: string; ingredientes: { id: number; cantidad: number }[] }) => Promise<void>
  deletePlato: (id: number) => Promise<void>
  getPlatoById: (id: number) => Promise<PlatoWithIngredientes | null>

  loadIngredientes: () => Promise<void>
  createIngrediente: (data: { nombre: string; unidad: string }) => Promise<void>
  updateIngrediente: (id: number, data: { nombre: string; unidad: string }) => Promise<void>
  deleteIngrediente: (id: number) => Promise<void>

  loadUnidades: () => Promise<void>
  createUnidad: (data: { nombre: string }) => Promise<void>
  updateUnidad: (id: number, data: { nombre: string }) => Promise<void>
  deleteUnidad: (id: number) => Promise<void>

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

async function deleteTracked(table: 'platos' | 'ingredientes' | 'platoIngredientes' | 'planificaciones' | 'compras' | 'unidades', id: number) {
  const record = await db[table].get(id) as { syncId?: string } | undefined
  if (record?.syncId) await trackDeletion(record.syncId, table)
  await db[table].delete(id)
}

export const usePlanificacionStore = create<PlanificacionState>((set, get) => ({
  planificacion: [],
  platos: [],
  ingredientes: [],
  unidades: [],
  compras: [],
  loading: true,

  initialize: async () => {
    const [planificacion, platos, ingredientes, unidades] = await Promise.all([
      construirPlanificacion(),
      db.platos.toArray(),
      db.ingredientes.toArray(),
      db.unidades.toArray(),
    ])
    set({ planificacion, platos, ingredientes, unidades, loading: false })
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
    const platoId = await db.platos.add({
      syncId: platoSyncId,
      nombre: data.nombre,
      descripcion: data.descripcion,
      updatedAt: ts,
    })

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

    await get().loadPlatos()
  },

  updatePlato: async (id: number, data) => {
    const ts = nowISO()
    const plato = await db.platos.get(id)
    const platoSyncId = plato?.syncId ?? newSyncId()

    await db.platos.update(id, { nombre: data.nombre, descripcion: data.descripcion, updatedAt: ts })

    const oldIngredientes = await db.platoIngredientes.where('platoId').equals(id).toArray()
    for (const old of oldIngredientes) {
      if (old.id) await deleteTracked('platoIngredientes', old.id)
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

    const [platos, planificacion] = await Promise.all([db.platos.toArray(), construirPlanificacion()])
    set({ platos, planificacion })
  },

  deletePlato: async (id: number) => {
    const platoIngredientes = await db.platoIngredientes.where('platoId').equals(id).toArray()
    for (const pi of platoIngredientes) {
      if (pi.id) await deleteTracked('platoIngredientes', pi.id)
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
        }
      })
    )

    return {
      id,
      nombre: plato.nombre,
      descripcion: plato.descripcion,
      ingredientes: ingredientesData,
    }
  },

  loadIngredientes: async () => {
    const ingredientes = await db.ingredientes.toArray()
    set({ ingredientes })
  },

  createIngrediente: async (data) => {
    await db.ingredientes.add({
      syncId: newSyncId(),
      nombre: data.nombre,
      unidad: data.unidad,
      updatedAt: nowISO(),
    })
    await get().loadIngredientes()
  },

  updateIngrediente: async (id, data) => {
    await db.ingredientes.update(id, { nombre: data.nombre, unidad: data.unidad, updatedAt: nowISO() })
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
