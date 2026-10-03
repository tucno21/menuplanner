# Google Apps Script — MenuPlanner Sync

## Setup

1. **Crea un Google Sheet nuevo** (en blanco) desde [sheets.google.com](https://sheets.google.com)
2. Dentro del sheet, ve a **Extensiones → Apps Script**
3. Borra el codigo por defecto y pega el codigo de abajo
4. Haz clic en **Deploy → New deployment**
5. Selecciona tipo **Web app**
6. **Execute as**: *Me*
7. **Who has access**: *Anyone*
8. Haz clic en **Deploy** y autoriza los permisos
9. Copia la **URL del Web app** (termina en `/exec`)
10. En MenuPlanner → Settings → pega la URL → **Guardar** → **Sincronizar**

> El script usa el Google Sheet donde lo creaste (container-bound). Las hojas se crean automaticamente en el primer sync.

## Codigo

```javascript
var TABLE_FIELDS = {
  platos:            ['syncId', 'nombre', 'descripcion', 'updatedAt'],
  ingredientes:      ['syncId', 'nombre', 'unidad', 'updatedAt'],
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

  // ── Merge deletions (batch) ──────────────────────────
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
  } else {
    delSheet.getRange(2, 1, Math.max(delSheet.getLastRow() - 1, 1), 3).clearContent()
  }

  // Build per-table deletion lookup: { tableName: { syncId: deletedAtMs } }
  var delByTable = {}
  allDelRows.forEach(function (r) {
    var t = r[1]
    if (!delByTable[t]) delByTable[t] = {}
    delByTable[t][r[0]] = new Date(r[2]).getTime()
  })

  // ── Merge data tables (batch read, in-memory merge, batch write) ──
  for (var tableName in TABLE_FIELDS) {
    var fields = TABLE_FIELDS[tableName]
    var sheet = ss.getSheetByName(tableName)
    var syncIdIdx = 0
    var updatedIdx = fields.indexOf('updatedAt')

    // Read existing rows into memory
    var existing = []
    var lastRow = sheet.getLastRow()
    if (lastRow >= 2) {
      existing = sheet.getRange(2, 1, lastRow - 1, fields.length).getValues()
    }

    var tableDels = delByTable[tableName] || {}

    // Remove rows where a deletion exists and is newer than the record
    var survivors = existing.filter(function (row) {
      var sid = row[syncIdIdx]
      if (sid && tableDels[sid]) {
        var recTime = updatedIdx >= 0 ? new Date(row[updatedIdx]).getTime() : 0
        return recTime > tableDels[sid]
      }
      return true
    })

    // Index survivors by syncId for fast lookup
    var survMap = {}
    survivors.forEach(function (row, i) {
      var sid = row[syncIdIdx]
      if (sid) survMap[sid] = i
    })

    // Merge incoming records
    var incoming = (body.data && body.data[tableName]) || []
    incoming.forEach(function (rec) {
      var sid = rec.syncId
      if (!sid) return

      // Skip if record was deleted after this update
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
        if (newMs > existMs) {
          survivors[idx] = newRow
        }
      } else {
        survMap[sid] = survivors.length
        survivors.push(newRow)
      }
    })

    // Batch write: clear old data, write survivors
    var currentLastRow = sheet.getLastRow()
    if (survivors.length > 0) {
      var writeRange = sheet.getRange(2, 1, survivors.length, fields.length)
      writeRange.setNumberFormat('@')
      writeRange.setValues(survivors)
      // Clear leftover rows beyond survivors
      if (currentLastRow > survivors.length + 1) {
        sheet.getRange(survivors.length + 2, 1, currentLastRow - survivors.length - 1, fields.length).clearContent()
      }
    } else if (currentLastRow >= 2) {
      sheet.getRange(2, 1, currentLastRow - 1, fields.length).clearContent()
    }
  }

  // ── Return full merged state ─────────────────────────
  var data = {}
  for (var t in TABLE_FIELDS) data[t] = readSheet(t)
  var deletions = readSheet('deletions')
  return ContentService
    .createTextOutput(JSON.stringify({ data: data, deletions: deletions }))
    .setMimeType(ContentService.MimeType.JSON)
}
```

## Como funciona la sincronizacion

### Flujo del cliente (cada 2 min, al recuperar conexion, o manual)

1. **GET (pull)**: descarga todos los datos del servidor
2. **Merge**: compara con local por `syncId` — aniade nuevos, actualiza si el remoto es mas nuevo (`updatedAt`), elimina si hay un deletion mas reciente
3. **POST (push)**: envia todos los datos locales al servidor (fire-and-forget)

### Flujo del servidor (doPost)

1. Lee cada hoja completa en memoria (**1 llamada API por tabla**)
2. Aplica eliminaciones (filtra registros donde el deletion es mas reciente)
3. Mezcla los registros entrantes (aniade nuevos, actualiza si es mas nuevo)
4. Escribe toda la hoja de vuelta (**1 llamada API por tabla**)
5. Retorna el estado completo mergeado

### Resolucion de conflictos

- **Last write wins**: si el mismo registro fue modificado en dos dispositivos, gana el que tenga el `updatedAt` mas reciente
- **Deletions**: si un registro fue eliminado (tombstone), se elimina del servidor y de todos los dispositivos, a menos que haya sido modificado despues de la eliminacion

### Notas

- El sync es automatico y transparente, no requiere confirmacion del usuario
- Si hay un fallo de red, el proximo ciclo reintenta automaticamente
- Logs disponibles en la consola del navegador (`[Sync]`)
- NO editar manualmente las columnas `syncId` o `updatedAt` en el spreadsheet
