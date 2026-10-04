import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Trash2, Lock, RefreshCw, Cloud, RotateCcw, HelpCircle, Check, Copy, Boxes, Download, Upload, Tag, Leaf, UtensilsCrossed, KeyRound, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useSyncStore } from '../store/syncStore'
import { usePlanificacionStore, type ImportResult, type IngredienteImport, type PlatoReceta } from '../store/planificacionStore'
import { useToastStore } from '../store/toastStore'
import { db, ingredientesSeed, unidadesSeed, withSeedSync } from '../db/dexie'
import { NUTRICION_KEYS, type Nutricion } from '../utils/nutricion'
import Modal from '../components/ui/Modal'
import AlertCustom from '../components/ui/AlertCustom'

const APPS_SCRIPT_CODE = `var TABLE_FIELDS = {
  platos:            ['syncId', 'nombre', 'descripcion', 'porciones', 'calorias', 'proteinas', 'carbohidratos', 'grasas', 'fibra', 'updatedAt'],
  ingredientes:      ['syncId', 'nombre', 'unidad', 'nutBase', 'nutUnidadBase', 'nutCalorias', 'nutProteinas', 'nutCarbohidratos', 'nutGrasas', 'nutFibra', 'updatedAt'],
  platoIngredientes: ['syncId', 'platoSyncId', 'platoId', 'ingredienteSyncId', 'ingredienteId', 'cantidad', 'updatedAt'],
  planificaciones:   ['syncId', 'platoSyncId', 'platoId', 'fecha', 'estado', 'updatedAt'],
  compras:           ['syncId', 'ingredienteSyncId', 'ingredienteId', 'cantidad', 'estado', 'numeroSemana', 'anio', 'updatedAt'],
  unidades:          ['syncId', 'nombre', 'updatedAt'],
  etiquetas:         ['syncId', 'nombre', 'updatedAt'],
  platoEtiquetas:    ['syncId', 'platoSyncId', 'platoId', 'etiquetaSyncId', 'etiquetaId', 'updatedAt']
}

var DEL_FIELDS = ['syncId', 'table', 'deletedAt']

function ensureSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  for (var table in TABLE_FIELDS) {
    var sheet = ss.getSheetByName(table)
    if (!sheet) sheet = ss.insertSheet(table)
    var fields = TABLE_FIELDS[table]
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(fields)
    } else {
      // Repara cabeceras de hojas creadas con una version anterior del script
      var headers = sheet.getRange(1, 1, 1, fields.length).getValues()[0]
      for (var i = 0; i < fields.length; i++) {
        if (headers[i] !== fields[i]) {
          sheet.getRange(1, 1, 1, fields.length).setValues([fields])
          break
        }
      }
    }
  }
  var del = ss.getSheetByName('deletions')
  if (!del) del = ss.insertSheet('deletions')
  if (del.getLastRow() === 0) del.appendRow(DEL_FIELDS)
}

function readSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(name)
  var fields = name === 'deletions' ? DEL_FIELDS : TABLE_FIELDS[name]
  if (!sheet || sheet.getLastRow() < 2) return []
  var cols = Math.max(fields.length, sheet.getLastColumn())
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, cols).getValues()
  var tz = ss.getSpreadsheetTimeZone()
  return rows.map(function (r) {
    var o = {}
    fields.forEach(function (f, i) {
      var val = r[i]
      if (val instanceof Date) {
        o[f] = (f === 'fecha')
          ? Utilities.formatDate(val, tz, 'yyyy-MM-dd')
          : val.toISOString()
      } else {
        o[f] = val
      }
    })
    return o
  })
}

function doGet() {
  ensureSheets()
  var data = {}
  for (var table in TABLE_FIELDS) data[table] = readSheet(table)
  var deletions = readSheet('deletions')
  return ContentService
    .createTextOutput(JSON.stringify({ data: data, deletions: deletions }))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  ensureSheets()
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var raw = (e && e.postData && e.postData.contents) || '{}'
  var body = typeof raw === 'string' ? JSON.parse(raw) : raw

  var delSheet = ss.getSheetByName('deletions')
  var delRows = []
  if (delSheet.getLastRow() >= 2) {
    delRows = delSheet.getRange(2, 1, delSheet.getLastRow() - 1, 3).getValues()
  }
  var delMap = {}
  delRows.forEach(function (r) { if (r[0]) delMap[r[0]] = r })
  if (body.deletions) {
    body.deletions.forEach(function (d) {
      if (d.syncId && !delMap[d.syncId]) {
        delMap[d.syncId] = [d.syncId, d.table, d.deletedAt]
      }
    })
  }
  var allDelRows = Object.keys(delMap).map(function (k) { return delMap[k] })
  if (allDelRows.length > 0) {
    delSheet.getRange(2, 1, allDelRows.length, 3).setValues(allDelRows)
  }

  var delByTable = {}
  allDelRows.forEach(function (r) {
    var t = r[1]
    if (!delByTable[t]) delByTable[t] = {}
    delByTable[t][r[0]] = new Date(r[2]).getTime()
  })

  for (var tableName in TABLE_FIELDS) {
    var fields = TABLE_FIELDS[tableName]
    var sheet = ss.getSheetByName(tableName)
    var updatedIdx = fields.indexOf('updatedAt')

    var existing = []
    var lastRow = sheet.getLastRow()
    if (lastRow >= 2) {
      existing = sheet.getRange(2, 1, lastRow - 1, fields.length).getValues()
    }

    var tableDels = delByTable[tableName] || {}

    var survivors = existing.filter(function (row) {
      var sid = row[0]
      if (sid && tableDels[sid]) {
        var recTime = updatedIdx >= 0 ? new Date(row[updatedIdx]).getTime() : 0
        return recTime > tableDels[sid]
      }
      return true
    })

    var survMap = {}
    survivors.forEach(function (row, i) {
      var sid = row[0]
      if (sid) survMap[sid] = i
    })

    var incoming = (body.data && body.data[tableName]) || []
    incoming.forEach(function (rec) {
      var sid = rec.syncId
      if (!sid) return
      if (tableDels[sid]) {
        var recTime = new Date(rec.updatedAt).getTime()
        if (recTime <= tableDels[sid]) return
      }
      var newRow = fields.map(function (f) {
        return rec[f] !== undefined ? rec[f] : ''
      })
      if (survMap.hasOwnProperty(sid)) {
        var idx = survMap[sid]
        var existMs = updatedIdx >= 0 ? new Date(survivors[idx][updatedIdx]).getTime() : 0
        var newMs = new Date(rec.updatedAt).getTime()
        if (newMs > existMs) survivors[idx] = newRow
      } else {
        survMap[sid] = survivors.length
        survivors.push(newRow)
      }
    })

    var currentLastRow = sheet.getLastRow()
    if (survivors.length > 0) {
      var writeRange = sheet.getRange(2, 1, survivors.length, fields.length)
      writeRange.setNumberFormat('@')
      writeRange.setValues(survivors)
      if (currentLastRow > survivors.length + 1) {
        sheet.getRange(survivors.length + 2, 1, currentLastRow - survivors.length - 1, fields.length).clearContent()
      }
    } else if (currentLastRow >= 2) {
      sheet.getRange(2, 1, currentLastRow - 1, fields.length).clearContent()
    }
  }

  var data = {}
  for (var t in TABLE_FIELDS) data[t] = readSheet(t)
  var deletions = readSheet('deletions')
  return ContentService
    .createTextOutput(JSON.stringify({ data: data, deletions: deletions }))
    .setMimeType(ContentService.MimeType.JSON)
}`

