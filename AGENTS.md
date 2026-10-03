# AGENTS.md

Guía completa del proyecto para agentes de IA. Léela antes de modificar código.

## 1. Panorama general

**MenuPlanner** — PWA offline-first en español para planificar menús semanales con lista de compras automática. Todo el dato vive en el navegador (IndexedDB vía Dexie); la sincronización multi-dispositivo se hace contra un Google Apps Script (Web App) que usa un Google Sheet como almacenamiento. No hay backend propio ni servidor de autenticación (login por PIN local).

- URL desplegada: https://menuplanner-21.vercel.app/ (Vercel, rewrite SPA en `vercel.json`)
- Autor: Carlos Tucno
- UI en español (strings sin tildes), layout mobile-first con contenedor `max-w-[480px]` (`lg:max-w-4xl`)
- Documentación relacionada: [`README.md`](./README.md), [`GOOGLE_APPS_SCRIPT.md`](./GOOGLE_APPS_SCRIPT.md) (backend de sync completo)

## 2. Stack y comandos

React 19 + TypeScript, Vite 8, Tailwind CSS v4 (`@theme` en `src/index.css`), Dexie 4 (IndexedDB), Zustand 5, react-router 7 (paquete `react-router`, NO `react-router-dom`), vite-plugin-pwa (Workbox), oxlint.

```bash
npm run dev      # vite --host (PWA SW habilitado en dev, genera dev-dist/)
npm run build    # tsc -b && vite build — SIEMPRE ejecutar antes de terminar
npm run lint     # oxlint — SIEMPRE ejecutar antes de terminar
npm run preview  # servir build
```

