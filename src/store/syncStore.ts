import { create } from 'zustand'
import { db, SYNC_TABLES, type SyncTable } from '../db/dexie'
import { usePlanificacionStore } from './planificacionStore'

const SYNC_INTERVAL = 120_000
const GET_TIMEOUT = 60_000
const POST_TIMEOUT = 120_000

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
let syncInProgress = false

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
  let added = 0
  let updated = 0
  let deleted = 0

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
        deleted++
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
        added++
      } else if (
        remoteUpdatedAt >
        new Date(localRec.updatedAt ?? '').getTime()
      ) {
        const resolved = await resolveForeignKeys(remoteRec)
        await table.update(localRec.id!, resolved)
        updated++
      }
    }
  }

  console.log('[Sync] Merge:', { added, updated, deleted })
}

async function gatherLocalData(): Promise<{
  data: Record<string, Record<string, unknown>[]>
  deletions: Record<string, unknown>[]
}> {
  const data: Record<string, Record<string, unknown>[]> = {}
  for (const table of SYNC_TABLES) {
    const rows = await db.table(table).toArray()
    data[table] = rows.map((r) =>
      stripId(r as Record<string, unknown>)
    )
  }
  const deletions = (await db.deletions.toArray()).map((d) => {
    const { id: _id, ...rest } = d
    return rest
  })
  return { data, deletions }
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

      // ── STEP 1: GET (pull) ──────────────────────────────
      console.log('[Sync] GET (pull)...')
      const getController = new AbortController()
      const getTimeoutId = setTimeout(() => getController.abort(), GET_TIMEOUT)
      const res = await fetch(url, { signal: getController.signal })
      clearTimeout(getTimeoutId)

      console.log('[Sync] GET status:', res.status)
      if (!res.ok) throw new Error('GET HTTP ' + res.status)

      const text = await res.text()
      const remote: RemotePayload = JSON.parse(text)

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

      // ── STEP 3: POST (push, fire-and-forget) ────────────
      const local = await gatherLocalData()
      const payload = JSON.stringify(local)
      console.log('[Sync] POST (push)...', {
        payloadKB: Math.round(payload.length / 1024),
      })

      const postController = new AbortController()
      const postTimeoutId = setTimeout(
        () => postController.abort(),
        POST_TIMEOUT
      )
      await fetch(url, {
        method: 'POST',
        body: payload,
        mode: 'no-cors',
        signal: postController.signal,
      })
      clearTimeout(postTimeoutId)
      console.log('[Sync] Push OK')

      // ── Done ────────────────────────────────────────────
      set({
        lastSync: new Date().toISOString(),
        syncing: false,
      })
      console.log('[Sync] === Ciclo completado ===')
    } catch (err) {
      console.error('[Sync] Error:', err)
      let msg = 'Error de sincronizacion'
      if (err instanceof DOMException && err.name === 'AbortError') {
        msg = 'Tiempo agotado. Verifica la URL.'
      } else if (err instanceof TypeError) {
        msg = 'No se pudo conectar. Verifica URL e internet.'
      } else if (err instanceof SyntaxError) {
        msg = 'Respuesta invalida del servidor.'
      } else if (err instanceof Error) {
        msg = err.message
      }
      set({ error: msg, syncing: false })
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
