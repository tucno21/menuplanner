# Google Apps Script — MenuPlanner Sync

This document contains the Google Apps Script Web App code for bidirectional sync between MenuPlanner devices via Google Sheets.

## Setup

1. Go to [script.google.com](https://script.google.com) and create a **New Project**
2. Delete the default code and paste the code below
3. Click **Deploy → New deployment**
4. Select type **Web app**
5. Set **Execute as**: *Me*
6. Set **Who has access**: *Anyone*
7. Click **Deploy** and authorize the permissions
8. Copy the **Web app URL** (ends with `/exec`)
9. Open MenuPlanner → Settings → paste the URL in the Sync section → **Guardar**
10. Click **Sincronizar** to test

The script auto-creates a Google Spreadsheet called `MenuPlannerSync` in your Google Drive on first run.

## Apps Script Code

```javascript
/**
 * MenuPlanner Sync — Google Apps Script Web App
 * Bidirectional sync via Google Sheets
 */

const TABLE_FIELDS = {
  platos:            ['syncId', 'nombre', 'descripcion', 'updatedAt'],
  ingredientes:      ['syncId', 'nombre', 'unidad', 'updatedAt'],
  platoIngredientes: ['syncId', 'platoSyncId', 'platoId', 'ingredienteSyncId', 'ingredienteId', 'cantidad', 'updatedAt'],
  planificaciones:   ['syncId', 'platoSyncId', 'platoId', 'fecha', 'estado', 'updatedAt'],
  compras:           ['syncId', 'ingredienteSyncId', 'ingredienteId', 'cantidad', 'estado', 'numeroSemana', 'anio', 'updatedAt'],
  unidades:          ['syncId', 'nombre', 'updatedAt'],
  deletions:         ['syncId', 'table', 'deletedAt'],
}

// ─── Spreadsheet helpers ───────────────────────────────────────────

function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties()
  let ssId = props.getProperty('SPREADSHEET_ID')
  if (!ssId) {
    const ss = SpreadsheetApp.create('MenuPlannerSync')
    ssId = ss.getId()
    props.setProperty('SPREADSHEET_ID', ssId)
  }
  return SpreadsheetApp.openById(ssId)
}

function ensureSheets() {
  const ss = getSpreadsheet()
  for (const table of Object.keys(TABLE_FIELDS)) {
    let sheet = ss.getSheetByName(table)
    if (!sheet) {
      sheet = ss.insertSheet(table)
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(TABLE_FIELDS[table])
    }
  }
}

function readSheet(tableName) {
  const ss = getSpreadsheet()
  const sheet = ss.getSheetByName(tableName)
  if (!sheet || sheet.getLastRow() < 2) return []
  const fields = TABLE_FIELDS[tableName]
  const lastColumn = Math.max(fields.length, sheet.getLastColumn())
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues()
  return values.map(function (row) {
    const obj = {}
    fields.forEach(function (field, i) {
      obj[field] = row[i]
    })
    return obj
  })
}

function appendRow(tableName, record) {
  const sheet = getSpreadsheet().getSheetByName(tableName)
  const fields = TABLE_FIELDS[tableName]
  const row = fields.map(function (f) {
    return record[f] !== undefined ? record[f] : ''
  })
  sheet.appendRow(row)
}

function findRowIndex(tableName, syncId) {
  const sheet = getSpreadsheet().getSheetByName(tableName)
  if (!sheet || sheet.getLastRow() < 2) return -1
  const fields = TABLE_FIELDS[tableName]
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, fields.length).getValues()
  const syncIdIndex = fields.indexOf('syncId')
  for (let i = 0; i < data.length; i++) {
    if (data[i][syncIdIndex] === syncId) return i + 2 // +2 because rows start at 2
  }
  return -1
}

function deleteBySyncId(tableName, syncId, deletedAt) {
  const sheet = getSpreadsheet().getSheetByName(tableName)
  if (!sheet || sheet.getLastRow() < 2) return
  const fields = TABLE_FIELDS[tableName]
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, fields.length).getValues()
  const syncIdIndex = fields.indexOf('syncId')
  const updatedAtIndex = fields.indexOf('updatedAt')
  const delTime = new Date(deletedAt).getTime()

  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][syncIdIndex] === syncId) {
      if (updatedAtIndex >= 0) {
        const recTime = new Date(data[i][updatedAtIndex]).getTime()
        if (recTime > delTime) continue // record was modified after deletion — keep it
      }
      sheet.deleteRow(i + 2)
    }
  }
}

function mergeRecord(tableName, record) {
  const fields = TABLE_FIELDS[tableName]
  const updatedAtIndex = fields.indexOf('updatedAt')
  const rowIndex = findRowIndex(tableName, record.syncId)

  if (rowIndex === -1) {
    appendRow(tableName, record)
    return
  }

  // Compare timestamps
  const sheet = getSpreadsheet().getSheetByName(tableName)
  const existing = sheet.getRange(rowIndex, 1, 1, fields.length).getValues()[0]
  const existingUpdatedAt = new Date(existing[updatedAtIndex]).getTime()
  const newUpdatedAt = new Date(record.updatedAt).getTime()

  if (newUpdatedAt > existingUpdatedAt) {
    const row = fields.map(function (f) {
      return record[f] !== undefined ? record[f] : ''
    })
    sheet.getRange(rowIndex, 1, 1, fields.length).setValues([row])
  }
}

// ─── Web App endpoints ─────────────────────────────────────────────

function doGet() {
  ensureSheets()
  const data = {}
  for (const table of Object.keys(TABLE_FIELDS)) {
    if (table === 'deletions') continue
    data[table] = readSheet(table)
  }
  const deletions = readSheet('deletions')
  return ContentService
    .createTextOutput(JSON.stringify({ data: data, deletions: deletions }))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  ensureSheets()

  const body = JSON.parse(e.postData.contents)

  // Apply client deletions
  if (body.deletions) {
    for (const del of body.deletions) {
      // Add to deletions sheet (dedup by syncId)
      if (findRowIndex('deletions', del.syncId) === -1) {
        appendRow('deletions', del)
      }
      // Apply deletion to target table (with timestamp check)
      if (TABLE_FIELDS[del.table]) {
        deleteBySyncId(del.table, del.syncId, del.deletedAt)
      }
    }
  }

  // Merge client data
  if (body.data) {
    for (const tableName in body.data) {
      if (!TABLE_FIELDS[tableName]) continue
      const records = body.data[tableName]
      for (let i = 0; i < records.length; i++) {
        mergeRecord(tableName, records[i])
      }
    }
  }

  // Return full merged state
  const data = {}
  for (const table of Object.keys(TABLE_FIELDS)) {
    if (table === 'deletions') continue
    data[table] = readSheet(table)
  }
  const deletions = readSheet('deletions')

  return ContentService
    .createTextOutput(JSON.stringify({ data: data, deletions: deletions }))
    .setMimeType(ContentService.MimeType.JSON)
}
```

## How Sync Works

1. **Client sends** all local data (6 tables) + all local deletions via POST
2. **Server merges**:
   - Applies deletions (skips if record was modified after deletion timestamp)
   - Merges records by `syncId` (latest `updatedAt` wins)
3. **Server returns** the full merged state
4. **Client merges** the response using the same logic
5. Both sides converge to the same state

## Notes

- Sync runs automatically every 2 minutes when the app is open
- Sync also triggers when the device comes back online
- Manual sync available in Settings
- The Google Spreadsheet `MenuPlannerSync` can be viewed/edited directly in Google Drive
- Do NOT manually edit the `syncId` or `updatedAt` columns in the spreadsheet — this can break sync