tsconfig: `target es2023`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`, `erasableSyntaxOnly`, `noEmit`. Sin `strict` explícito.

## 3. Arquitectura

### 3.1 Rutas (src/App.tsx)

`BrowserRouter` con layout route `ProtectedRoute` (redirige a `/` si no autenticado; en mount llama `planificacionStore.initialize()` + `syncStore.startAutoSync()`, en unmount `stopAutoSync()`).

- `/` → `Login` (pública; PIN de 4 dígitos, crear o entrar)
- `/home` → `Home` (tabs Semana Actual/Próxima, bottom sheets de compras y plan semanal)
- `/home/dia/:fecha` → `Dia` (`:fecha` = `YYYY-MM-DD`; SwipeReveal: ojo=detalle, papelera=eliminar)
- `/home/planificar/:fecha` → `Planificar` (multi-selección de platos)
- `/platos`, `/platos/plato/:platoId`, `/platos/crear-plato`, `/platos/actualizar-plato/:platoId`
- `/ingredientes`, `/ingredientes/unidades`
- `/settings` → sync URL + código Apps Script embebido (`APPS_SCRIPT_CODE`), cambiar PIN, reset total, "Actualizar aplicación" (fuerza update de la PWA)
- `*` → `NotFound`

`MainLayout` provee nav inferior (Inicio, Platos, Ingredientes, Settings) y el contenedor centrado.

### 3.2 Base de datos (src/db/dexie.ts)

BD **`MenuPlannerDB`**, singleton `db`, **versión 5** (v1–v5 retenidas; v3–v5 con `upgrade()`). Exporta interfaces: `Plato, Ingrediente, PlatoIngrediente, Planificacion, Compra, Config, Unidad, Deletion` y uniones `EstadoPlato = 'pendiente'|'preparado'`, `EstadoCompra = 'comprado'|'pendiente'`, `SyncTable`.

| Tabla | PK | Índices / campos clave |
|---|---|---|
| `platos` | `++id` | `syncId, nombre, descripcion, updatedAt` |
| `ingredientes` | `++id` | `syncId, nombre, unidad, updatedAt` |
| `platoIngredientes` | `++id` | `syncId, platoId, ingredienteId, platoSyncId, ingredienteSyncId, cantidad(number), updatedAt` |
| `planificaciones` | `++id` | `syncId, platoId, platoSyncId, fecha('YYYY-MM-DD'), estado, updatedAt` |
| `compras` | `++id` | `syncId, ingredienteId, ingredienteSyncId, cantidad(string), estado, numeroSemana, anio, updatedAt` |
| `unidades` | `++id` | `syncId, nombre, updatedAt` (24 seed) |
| `config` | `key`(string) | guarda `'pin'`, `'appsScriptUrl'`, `'lastSyncPushTs'` |
| `deletions` | `++id` | tombstones `{syncId, table, deletedAt}` |

Reglas invariantes:

- **`syncId` = identidad entre dispositivos.** Nuevos registros: `crypto.randomUUID()`. Seeds: ids deterministas `` seed-${tabla.slice(0,3)}-${slug} `` (ej. `seed-ing-arroz`) con timestamp fijo `SEED_TS = 2024-01-01T00:00:00.000Z` (helper `withSeedSync`/`seedSyncId`). El `id` autoincremental es SOLO local.
- **`updatedAt`** ISO string en cada escritura; toda comparación es *last-writer-wins* por ms.
- **Toda eliminación pasa por `deleteTracked()`**: escribe tombstone en `deletions` ANTES de borrar. Nunca borrar directo con `db.tabla.delete()` para datos de usuario.
- **FKs duplicadas**: las tablas hijas guardan id local (`platoId`/`ingredienteId`) Y syncId (`platoSyncId`/`ingredienteSyncId`). Al mergear remoto, los ids locales se remapean con mapas syncId→id (orden de merge: platos → ingredientes → unidades → platoIngredientes → planificaciones → compras).
- `Ingrediente.unidad` guarda el NOMBRE de la unidad (string denormalizado, no FK).
- Seed en `db.on('populate')`: 24 unidades + ~76 ingredientes.
- `SYNC_TABLES = ['platos','ingredientes','platoIngredientes','planificaciones','compras','unidades']` (`config` y `deletions` van aparte).

### 3.3 Stores Zustand (src/store/)

Patrón `create<State>()`, sin middleware de persistencia. Acceso no-reactivo: `useXStore.getState()`.

- **`useAuthStore`**: `isAuthenticated, hasPin, loading, error`. PIN en `config['pin']`. Flag de logout en `sessionStorage['mp_loggedOut']`. Acciones: `initialize, createPin, login, logout, changePin, clearError`.
- **`usePlanificacionStore`** (central): estado `planificacion (DataPlanificacion[] agrupado por fecha), platos, ingredientes, unidades, compras, loading`. ~20 acciones: CRUD de platos/ingredientes/unidades, `addPlatoToFecha`, `setModificarEstado`, `removePlanificacion`, `calcularListaCompras(fechaInicio, fechaFin)`, `loadCompras`, `toggleCompra`. Helpers exportados `trackDeletion`/`deleteTracked`. `initialize()` reconstruye la vista agrupada y se re-ejecuta tras cada sync y tras mutaciones que afectan vistas.
- **`useSyncStore`**: `syncing, lastSync, error, appsScriptUrl`. Acciones `loadUrl, saveUrl, sync, startAutoSync, stopAutoSync`. Constantes: `SYNC_INTERVAL=120_000`, `GET_TIMEOUT=60_000`, `POST_TIMEOUT=120_000`.
- **`useToastStore`**: `addToast(message, type='info', duration=3000), removeToast`. `ToastType = 'success'|'error'|'info'|'warning'`. `<Toast/>` global montado en `App.tsx`.

### 3.4 Motor de sync (syncStore.ts)

1. **Pull** `GET` con axios (timeout 60s, `transformResponse` identity para parsear JSON manualmente) → `{ data: {tabla: filas}, deletions }`.
2. **Merge** (`mergeRemoteData`): tombstones remotos aplican si `updatedAt <= deletedAt`; upsert solo si remoto más nuevo; remapeo de FKs por syncId; `planificaciones.fecha` se normaliza a 10 chars (defensa contra serialización de fechas de Sheets).
3. **Rehidrata UI**: `planificacionStore.initialize()`.
4. **Push**: `gatherLocalData(sinceTs)` = filas con `updatedAt > config['lastSyncPushTs']` + deletions; se Strippa el `id` local; `POST` con `Content-Type: text/plain` (**evita preflight CORS** — Apps Script no responde OPTIONS). 120s timeout. Al éxito se guarda `lastSyncPushTs`.
- Auto-sync: interval 120s (solo si `navigator.onLine`) + listener del evento `online`. Guard `syncInProgress` module-level evita solapamiento.
- Errores mapeados a mensajes en español. Logs con prefijo `[Sync]`.

### 3.5 Utilidades y lógica de negocio

- `utils/obtenerSemana.ts`: `parseFechaLocal` (parsea `YYYY-MM-DD` como fecha LOCAL, evita off-by-one UTC), `obtenerSemanaActual`, `obtenerProximaSemana` (semanas que inician LUNES), `obtenerNumeroSemana` (ISO 8601, algoritmo del jueves). Interfaz `DiaSemana {dia, fecha, data:'si'|'no', cantidad}`.
- **Lista de compras** (`calcularListaCompras`): planificaciones por rango de fechas → platos únicos → ingredientes × veces que aparece el plato en el rango → redondeo 2 decimales → **agrupación por clave `${ingredienteId}-${unidad}`** (mismo ingrediente en distinta unidad = línea aparte). Devuelve `ListaItem[]` con `cantidad_total: string`.
- **Check de compras**: `Compra` clave implícita `(ingredienteId, numeroSemana, anio)` — semana ISO del lunes de la semana. `toggleCompra` crea o invierte `estado`.
- `utils/obtenerNombreDia.ts`: nombre del día vía `Intl` `es-ES`.

## 4. Convenciones de código

- Interfaces PascalCase para modelos y props (`XxxProps`); uniones de string literal para "enums"; `id?: number` requerido por Dexie.
- Mezcla español/inglés: campos DB en español (`nombre`, `cantidad`, `unidad`), funciones a menudo en español (`calcularListaCompras`, `obtenerSemana`), nombres de stores `useXxxStore`.
- Estilos SOLO con tokens de Tailwind v4 definidos en `src/index.css` (`bg-primary`, `text-secondary-dark`, `shadow-card`, `bg-backdrop`...). Colores de marca: primary `#fd9e02`, secondary `#025250`, backdrop `#ffecd1`.
- Modales: `Modal` (centrado genérico) o `BottomSheet` (desliza desde abajo); confirmaciones de borrado siempre con `AlertCustom`.
- Sin tests. Verificación = `npm run lint` + `npm run build` (tsc).
- Comentarios escasos; banners decorativos `// ── STEP ──` en sync.