type BackupTarget = 'unidades' | 'etiquetas' | 'ingredientes' | 'platos'

const BACKUP_TITLES: Record<BackupTarget, string> = {
  unidades: 'Tipos de Unidades',
  etiquetas: 'Etiquetas de Platos',
  ingredientes: 'Ingredientes',
  platos: 'Platos (Recetas Completas)',
}

const BACKUP_SUBTITLES: Record<BackupTarget, string> = {
  unidades: 'Exporta o importa unidades en JSON',
  etiquetas: 'Exporta o importa etiquetas en JSON',
  ingredientes: 'Exporta o importa ingredientes en JSON',
  platos: 'Exporta o importa recetas completas en JSON',
}

const BACKUP_DESCRIPTIONS: Record<BackupTarget, string> = {
  unidades: 'Descarga las unidades actuales o importa un archivo JSON (reemplaza todas)',
  etiquetas: 'Descarga las etiquetas actuales o importa un archivo JSON (reemplaza todas)',
  ingredientes: 'Descarga los ingredientes actuales o importa un archivo JSON (reemplaza todos)',
  platos: 'Descarga las recetas completas o importa un archivo JSON (actualiza por nombre)',
}

const CONFIRM_TITLES: Record<BackupTarget, string> = {
  unidades: '¿Reemplazar todas las unidades? Se eliminaran las actuales y se cargaran las del archivo.',
  etiquetas: '¿Reemplazar todas las etiquetas? Se cancela si alguna etiqueta usada por platos falta en el archivo.',
  ingredientes: '¿Reemplazar todos los ingredientes? Se cancela si algun ingrediente usado por platos falta en el archivo.',
  platos: '¿Importar platos? Se actualizan los que tengan el mismo nombre y se agregan los nuevos. Si falta un ingrediente o unidad, no se registra nada.',
}

