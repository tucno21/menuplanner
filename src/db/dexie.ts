import Dexie, { type Table } from 'dexie'

export interface Plato {
  id?: number
  syncId: string
  nombre: string
  descripcion: string
  updatedAt: string
}

export interface Ingrediente {
  id?: number
  syncId: string
  nombre: string
  unidad: string
  updatedAt: string
}

export interface PlatoIngrediente {
  id?: number
  syncId: string
  platoId: number
  platoSyncId: string
  ingredienteId: number
  ingredienteSyncId: string
  cantidad: number
  updatedAt: string
}

export type EstadoPlato = 'pendiente' | 'preparado'

export interface Planificacion {
  id?: number
  syncId: string
  platoId: number
  platoSyncId: string
  fecha: string
  estado: EstadoPlato
  updatedAt: string
}

export type EstadoCompra = 'comprado' | 'pendiente'

export interface Compra {
  id?: number
  syncId: string
  ingredienteId: number
  ingredienteSyncId: string
  cantidad: string
  estado: EstadoCompra
  numeroSemana: number
  anio: number
  updatedAt: string
}

export interface Config {
  key: string
  value: string
}

export interface Unidad {
  id?: number
  syncId: string
  nombre: string
  updatedAt: string
}

export interface Deletion {
  id?: number
  syncId: string
  table: string
  deletedAt: string
}

export const unidadesSeed: { nombre: string }[] = [
  { nombre: 'gr' },
  { nombre: 'kg' },
  { nombre: 'ml' },
  { nombre: 'L' },
  { nombre: 'unidad' },
  { nombre: 'lata' },
  { nombre: 'diente' },
  { nombre: 'ramillete' },
  { nombre: 'hoja' },
  { nombre: 'cucharada' },
  { nombre: 'cucharadita' },
  { nombre: 'taza' },
  { nombre: 'paquete' },
  { nombre: 'atado' },      // brócoli, espinaca, perejil, cebollita china
  { nombre: 'pizca' },
  { nombre: 'sobre' },       // gelatina, sazonador
  { nombre: 'rodaja' },
  { nombre: 'rama' },        // apio, canela en rama
  { nombre: 'cabeza' },      // ajo (cabeza completa vs diente)
  { nombre: 'bolsa' },
  { nombre: 'frasco' },
  { nombre: 'botella' },
  { nombre: 'trozo' },
  { nombre: 'onza' },
  { nombre: 'libra' },
]

export class MenuPlannerDB extends Dexie {
  platos!: Table<Plato, number>
  ingredientes!: Table<Ingrediente, number>
  platoIngredientes!: Table<PlatoIngrediente, number>
  planificaciones!: Table<Planificacion, number>
  compras!: Table<Compra, number>
  config!: Table<Config, string>
  unidades!: Table<Unidad, number>
  deletions!: Table<Deletion, number>

  constructor() {
    super('MenuPlannerDB')
    this.version(1).stores({
      platos: '++id, nombre, grupoId',
      ingredientes: '++id, nombre',
      platoIngredientes: '++id, platoId, ingredienteId',
      planificaciones: '++id, platoId, fecha, estado',
      compras: '++id, ingredienteId, numeroSemana, anio',
      config: 'key',
    })
    this.version(2).stores({
      platos: '++id, nombre',
      ingredientes: '++id, nombre',
      platoIngredientes: '++id, platoId, ingredienteId',
      planificaciones: '++id, platoId, fecha, estado',
      compras: '++id, ingredienteId, numeroSemana, anio',
      config: 'key',
    })
    this.version(3).stores({
      platos: '++id, nombre',
      ingredientes: '++id, nombre',
      platoIngredientes: '++id, platoId, ingredienteId',
      planificaciones: '++id, platoId, fecha, estado',
      compras: '++id, ingredienteId, numeroSemana, anio',
      config: 'key',
      unidades: '++id, nombre',
    }).upgrade(async (trans) => {
      const count = await trans.table('unidades').count()
      if (count === 0) {
        await trans.table('unidades').bulkAdd(unidadesSeed)
      }
    })
    this.version(4).stores({
      platos: '++id, syncId, nombre',
      ingredientes: '++id, syncId, nombre',
      platoIngredientes: '++id, syncId, platoId, ingredienteId, platoSyncId, ingredienteSyncId',
      planificaciones: '++id, syncId, platoId, fecha, estado, platoSyncId',
      compras: '++id, syncId, ingredienteId, numeroSemana, anio, ingredienteSyncId',
      config: 'key',
      unidades: '++id, syncId, nombre',
      deletions: '++id, syncId, table, deletedAt',
    }).upgrade(async (trans) => {
      const now = new Date().toISOString()
      const tables = ['platos', 'ingredientes', 'platoIngredientes', 'planificaciones', 'compras', 'unidades']
      for (const tableName of tables) {
        const table = trans.table(tableName)
        const all = await table.toArray()
        for (const record of all) {
          if (!record.syncId) {
            const syncId = crypto.randomUUID()
            const updates: Record<string, unknown> = { syncId, updatedAt: now }
            if (tableName === 'platoIngredientes') {
              const plato = await trans.table('platos').get(record.platoId)
              const ing = await trans.table('ingredientes').get(record.ingredienteId)
              if (plato?.syncId) updates.platoSyncId = plato.syncId
              if (ing?.syncId) updates.ingredienteSyncId = ing.syncId
            } else if (tableName === 'planificaciones') {
              const plato = await trans.table('platos').get(record.platoId)
              if (plato?.syncId) updates.platoSyncId = plato.syncId
            } else if (tableName === 'compras') {
              const ing = await trans.table('ingredientes').get(record.ingredienteId)
              if (ing?.syncId) updates.ingredienteSyncId = ing.syncId
            }
            await table.update(record.id, updates)
          }
        }
      }
    })
  }
}