## 5. Gotchas (no obvios, importantes)

1. **`axios` se usa en la sync** (`src/store/syncStore.ts`). El POST debe mantener `Content-Type: 'text/plain'` — si se cambia a application/json falla por preflight CORS. Timeout de axios mapea a `ECONNABORTED` (antes AbortError de fetch); errores se traducen con `mapearErrorSync()`.
2. Fechas SIEMPRE como string local `YYYY-MM-DD`; nunca `new Date('YYYY-MM-DD')` directo (UTC shift) — usar `parseFechaLocal`.
3. `POST` a Apps Script debe ser `Content-Type: text/plain`, si no, falla por preflight CORS.
4. El paquete de router es `react-router` (no `react-router-dom`).
5. Los `id` locales cambian entre dispositivos; cualquier lógica nueva que referencie platos/ingredientes desde otra tabla debe guardar TAMBIÉN el `syncId` y tener fallback de resolución.
6. `compras.cantidad` es `string`; en `platoIngredientes.cantidad` es `number`.
7. En dev el SW de PWA está activo (`dev-dist/`); si algo raro con caché, usar Ajustes → "Actualizar aplicación" o borrar `dev-dist/`.
8. Al editar un plato se borran y recrean sus `platoIngredientes` (con tombstones) — no asumir estabilidad de esos ids.
9. La hoja de Home ordena ítems comprados al final usando un `Set` de `ingredienteId` comprados.

## 6. Memoria persistente — Engram (MCP)

Este proyecto usa **Engram**, memoria persistente entre sesiones. El proyecto está registrado como **`menuplanner`**. Cualquier agente que trabaje aquí DEBE:

### Al iniciar una sesión
1. `mem_current_project` — detectar proyecto (debe resolver a `menuplanner`).
2. `mem_context` — ver sesiones/observaciones recientes del proyecto.
3. Si el usuario menciona trabajo previo ("recuerda", "lo que hicimos", "cómo lo resolvimos"): `mem_search` con palabras clave (p. ej. `query: "sync tombstones"`). Para contenido completo de un resultado usar `mem_get_observation` con el `id`.

### Al terminar tareas relevantes (obligatorio, no opcional)
Guardar con `mem_save` inmediatamente después de: decisiones de arquitectura, bugfixes, descubrimientos del codebase, patrones, cambios de configuración o preferencias del usuario. Formato:

- `title`: corto y buscable, verbo+qué (ej. `"Fixed FK remap in mergeRemoteData"`).
- `type`: `bugfix | decision | architecture | pattern | config | discovery | preference`.
- `scope`: `project` (default).
- `content` con esta estructura:
  ```
  **What**: una frase con lo hecho
  **Why**: por qué (bug, pedido del usuario, performance…)
  **Where**: archivos afectados (ej. src/store/syncStore.ts)
  **Learned**: gotchas/edge cases (omitir si no hay)
  ```
- Para temas que evolucionan (ej. el modelo de sync), usar `topic_key` estable (ej. `architecture/sync-model`) para hacer upsert en vez de duplicar; si dudas del key, `mem_suggest_topic_key`.

### Reglas de oro
- **Nunca inventes IDs de sesión**; si `mem_save` falla con `unknown_session`, reintentar sin `session_id`.
- Si `mem_save` responde `judgment_required`, iterar `candidates[]` y llamar `mem_judge` una vez por `judgment_id` con la relación adecuada (`related`, `compatible`, `scoped`, `conflicts_with`, `supersedes`, `not_conflict`). Preguntar al usuario solo si `confidence < 0.7` o conflicto en tipos `architecture/policy/decision`.
- Antes de decir "listo"/cerrar sesión: `mem_session_summary` con secciones `Goal / Instructions / Discoveries / Accomplished / Next Steps / Relevant Files`.
- Búsquedas efectivas: FTS5 por tokens — usar palabras clave concretas (`dexie`, `sync`, `tombstone`, `compras`, `PIN`) mejor que frases largas; `match_mode: "any"` para recall amplio.
