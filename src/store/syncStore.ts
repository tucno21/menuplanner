import { create } from 'zustand'
import axios from 'axios'
import { db, SYNC_TABLES, type SyncTable } from '../db/dexie'
import { usePlanificacionStore } from './planificacionStore'

const SYNC_INTERVAL = 120_000
const GET_TIMEOUT = 60_000
const POST_TIMEOUT = 120_000

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
let syncInProgress = false

interface RemotePayload {
  data: Record<string, Record<string, unknown>[]>
  deletions: Record<string, unknown>[]
}

type FkMaps = { plato: Map<string, number>; ing: Map<string, number>; etq: Map<string, number> }

async function mergeRemoteData(remote: RemotePayload): Promise<void> {
  let added = 0
  let updated = 0
  let deleted = 0

  const delByTable: Record<string, Map<string, number>> = {}
  for (const del of remote.deletions ?? []) {
    const t = del.table as string
    if (!delByTable[t]) delByTable[t] = new Map()
    delByTable[t].set(
      del.syncId as string,
      new Date(del.deletedAt as string).getTime()
    )
  }

  async function mergeTable(tableName: SyncTable, fkMaps?: FkMaps) {
    const remoteRecords = remote.data?.[tableName] ?? []
    const tableDels = delByTable[tableName]

    if (remoteRecords.length === 0 && !tableDels) return

    const table = db.table(tableName)
    const allLocal = (await table.toArray()) as {
      id?: number
      syncId?: string
      updatedAt?: string
    }[]

    const localMap = new Map<string, { id?: number; updatedAt?: string }>()
    for (const rec of allLocal) {
      if (rec.syncId)
        localMap.set(rec.syncId, { id: rec.id, updatedAt: rec.updatedAt })
    }

    const idsToDelete: number[] = []
    if (tableDels) {
      for (const rec of allLocal) {
        if (!rec.syncId || !rec.id) continue
        const delTime = tableDels.get(rec.syncId)
        if (delTime !== undefined) {
          const recTime = rec.updatedAt
            ? new Date(rec.updatedAt).getTime()
            : 0
          if (recTime <= delTime) {
            idsToDelete.push(rec.id)
            localMap.delete(rec.syncId)
          }
        }
      }
    }

    const toPut: Record<string, unknown>[] = []
    for (const remoteRec of remoteRecords) {
      const sid = remoteRec.syncId as string
      if (!sid) continue

      if (tableDels?.has(sid)) {
        const recTime = new Date(remoteRec.updatedAt as string).getTime()
        if (recTime <= tableDels.get(sid)!) continue
      }

      const resolved: Record<string, unknown> = { ...remoteRec }
      delete resolved.id
      if (fkMaps && resolved.platoSyncId) {
        resolved.platoId = fkMaps.plato.get(resolved.platoSyncId as string) ?? 0
      }
      if (fkMaps && resolved.ingredienteSyncId) {
        resolved.ingredienteId =
          fkMaps.ing.get(resolved.ingredienteSyncId as string) ?? 0
      }
      if (fkMaps && resolved.etiquetaSyncId) {
        resolved.etiquetaId =
          fkMaps.etq.get(resolved.etiquetaSyncId as string) ?? 0
      }

      if (tableName === 'planificaciones' && typeof resolved.fecha === 'string') {
        const f = resolved.fecha as string
        if (f.length > 10) {
          console.warn('[Sync] fecha normalized: "' + f + '" -> "' + f.slice(0, 10) + '"')
          resolved.fecha = f.slice(0, 10)
        }
      }

      const localRec = localMap.get(sid)
      const remoteMs = new Date(remoteRec.updatedAt as string).getTime()

      if (!localRec) {
        toPut.push(resolved)
        added++
      } else if (remoteMs > new Date(localRec.updatedAt ?? '').getTime()) {
        if (localRec.id) resolved.id = localRec.id
        toPut.push(resolved)
        updated++
      }
    }

    if (idsToDelete.length > 0) {
      await table.bulkDelete(idsToDelete)
      deleted += idsToDelete.length
    }
    if (toPut.length > 0) {
      await table.bulkPut(toPut)
    }
    console.log('[Sync] mergeTable(' + tableName + '): remote=' + remoteRecords.length + ' put=' + toPut.length + ' deleted=' + idsToDelete.length)
  }

  await mergeTable('platos')
  await mergeTable('ingredientes')

  await mergeTable('unidades')
  await mergeTable('etiquetas')

  const fkMaps: FkMaps = {
    plato: new Map(
      (await db.platos.toArray()).map(
        (p) => [p.syncId, p.id!] as [string, number]
      )
    ),
    ing: new Map(
      (await db.ingredientes.toArray()).map(
        (i) => [i.syncId, i.id!] as [string, number]
      )
    ),
    etq: new Map(
      (await db.etiquetas.toArray()).map(
        (e) => [e.syncId, e.id!] as [string, number]
      )
    ),
  }

  await mergeTable('platoIngredientes', fkMaps)
  await mergeTable('planificaciones', fkMaps)
  await mergeTable('compras', fkMaps)
  await mergeTable('platoEtiquetas', fkMaps)

  console.log('[Sync] Merge:', { added, updated, deleted })
}

