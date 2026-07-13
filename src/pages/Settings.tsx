import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Trash2, Lock, RefreshCw, Cloud, RotateCcw, HelpCircle, Check, Copy } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useSyncStore } from '../store/syncStore'
import { db, ingredientesSeed, unidadesSeed, withSeedSync } from '../db/dexie'
import Modal from '../components/ui/Modal'
import AlertCustom from '../components/ui/AlertCustom'

const APPS_SCRIPT_CODE = `var TABLE_FIELDS = {
  platos:            ['syncId', 'nombre', 'descripcion', 'updatedAt'],
  ingredientes:      ['syncId', 'nombre', 'unidad', 'updatedAt'],
  platoIngredientes: ['syncId', 'platoSyncId', 'platoId', 'ingredienteSyncId', 'ingredienteId', 'cantidad', 'updatedAt'],
  planificaciones:   ['syncId', 'platoSyncId', 'platoId', 'fecha', 'estado', 'updatedAt'],
  compras:           ['syncId', 'ingredienteSyncId', 'ingredienteId', 'cantidad', 'estado', 'numeroSemana', 'anio', 'updatedAt'],
  unidades:          ['syncId', 'nombre', 'updatedAt']
}

var DEL_FIELDS = ['syncId', 'table', 'deletedAt']

function ensureSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  for (var table in TABLE_FIELDS) {
    var sheet = ss.getSheetByName(table)
    if (!sheet) sheet = ss.insertSheet(table)
    if (sheet.getLastRow() === 0) sheet.appendRow(TABLE_FIELDS[table])
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
  const [copiedCode, setCopiedCode] = useState(false)
  const [syncUrlInput, setSyncUrlInput] = useState('')

  const filterPin = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4)

  useEffect(() => {
    loadUrl()
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

  return (
    <div className="flex flex-col flex-1 px-5 py-5 bg-backdrop min-h-full">
      <div className="flex justify-between items-center mb-6">
        <span className="text-gray-400 text-xs font-medium">V 1.9</span>
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
    </div>
  )
}

export default Settings
