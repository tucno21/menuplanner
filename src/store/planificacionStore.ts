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
  getPlanificacionBetweenDates: (fechaInicio: Date, fechaFin: Date) => DataPlanificacion[]

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
    const plato = allPlatos.find((p) => p.id === plan.platoId)
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

    const newId = await db.planificaciones.add({ platoId, fecha, estado })
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
    await db.planificaciones.update(planificacionId, { estado: nuevoEstado })

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
    await db.planificaciones.delete(planificacionId)

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

  getPlanificacionBetweenDates: (fechaInicio: Date, fechaFin: Date) => {
    const { planificacion } = get()
    const inicio = new Date(fechaInicio.toISOString().split('T')[0])
    const fin = new Date(fechaFin.toISOString().split('T')[0])
    return planificacion.filter((p) => {
      const fecha = new Date(p.fecha)
      return fecha >= inicio && fecha <= fin
    })
  },

  loadPlatos: async () => {
    const platos = await db.platos.toArray()
    set({ platos })
  },

  createPlato: async (data) => {
    const platoId = await db.platos.add({
      nombre: data.nombre,
      descripcion: data.descripcion,
    })

    for (const ing of data.ingredientes) {
      await db.platoIngredientes.add({
        platoId: platoId as number,
        ingredienteId: ing.id,
        cantidad: ing.cantidad,
      })
    }

    await get().loadPlatos()
  },

  updatePlato: async (id: number, data) => {
    await db.platos.update(id, { nombre: data.nombre, descripcion: data.descripcion })

    await db.platoIngredientes.where('platoId').equals(id).delete()
    for (const ing of data.ingredientes) {
      await db.platoIngredientes.add({
        platoId: id,
        ingredienteId: ing.id,
        cantidad: ing.cantidad,
      })
    }

    const [platos, planificacion] = await Promise.all([db.platos.toArray(), construirPlanificacion()])
    set({ platos, planificacion })
  },

  deletePlato: async (id: number) => {
    await db.platos.delete(id)
    await db.platoIngredientes.where('platoId').equals(id).delete()
    await db.planificaciones.where('platoId').equals(id).delete()

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
    await db.ingredientes.add({ nombre: data.nombre, unidad: data.unidad })
    await get().loadIngredientes()
  },

  updateIngrediente: async (id, data) => {
    await db.ingredientes.update(id, { nombre: data.nombre, unidad: data.unidad })
    await get().loadIngredientes()
  },

  deleteIngrediente: async (id) => {
    await db.ingredientes.delete(id)
    await db.platoIngredientes.where('ingredienteId').equals(id).delete()
    await get().loadIngredientes()
  },

  loadUnidades: async () => {
    const unidades = await db.unidades.toArray()
    set({ unidades })
  },

  createUnidad: async (data) => {
    await db.unidades.add({ nombre: data.nombre })
    await get().loadUnidades()
  },

  updateUnidad: async (id, data) => {
    await db.unidades.update(id, { nombre: data.nombre })
    await get().loadUnidades()
  },

  deleteUnidad: async (id) => {
    await db.unidades.delete(id)
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
        const cantidadTotal = pi.cantidad * vecesEnSemana

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
      await db.compras.update(existing.id, { estado: nuevoEstado })
    } else {
      await db.compras.add({
        ingredienteId,
        cantidad,
        estado: 'comprado',
        numeroSemana,
        anio,
      })
    }

    await get().loadCompras(numeroSemana, anio)
  },
}))