async function gatherLocalData(
  sinceTs?: string
): Promise<RemotePayload> {
  const sinceMs = sinceTs ? new Date(sinceTs).getTime() : 0

  const data: Record<string, Record<string, unknown>[]> = {}
  for (const table of SYNC_TABLES) {
    const rows = (await db.table(table).toArray()) as Record<
      string,
      unknown
    >[]
    data[table] = rows
      .filter((r) => {
        if (!sinceMs) return true
        const u = r.updatedAt as string | undefined
        return u ? new Date(u).getTime() > sinceMs : false
      })
      .map((r) => {
        const { id: _id, ...rest } = r
        return rest
      })
  }

  const dels = (await db.deletions.toArray()) as {
    id?: number
    syncId: string
    table: string
    deletedAt: string
  }[]
  const deletions = dels
    .filter((d) => !sinceMs || new Date(d.deletedAt).getTime() > sinceMs)
    .map((d) => {
      const { id: _id, ...rest } = d
      return rest
    })

  return { data, deletions }
}

function mapearErrorSync(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'ERR_CANCELED') {
      return 'Tiempo agotado. Verifica la URL.'
    }
    if (err.response) {
      const method = (err.config?.method ?? 'request').toUpperCase()
      return method + ' HTTP ' + err.response.status
    }
    return 'No se pudo conectar. Verifica URL e internet.'
  }
  if (err instanceof SyntaxError) {
    return 'Respuesta invalida del servidor.'
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Error de sincronizacion'
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
    const url = get().appsScriptUrl.trim()
    if (!url || syncInProgress) return

    syncInProgress = true
    set({ syncing: true, error: null })

    try {
      console.log('[Sync] === Iniciando ciclo ===')

      const lastPushConfig = await db.config.get('lastSyncPushTs')
      const sinceTs = lastPushConfig?.value

      // ── STEP 1: GET (pull) ──────────────────────────────
      console.log('[Sync] GET (pull)...')
      const res = await axios.get<string>(url, {
        timeout: GET_TIMEOUT,
        transformResponse: [(data: string) => data],
      })

      console.log('[Sync] GET status:', res.status)

      const remote: RemotePayload = JSON.parse(res.data)

      const remoteCounts: Record<string, number> = {}
      for (const k of Object.keys(remote.data ?? {})) {
        remoteCounts[k] = remote.data[k]?.length ?? 0
      }
      remoteCounts['deletions'] = remote.deletions?.length ?? 0
      console.log('[Sync] Remote:', remoteCounts)

      // ── STEP 2: Merge remote into local ─────────────────
      await mergeRemoteData(remote)
      await usePlanificacionStore.getState().initialize()
      console.log('[Sync] Pull + merge OK')

      // ── STEP 3: POST (delta push) ───────────────────────
      const pushTs = new Date().toISOString()
      const local = await gatherLocalData(sinceTs)

      const pushCounts: Record<string, number> = {}
      for (const k of Object.keys(local.data))
        pushCounts[k] = local.data[k].length
      pushCounts['deletions'] = local.deletions.length

      const payload = JSON.stringify(local)
      console.log('[Sync] POST (push)...', {
        mode: sinceTs ? 'delta' : 'full',
        counts: pushCounts,
        payloadKB: Math.round(payload.length / 1024),
      })

      // text/plain evita el preflight CORS (Apps Script no responde OPTIONS)
      await axios.post(url, payload, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: POST_TIMEOUT,
      })
      console.log('[Sync] Push OK')

      await db.config.put({ key: 'lastSyncPushTs', value: pushTs })

      set({ lastSync: pushTs, syncing: false })
      console.log('[Sync] === Ciclo completado ===')
    } catch (err) {
      console.error('[Sync] Error:', err)
      set({ error: mapearErrorSync(err), syncing: false })
    } finally {
      syncInProgress = false
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