const BACKUP_ICONS: Record<BackupTarget, typeof Boxes> = {
  unidades: Boxes,
  etiquetas: Tag,
  ingredientes: Leaf,
  platos: UtensilsCrossed,
}

const Settings = () => {
  const navigate = useNavigate()
  const changePin = useAuthStore((s) => s.changePin)
  const logout = useAuthStore((s) => s.logout)

  const sync = useSyncStore((s) => s.sync)
  const syncing = useSyncStore((s) => s.syncing)
  const lastSync = useSyncStore((s) => s.lastSync)
  const syncError = useSyncStore((s) => s.error)
  const appsScriptUrl = useSyncStore((s) => s.appsScriptUrl)
  const loadUrl = useSyncStore((s) => s.loadUrl)
  const saveUrl = useSyncStore((s) => s.saveUrl)

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showResetAlert, setShowResetAlert] = useState(false)
  const [showUpdateAlert, setShowUpdateAlert] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(false)
  const [showTutorialIAModal, setShowTutorialIAModal] = useState(false)
  const [iaKeyInput, setIaKeyInput] = useState('')
  const [mostrarIaKey, setMostrarIaKey] = useState(false)
  const [tieneIaKey, setTieneIaKey] = useState(false)
  const [backupTarget, setBackupTarget] = useState<BackupTarget | null>(null)
  const [showImportAlert, setShowImportAlert] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [syncUrlInput, setSyncUrlInput] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImport = useRef<{ target: BackupTarget; data: unknown } | null>(null)
  const reemplazarUnidades = usePlanificacionStore((s) => s.reemplazarUnidades)
  const importarEtiquetas = usePlanificacionStore((s) => s.importarEtiquetas)
  const importarIngredientes = usePlanificacionStore((s) => s.importarIngredientes)
  const importarPlatos = usePlanificacionStore((s) => s.importarPlatos)
  const addToast = useToastStore((s) => s.addToast)

  const filterPin = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4)

  useEffect(() => {
    loadUrl()
    db.config.get('aiApiKey').then((c) => setTieneIaKey(!!c?.value))
  }, [loadUrl])

  useEffect(() => {
    setSyncUrlInput(appsScriptUrl)
  }, [appsScriptUrl])

  const openPinModal = () => {
    setOldPin('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
    setShowPinModal(true)
  }

  const handleChangePin = async () => {
    setError(null)

    if (oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      setError('Todos los PINs deben tener 4 digitos')
      return
    }

    if (newPin !== confirmPin) {
      setError('Los PINs nuevos no coinciden')
      return
    }

    const success = await changePin(oldPin, newPin)
    if (!success) {
      setError('PIN actual incorrecto')
      return
    }

    setShowPinModal(false)
    setOldPin('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
  }

  const handleGuardarIaKey = async () => {
    const key = iaKeyInput.trim()
    if (!key) {
      addToast('Pega tu API key de Gemini', 'warning')
      return
    }
    await db.config.put({ key: 'aiApiKey', value: key })
    setTieneIaKey(true)
    setIaKeyInput('')
    addToast('API key guardada', 'success')
  }

  const handleQuitarIaKey = async () => {
    await db.config.delete('aiApiKey')
    setTieneIaKey(false)
    setIaKeyInput('')
    addToast('API key eliminada', 'info')
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleSaveUrl = async () => {
    await saveUrl(syncUrlInput.trim())
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(APPS_SCRIPT_CODE)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleSync = async () => {
    await saveUrl(syncUrlInput.trim())
    await sync()
  }

  const handleResetData = async () => {
    await Promise.all([
      db.platos.clear(),
      db.ingredientes.clear(),
      db.platoIngredientes.clear(),
      db.planificaciones.clear(),
      db.compras.clear(),
      db.config.clear(),
      db.unidades.clear(),
      db.deletions.clear(),
    ])
    await Promise.all([
      db.unidades.bulkAdd(withSeedSync('unidades', unidadesSeed)),
      db.ingredientes.bulkAdd(withSeedSync('ingredientes', ingredientesSeed)),
    ])
    setShowResetAlert(false)
    logout()
    navigate('/')
  }

  const handleForceUpdate = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const reg of registrations) {
        await reg.unregister()
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      for (const key of keys) {
        await caches.delete(key)
      }
    }
    window.location.reload()
  }

  // ── Backup JSON: unidades / etiquetas / ingredientes / platos ──
  const downloadJson = (data: unknown, baseName: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = baseName + '-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = async (target: BackupTarget) => {
    if (target === 'unidades') {
      const data = (await db.unidades.toArray()).map((u) => ({ nombre: u.nombre }))
      downloadJson(data, 'unidades')
      addToast('Unidades descargadas (' + data.length + ')', 'success')
    } else if (target === 'etiquetas') {
      const data = (await db.etiquetas.toArray()).map((e) => ({ nombre: e.nombre }))
      downloadJson(data, 'etiquetas')
      addToast('Etiquetas descargadas (' + data.length + ')', 'success')
    } else if (target === 'ingredientes') {
      const data = (await db.ingredientes.toArray()).map((i) => ({
        nombre: i.nombre,
        unidad: i.unidad,
        ...(i.nutricion ? { nutricion: i.nutricion } : {}),
      }))
      downloadJson(data, 'ingredientes')
      addToast('Ingredientes descargados (' + data.length + ')', 'success')
    } else {
      const [platos, ingredientes, platoIngredientes, etiquetas, platoEtiquetas] = await Promise.all([
        db.platos.toArray(),
        db.ingredientes.toArray(),
        db.platoIngredientes.toArray(),
        db.etiquetas.toArray(),
        db.platoEtiquetas.toArray(),
      ])
      const ingById = new Map(ingredientes.map((i) => [i.id as number, i]))
      const etqById = new Map(etiquetas.map((e) => [e.id as number, e]))
      const data = platos.map((p) => ({
        nombre: p.nombre,
        descripcion: p.descripcion,
        etiquetas: platoEtiquetas
          .filter((pe) => pe.platoId === p.id)
          .map((pe) => etqById.get(pe.etiquetaId)?.nombre ?? '')
          .filter((n) => n !== ''),
        ...(p.porciones !== undefined ? { porciones: p.porciones } : {}),
        ...(p.nutricion ? { nutricion: p.nutricion } : {}),
        ingredientes: platoIngredientes
          .filter((pi) => pi.platoId === p.id)
          .map((pi) => ({
            nombre: ingById.get(pi.ingredienteId)?.nombre ?? '',
            cantidad: pi.cantidad,
            unidad: ingById.get(pi.ingredienteId)?.unidad ?? '',
          }))
          .filter((x) => x.nombre !== ''),
      }))
      downloadJson(data, 'platos')
      addToast('Platos descargados (' + data.length + ')', 'success')
    }
    setBackupTarget(null)
  }

  const parseImport = (target: BackupTarget, parsed: unknown): { ok: true; data: unknown } | { ok: false; error: string } => {
    let lista: unknown[] | null = null
    if (Array.isArray(parsed)) {
      lista = parsed
    } else if (parsed && typeof parsed === 'object') {
      for (const key of ['unidades', 'etiquetas', 'ingredientes', 'platos']) {
        const value = (parsed as Record<string, unknown>)[key]
        if (Array.isArray(value)) {
          lista = value
          break
        }
      }
    }
    if (lista === null) return { ok: false, error: 'Archivo JSON invalido' }

    if (target === 'unidades' || target === 'etiquetas') {
      const nombres = lista
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && typeof (item as { nombre?: unknown }).nombre === 'string') {
            return (item as { nombre: string }).nombre
          }
          return null
        })
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      if (nombres.length === 0) {
        return { ok: false, error: 'El archivo no contiene ' + (target === 'unidades' ? 'unidades' : 'etiquetas') + ' validas' }
      }
      return { ok: true, data: nombres }
    }

    if (target === 'ingredientes') {
      const items: IngredienteImport[] = []
      for (const item of lista) {
        if (typeof item === 'string') {
          items.push({ nombre: item })
        } else if (item && typeof item === 'object' && typeof (item as { nombre?: unknown }).nombre === 'string') {
          const obj = item as { nombre: string; unidad?: unknown; nutricion?: unknown }
          items.push({
            nombre: obj.nombre,
            unidad: typeof obj.unidad === 'string' ? obj.unidad : undefined,
            nutricion: obj.nutricion,
          })
        }
      }
      const validos = items.filter((i) => i.nombre.trim().length > 0)
      if (validos.length === 0) return { ok: false, error: 'El archivo no contiene ingredientes validos' }
      return { ok: true, data: validos }
    }

    const recetas: PlatoReceta[] = []
    for (const item of lista) {
      if (item && typeof item === 'object' && typeof (item as { nombre?: unknown }).nombre === 'string') {
        const obj = item as Record<string, unknown>
        let nutricion: Nutricion | undefined
        if (obj.nutricion && typeof obj.nutricion === 'object' && !Array.isArray(obj.nutricion)) {
          const rawNut = obj.nutricion as Record<string, unknown>
          nutricion = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
          for (const key of NUTRICION_KEYS) {
            const v = rawNut[key]
            nutricion[key] = v === undefined || v === null || v === '' ? 0 : Number(v)
          }
        }
        recetas.push({
          nombre: obj.nombre as string,
          descripcion: typeof obj.descripcion === 'string' ? obj.descripcion : '',
          etiquetas: Array.isArray(obj.etiquetas) ? obj.etiquetas.map(String) : [],
          porciones:
            obj.porciones === undefined || obj.porciones === null || obj.porciones === ''
              ? undefined
              : Number(obj.porciones),
          nutricion,
          ingredientes: Array.isArray(obj.ingredientes)
            ? obj.ingredientes
                .filter((ri): ri is Record<string, unknown> => ri !== null && typeof ri === 'object')
                .map((ri) => ({
                  nombre: String(ri.nombre ?? ''),
                  cantidad: Number(ri.cantidad),
                  unidad: String(ri.unidad ?? ''),
                }))
            : [],
        })
      }
    }
    if (recetas.length === 0) return { ok: false, error: 'El archivo no contiene platos validos' }
    return { ok: true, data: recetas }
  }

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !backupTarget) return

    try {
      const parsed: unknown = JSON.parse(await file.text())
      const resultado = parseImport(backupTarget, parsed)

      if (!resultado.ok) {
        addToast(resultado.error, 'error')
        return
      }

      pendingImport.current = { target: backupTarget, data: resultado.data }
      setBackupTarget(null)
      setShowImportAlert(true)
    } catch {
      addToast('Archivo JSON invalido', 'error')
    }
  }

  const handleConfirmImport = async () => {
    const pending = pendingImport.current
    setShowImportAlert(false)
    pendingImport.current = null
    if (!pending) return

    let result: ImportResult | number
    if (pending.target === 'unidades') {
      result = await reemplazarUnidades(pending.data as string[])
    } else if (pending.target === 'etiquetas') {
      result = await importarEtiquetas(pending.data as string[])
    } else if (pending.target === 'ingredientes') {
      result = await importarIngredientes(pending.data as IngredienteImport[])
    } else {
      result = await importarPlatos(pending.data as PlatoReceta[])
    }

    if (typeof result === 'number') {
      addToast('Se cargaron ' + result + ' unidades', 'success')
    } else if (result.ok) {
      const nombres: Record<BackupTarget, string> = {
        unidades: 'unidades',
        etiquetas: 'etiquetas',
        ingredientes: 'ingredientes',
        platos: 'platos',
      }
      addToast('Se cargaron ' + result.total + ' ' + nombres[pending.target], 'success')
    } else {
      addToast(result.error, 'error')
    }
  }

  return (
    <div className="flex flex-col flex-1 px-5 py-5 bg-backdrop min-h-full">
      <div className="flex justify-between items-center mb-6">
        <span className="text-gray-400 text-xs font-medium">V 2.1</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-danger/10 border border-danger/30 py-2 px-4 rounded-lg text-danger text-sm font-medium hover:bg-danger/20 active:scale-95 transition-all"
        >
          <LogOut size={16} />
          Cerrar Sesion
        </button>
      </div>

      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <Cloud size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-dark font-semibold">Sincronizacion</p>
              <p className="text-gray-400 text-sm">Google Sheets</p>
            </div>
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="ml-auto p-2 text-gray-400 hover:text-primary transition-colors"
            >
              <HelpCircle size={20} />
            </button>
          </div>

          <input
            type="url"
            placeholder="URL de Google Apps Script"
            value={syncUrlInput}
            onChange={(e) => setSyncUrlInput(e.target.value)}
            className="bg-gray-100 rounded-lg px-4 py-2.5 w-full mb-2 border border-gray-300 outline-none text-dark text-sm"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSaveUrl}
              className="flex-1 bg-gray-200 py-2.5 rounded-lg text-gray-700 font-semibold text-sm active:scale-95 transition-all"
            >
              Guardar
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || !syncUrlInput.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-primary py-2.5 rounded-lg text-light font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>

          {lastSync && (
            <p className="text-gray-400 text-xs mt-2">
              Ultima sincronizacion: {new Date(lastSync).toLocaleString('es')}
            </p>
          )}
          {syncError && (
            <p className="text-danger text-xs mt-2">{syncError}</p>
          )}
        </div>

        <button
          onClick={openPinModal}
          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-medium active:scale-[0.99] transition-all"
        >
          <div className="bg-primary/10 p-2.5 rounded-lg">
            <Lock size={20} className="text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-dark font-semibold">Cambiar PIN</p>
            <p className="text-gray-400 text-sm">Actualiza tu PIN de acceso</p>
          </div>
        </button>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <KeyRound size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-dark font-semibold">Planificador IA</p>
              <p className="text-gray-400 text-sm">Gemini para planificar la semana</p>
            </div>
            {tieneIaKey && (
              <span className="flex items-center gap-1 bg-success/10 text-success text-xs font-semibold px-2 py-1 rounded-full">
                <Check size={13} />
                Configurada
              </span>
            )}
          </div>

          <div className="relative mb-2">
            <input
              type={mostrarIaKey ? 'text' : 'password'}
              placeholder="API key de Gemini"
              value={iaKeyInput}
              onChange={(e) => setIaKeyInput(e.target.value)}
              className="bg-gray-100 rounded-lg px-4 py-2.5 w-full border border-gray-300 outline-none text-dark text-sm pr-10"
            />
            <button
              onClick={() => setMostrarIaKey(!mostrarIaKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {mostrarIaKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={handleGuardarIaKey}
              className="flex-1 bg-primary py-2.5 rounded-lg text-light font-semibold text-sm active:scale-95 transition-all"
            >
              Guardar
            </button>
            {tieneIaKey && (
              <button
                onClick={handleQuitarIaKey}
                className="bg-danger/10 border border-danger/30 text-danger py-2.5 px-4 rounded-lg font-semibold text-sm active:scale-95 transition-all"
              >
                Quitar
              </button>
            )}
          </div>

          <button
            onClick={() => setShowTutorialIAModal(true)}
            className="flex items-center gap-1.5 text-primary text-xs font-medium active:scale-95 transition-all"
          >
            <HelpCircle size={14} />
            Como obtener una API key gratis (tutorial)
          </button>
        </div>

        {(Object.keys(BACKUP_TITLES) as BackupTarget[]).map((target) => {
          const Icon = BACKUP_ICONS[target]
          return (
            <button
              key={target}
              onClick={() => setBackupTarget(target)}
              className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-medium active:scale-[0.99] transition-all"
            >
              <div className="bg-primary/10 p-2.5 rounded-lg">
                <Icon size={20} className="text-primary" />
              </div>
              <div className="text-left flex-1">
                <p className="text-dark font-semibold">{BACKUP_TITLES[target]}</p>
                <p className="text-gray-400 text-sm">{BACKUP_SUBTITLES[target]}</p>
              </div>
            </button>
          )
        })}

        <button
          onClick={() => setShowResetAlert(true)}
          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-medium active:scale-[0.99] transition-all"
        >
          <div className="bg-danger/10 p-2.5 rounded-lg">
            <Trash2 size={20} className="text-danger" />
          </div>
          <div className="text-left flex-1">
            <p className="text-dark font-semibold">Restablecer datos</p>
            <p className="text-gray-400 text-sm">Borra todo y vuelve al inicio</p>
          </div>
        </button>

        <button
          onClick={() => setShowUpdateAlert(true)}
          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-medium active:scale-[0.99] transition-all"
        >
          <div className="bg-primary/10 p-2.5 rounded-lg">
            <RotateCcw size={20} className="text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-dark font-semibold">Actualizar aplicacion</p>
            <p className="text-gray-400 text-sm">Descarga la ultima version sin perder datos</p>
          </div>
        </button>
      </div>

      <Modal isOpen={showPinModal} onClose={() => setShowPinModal(false)}>
        <div className="bg-white rounded-2xl p-6 w-11/12 max-w-sm">
          <h2 className="text-xl font-bold text-primary mb-4 text-center">Cambiar PIN</h2>

          <input
            type="password"
            placeholder="PIN actual"
            value={oldPin}
            onChange={(e) => setOldPin(filterPin(e.target.value))}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          />

          <input
            type="password"
            placeholder="Nuevo PIN"
            value={newPin}
            onChange={(e) => setNewPin(filterPin(e.target.value))}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          />

          <input
            type="password"
            placeholder="Confirmar nuevo PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(filterPin(e.target.value))}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          />

          {error && <p className="text-danger text-sm text-center mb-3">{error}</p>}

          <div className="flex flex-row gap-3">
            <button
              onClick={() => setShowPinModal(false)}
              className="flex-1 bg-gray-200 py-3 rounded-lg text-gray-700 font-semibold active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleChangePin}
              className="flex-1 bg-primary py-3 rounded-lg text-light font-semibold active:scale-95 transition-all"
            >
              Cambiar
            </button>
          </div>
        </div>
      </Modal>

      <AlertCustom
        isAlert={showResetAlert}
        title="¿Eliminar todos los datos? Esta accion no se puede deshacer."
        onConfirm={handleResetData}
        onClose={() => setShowResetAlert(false)}
      />

      <AlertCustom
        isAlert={showUpdateAlert}
        title="¿Actualizar la aplicacion? Se descargara la ultima version. Tus datos no se perderan."
        onConfirm={handleForceUpdate}
        onClose={() => setShowUpdateAlert(false)}
      />

      <Modal isOpen={backupTarget !== null} onClose={() => setBackupTarget(null)}>
        <div className="bg-white rounded-2xl p-6 w-11/12 max-w-sm">
          <h2 className="text-xl font-bold text-primary mb-1 text-center">
            {backupTarget ? BACKUP_TITLES[backupTarget] : ''}
          </h2>
          <p className="text-gray-400 text-sm text-center mb-5">
            {backupTarget ? BACKUP_DESCRIPTIONS[backupTarget] : ''}
          </p>

          <button
            onClick={() => backupTarget && handleExport(backupTarget)}
            className="w-full flex items-center justify-center gap-2 bg-gray-200 py-3 rounded-lg text-gray-700 font-semibold mb-3 active:scale-95 transition-all"
          >
            <Download size={18} />
            Descargar JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-primary py-3 rounded-lg text-light font-semibold active:scale-95 transition-all"
          >
            <Upload size={18} />
            Importar JSON
          </button>
        </div>
      </Modal>

      <AlertCustom
        isAlert={showImportAlert}
        title={pendingImport.current ? CONFIRM_TITLES[pendingImport.current.target] : ''}
        onConfirm={handleConfirmImport}
        onClose={() => setShowImportAlert(false)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <Modal isOpen={showInstructionsModal} onClose={() => setShowInstructionsModal(false)}>
        <div className="bg-white rounded-2xl p-5 w-[95vw] max-w-lg max-h-[85vh] flex flex-col">
          <h2 className="text-lg font-bold text-primary mb-3">Configurar sincronizacion</h2>

          <div className="overflow-y-auto flex-1 space-y-3 mb-4">
            <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
              <li>Crea un <strong>Google Sheet nuevo</strong> en <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">sheets.google.com</a></li>
              <li>Dentro del sheet, ve a <strong>Extensiones → Apps Script</strong></li>
              <li>Borra el codigo por defecto y pega el codigo de abajo</li>
              <li>Haz clic en <strong>Deploy</strong> → <strong>New deployment</strong></li>
              <li>Selecciona el tipo <strong>Web app</strong></li>
              <li>En <strong>Execute as</strong>: selecciona <em>Me</em></li>
              <li>En <strong>Who has access</strong>: selecciona <em>Anyone</em></li>
              <li>Haz clic en <strong>Deploy</strong> y autoriza los permisos</li>
              <li>Copia la <strong>URL del Web app</strong> (termina en <code className="bg-gray-100 px-1 rounded text-xs">/exec</code>)</li>
              <li>Pega la URL en el campo de arriba y haz clic en <strong>Guardar</strong></li>
            </ol>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500">Codigo de Apps Script</p>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-xs font-medium text-primary active:scale-95 transition-all"
                >
                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-3 overflow-auto max-h-[35vh] whitespace-pre">
                {APPS_SCRIPT_CODE}
              </pre>
            </div>
          </div>

          <button
            onClick={() => setShowInstructionsModal(false)}
            className="w-full bg-primary py-2.5 rounded-lg text-light font-semibold text-sm active:scale-95 transition-all"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      <Modal isOpen={showTutorialIAModal} onClose={() => setShowTutorialIAModal(false)}>
        <div className="bg-white rounded-2xl p-5 w-[95vw] max-w-lg max-h-[85vh] flex flex-col">
          <h2 className="text-lg font-bold text-primary mb-3">Como obtener tu API key de Gemini</h2>

          <div className="overflow-y-auto flex-1 space-y-3 mb-4">
            <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
              <li>
                Abre <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">aistudio.google.com</a> e inicia sesion con tu cuenta Google
              </li>
              <li>Haz clic en <strong>Get API key</strong> (o <strong>Create API key</strong>)</li>
              <li>Selecciona <strong>Create API key in new project</strong></li>
              <li>Se generara una clave que empieza con <code className="bg-gray-100 px-1 rounded text-xs">AIza...</code> — copiala</li>
              <li>Vuelve aqui, pegala en el campo de arriba y toca <strong>Guardar</strong></li>
              <li>Listo: en Inicio toca <strong>Planificar</strong> y elige el modo <strong>IA (Gemini)</strong></li>
            </ol>

            <div className="bg-gray-100 rounded-lg p-3 text-xs text-gray-600">
              <p className="font-semibold mb-1">Importante:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>El tier gratuito de Gemini es suficiente para uso personal</li>
                <li>Tu clave se guarda solo en este dispositivo, nunca se comparte</li>
                <li>No la publiques ni la compartas con nadie</li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setShowTutorialIAModal(false)}
            className="w-full bg-primary py-2.5 rounded-lg text-light font-semibold text-sm active:scale-95 transition-all"
          >
            Entendido
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default Settings
