import { create } from 'zustand'
import { db, SYNC_TABLES, type SyncTable } from '../db/dexie'
import { usePlanificacionStore } from './planificacionStore'

const SYNC_INTERVAL = 120_000

const MERGE_ORDER: SyncTable[] = [
  'platos',
  'ingredientes',
  'unidades',
  'platoIngredientes',
  'planificaciones',
  'compras',
]

interface SyncState {
  syncing: boolean
  lastSync: string | null
  error: string | null
  appsScriptUrl: string

  loadUrl: () => Promise<void>
  saveUrl: (url: string) => Promise<void>
  sync: () => Promise<void>
  startAutoSync: () => void
  stopAutoSync: () => void
}

let intervalId: ReturnType<typeof setInterval> | null = null
let onlineHandler: (() => void) | null = null

function stripId(record: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = record
  return rest
}

async function resolveForeignKeys(
  record: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const resolved = { ...record }
  delete resolved.id

  if (resolved.platoSyncId) {
    const plato = await db.platos
      .where('syncId')
      .equals(resolved.platoSyncId as string)
      .first()
    resolved.platoId = plato?.id ?? 0
  }
  if (resolved.ingredienteSyncId) {
    const ing = await db.ingredientes
      .where('syncId')
      .equals(resolved.ingredienteSyncId as string)
      .first()
    resolved.ingredienteId = ing?.id ?? 0
  }

  return resolved
}

interface RemotePayload {
  data: Record<string, Record<string, unknown>[]>
  deletions: Record<string, unknown>[]
}

async function mergeRemoteData(remote: RemotePayload): Promise<void> {
  for (const del of remote.deletions ?? []) {
    const tableName = del.table as SyncTable
    if (!SYNC_TABLES.includes(tableName)) continue

    const table = db.table(tableName)
    const localRec = (await table
      .where('syncId')
      .equals(del.syncId as string)
      .first()) as { id?: number; updatedAt?: string } | undefined

    if (localRec?.id) {
      const deletedAt = new Date(del.deletedAt as string).getTime()
      const updatedAt = localRec.updatedAt
        ? new Date(localRec.updatedAt).getTime()
        : 0
      if (updatedAt <= deletedAt) {
        await table.delete(localRec.id)
      }
    }
  }

  for (const tableName of MERGE_ORDER) {
    const remoteRecords = remote.data?.[tableName] ?? []
    const table = db.table(tableName)

    for (const remoteRec of remoteRecords) {
      if (!remoteRec.syncId) continue

      const localRec = (await table
        .where('syncId')
        .equals(remoteRec.syncId as string)
        .first()) as { id?: number; updatedAt?: string } | undefined

      const remoteUpdatedAt = new Date(
        remoteRec.updatedAt as string
      ).getTime()

      if (!localRec) {
        const resolved = await resolveForeignKeys(remoteRec)
        await table.add(resolved)
      } else if (
        remoteUpdatedAt >
        new Date(localRec.updatedAt ?? '').getTime()
      ) {
        const resolved = await resolveForeignKeys(remoteRec)
        await table.update(localRec.id!, resolved)
      }
    }
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  syncing: false,
  lastSync: null,
  error: null,
  appsScriptUrl: '',

  loadUrl: async () => {
    const config = await db.config.get('appsScriptUrl')
    set({ appsScriptUrl: config?.value ?? '' })
  },

  saveUrl: async (url: string) => {
    await db.config.put({ key: 'appsScriptUrl', value: url })
    set({ appsScriptUrl: url })
  },

  sync: async () => {
    const url = get().appsScriptUrl
    if (!url || get().syncing) return

    set({ syncing: true, error: null })

    try {
      const data: Record<string, Record<string, unknown>[]> = {}
      for (const table of SYNC_TABLES) {
        const rows = await db.table(table).toArray()
        data[table] = rows.map((r) =>
          stripId(r as Record<string, unknown>)
        )
      }
      const deletions = await db.deletions.toArray()

      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ data, deletions }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const remote: RemotePayload = await res.json()
      await mergeRemoteData(remote)
      await usePlanificacionStore.getState().initialize()

      set({
        lastSync: new Date().toISOString(),
        syncing: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Error de sincronizacion',
        syncing: false,
      })
    }
  },

  startAutoSync: () => {
    if (intervalId) return

    get().loadUrl().then(() => get().sync())

    intervalId = setInterval(() => {
      if (navigator.onLine) get().sync()
    }, SYNC_INTERVAL)

    onlineHandler = () => get().sync()
    window.addEventListener('online', onlineHandler)
  },

  stopAutoSync: () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler)
      onlineHandler = null
    }
  },
}))