export const db = new MenuPlannerDB()

export const ingredientesSeed: { nombre: string; unidad: string }[] = [
  { nombre: 'Arroz', unidad: 'gr' },
  { nombre: 'Fideos', unidad: 'gr' },
  { nombre: 'Pan', unidad: 'unidad' },
  { nombre: 'Harina', unidad: 'gr' },
  { nombre: 'Azucar', unidad: 'gr' },
  { nombre: 'Sal', unidad: 'gr' },
  { nombre: 'Pimienta', unidad: 'gr' },
  { nombre: 'Aceite', unidad: 'ml' },
  { nombre: 'Mantequilla', unidad: 'gr' },
  { nombre: 'Leche', unidad: 'ml' },
  { nombre: 'Huevos', unidad: 'unidad' },
  { nombre: 'Pollo', unidad: 'gr' },
  { nombre: 'Carne molida', unidad: 'gr' },
  { nombre: 'Res', unidad: 'gr' },
  { nombre: 'Cerdo', unidad: 'gr' },
  { nombre: 'Pescado', unidad: 'gr' },
  { nombre: 'Camarones', unidad: 'gr' },
  { nombre: 'Papa', unidad: 'gr' },
  { nombre: 'Tomate', unidad: 'unidad' },
  { nombre: 'Cebolla', unidad: 'unidad' },
  { nombre: 'Ajo', unidad: 'diente' },
  { nombre: 'Zanahoria', unidad: 'gr' },
  { nombre: 'Lechuga', unidad: 'unidad' },
  { nombre: 'Espinaca', unidad: 'atado' },
  { nombre: 'Brocoli', unidad: 'unidad' },
  { nombre: 'Queso', unidad: 'gr' },
  { nombre: 'Crema de leche', unidad: 'ml' },
  { nombre: 'Salsa de tomate', unidad: 'ml' },
  { nombre: 'Mostaza', unidad: 'ml' },
  { nombre: 'Mayonesa', unidad: 'ml' },
  { nombre: 'Limon', unidad: 'unidad' },
  { nombre: 'Naranja', unidad: 'unidad' },
  { nombre: 'Platano', unidad: 'unidad' },
  { nombre: 'Manzana', unidad: 'unidad' },
  { nombre: 'Frijoles', unidad: 'gr' },
  { nombre: 'Lentejas', unidad: 'gr' },
  { nombre: 'Garbanzos', unidad: 'gr' },
  { nombre: 'Maiz', unidad: 'gr' },
  { nombre: 'Choclo', unidad: 'unidad' },
  { nombre: 'Palta', unidad: 'unidad' },
  { nombre: 'Cilantro', unidad: 'atado' },
  { nombre: 'Perejil', unidad: 'atado' },
  { nombre: 'Comino', unidad: 'gr' },
  { nombre: 'Oregano', unidad: 'gr' },
  { nombre: 'Laurel', unidad: 'hoja' },
  { nombre: 'Canela', unidad: 'gr' },
  { nombre: 'Vainilla', unidad: 'ml' },
  { nombre: 'Polvo de hornear', unidad: 'gr' },
  { nombre: 'Levadura', unidad: 'gr' },
  { nombre: 'Choclo dulce', unidad: 'unidad' },
  { nombre: 'Atun', unidad: 'lata' },
  { nombre: 'Cebollita china', unidad: 'atado' },
  { nombre: 'Apio', unidad: 'atado' },
  { nombre: 'Culantro', unidad: 'atado' },
  { nombre: 'Kion', unidad: 'gr' },
  { nombre: 'Pepino', unidad: 'unidad' },
  { nombre: 'Pimiento', unidad: 'unidad' },
  { nombre: 'Aji amarillo', unidad: 'unidad' },
  { nombre: 'Aji panca', unidad: 'gr' },
  { nombre: 'Rocoto', unidad: 'unidad' },
  { nombre: 'Sillao', unidad: 'ml' },
  { nombre: 'Vinagre', unidad: 'ml' },
  { nombre: 'Ajinomoto', unidad: 'gr' },
  { nombre: 'Avena', unidad: 'gr' },
  { nombre: 'Quinua', unidad: 'gr' },
  { nombre: 'Yuca', unidad: 'gr' },
  { nombre: 'Camote', unidad: 'unidad' },
  { nombre: 'Aceituna', unidad: 'gr' },
  { nombre: 'Pasas', unidad: 'gr' },
  { nombre: 'Coco rallado', unidad: 'gr' },
]

export function withSync<T extends object>(records: T[]): (T & { syncId: string; updatedAt: string })[] {
  const now = new Date().toISOString()
  return records.map((r) => ({ ...r, syncId: crypto.randomUUID(), updatedAt: now }))
}

export const SYNC_TABLES = ['platos', 'ingredientes', 'platoIngredientes', 'planificaciones', 'compras', 'unidades'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

db.on('populate', async () => {
  await db.ingredientes.bulkAdd(withSync(ingredientesSeed))
  await db.unidades.bulkAdd(withSync(unidadesSeed))
})
