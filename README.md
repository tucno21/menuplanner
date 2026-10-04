# MenuPlanner

PWA **offline-first** para planificar menús semanales con generación automática de lista de compras. Los datos viven en el navegador (IndexedDB) y se sincronizan entre dispositivos mediante un backend sin servidor sobre **Google Apps Script + Google Sheets**.

- App: https://menuplanner-21.vercel.app/
- Autor: Carlos Tucno

## Características

- **Planificación semanal**: vista de semana actual y próxima (inicio lunes), con estado por plato (`pendiente` / `preparado`).
- **Planificación diaria**: asigna varios platos a una fecha, acciones de deslizar (ver detalle / eliminar).
- **Planificador de semana**: elige etiquetas y llena automáticamente los días vacíos (2 platos/día, sin repetir consecutivos, 100% offline).
- **Búsqueda de platos** por nombre y **etiquetas** (varias palabras en cualquier orden, ignora tildes) en /platos y al planificar.
- **CRUD de platos** con ingredientes y cantidades (relación muchos-a-muchos), **etiquetas** de clasificación e **información nutricional** (porciones + kcal/proteínas/carbohidratos/grasas/fibra) — calculada **automáticamente** desde los ingredientes (o manual como fallback).
- **CRUD de ingredientes y unidades** (24 unidades precargadas, ~76 ingredientes seed) con **nutrición opcional por 100 g / 100 ml / unidad**, cargable masivamente por JSON.
- **Backup JSON** desde Ajustes: exportar/importar unidades, etiquetas, ingredientes y platos con recetas completas (validación all-or-nothing al importar platos).
- **Lista de compras automática**: agrega ingredientes de la semana, suma cantidades por ingrediente+unidad y permite marcar ítems como comprados (por semana ISO y año).
- **Autenticación local por PIN** (se guarda en IndexedDB, no hay servidor de auth).
- **Sincronización multi-dispositivo** con resolución de conflictos *last-writer-wins* y eliminaciones con *tombstones*.
- **PWA instalable**: manifest, service worker con precache, actualización automática y forzada desde Ajustes.

## Stack

| Tecnología | Uso |
|---|---|
| React 19 + TypeScript | UI |
| Vite 8 | Build y dev server |
| Tailwind CSS v4 | Estilos (tokens `@theme` en `src/index.css`) |
| Dexie 4 | Base de datos local (IndexedDB), BD `MenuPlannerDB` |
| Zustand 5 | Estado global (4 stores) |
| react-router 7 | Rutas (paquete `react-router`) |
| vite-plugin-pwa | Manifest + service worker (Workbox) |
| oxlint | Linter |

El backend de sincronización es un **Google Apps Script** desplegado como Web App sobre un Google Sheet. Ver [`GOOGLE_APPS_SCRIPT.md`](./GOOGLE_APPS_SCRIPT.md) para instrucciones de despliegue y el código completo.

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # dev server con --host (SW de PWA habilitado en dev)
npm run build      # tsc -b && vite build (type-check + build de producción)
npm run lint       # oxlint
npm run preview    # servir el build de producción
```

Generación de íconos PWA (requiere imagen fuente en `public/pwa-icon.svg`):

```bash
npx pwa-assets-generator
```

## Estructura del proyecto

```
src/
├── main.tsx              # Punto de entrada
├── App.tsx               # Rutas + ProtectedRoute + montaje de Toast
├── index.css             # Tema Tailwind v4 (@theme: colores, sombras, keyframes)
├── components/
│   ├── CustomTab.tsx     # Tabs con indicador animado
│   ├── DiasSemana.tsx    # Tarjetas de los 7 días de una semana
│   └── ui/               # Toast, BottomSheet, Modal, AlertCustom,
│                         # SwipeReveal, BackButton, Input
├── db/dexie.ts           # Esquema Dexie (v5), modelos, seeds, constantes de sync
├── pages/
│   ├── MainLayout.tsx    # Shell con nav inferior (máx 480px, lg: 4xl)
│   ├── Login.tsx         # Crear/login con PIN de 4 dígitos
│   ├── Home.tsx          # Semanas + lista de compras + plan semanal
│   ├── Dia.tsx           # Platos de un día (swipe actions)
│   ├── Planificar.tsx    # Multi-selección de platos para una fecha
│   ├── Ingredientes.tsx  # CRUD de ingredientes
│   ├── Unidades.tsx      # CRUD de unidades
│   ├── Settings.tsx      # Sync URL, cambiar PIN, reset, forzar actualización
│   ├── NotFound.tsx      # 404
│   └── grupos/           # PlatosList, PlatoDetail, CrearPlato, ActualizarPlato
├── store/
│   ├── authStore.ts           # PIN auth (initialize/createPin/login/logout/changePin)
│   ├── planificacionStore.ts  # Store central de datos (CRUD + lista de compras)
│   ├── syncStore.ts           # Motor de sincronización (pull/merge/push)
│   └── toastStore.ts          # Cola de notificaciones toast
└── utils/
    ├── obtenerSemana.ts       # Semanas (lunes), parse local, número de semana ISO
    └── obtenerNombreDia.ts    # Nombre del día en español (Intl es-ES)
```

## Rutas

| Ruta | Página | Acceso |
|---|---|---|
| `/` | Login (PIN) | Pública |
| `/home` | Inicio (semanas + compras) | Protegida |
| `/home/dia/:fecha` | Día (`fecha` = `YYYY-MM-DD`) | Protegida |
| `/home/planificar/:fecha` | Planificar platos para una fecha | Protegida |
| `/platos` | Lista de platos | Protegida |
| `/platos/etiquetas` | CRUD de etiquetas de platos | Protegida |
| `/platos/plato/:platoId` | Detalle de plato | Protegida |
| `/platos/crear-plato` | Crear plato | Protegida |
| `/platos/actualizar-plato/:platoId` | Editar plato | Protegida |
| `/ingredientes` | Ingredientes | Protegida |
| `/ingredientes/unidades` | Unidades | Protegida |
| `/settings` | Ajustes (sync, PIN, backups JSON, reset, update) | Protegida |
| `*` | 404 | Pública |

`ProtectedRoute` inicializa los datos (`initialize()`) y arranca/detiene el auto-sync al montar/desmontar.

## Arquitectura de datos

Base de datos **`MenuPlannerDB`** (Dexie/IndexedDB), versión 6:

| Tabla | Clave | Notas |
|---|---|---|
| `platos` | `++id` | `syncId, nombre, descripcion, updatedAt` + `porciones`/`nutricion` opcionales (no indexados) |
| `ingredientes` | `++id` | `syncId, nombre, unidad, updatedAt` + `nutricion` opcional (por 100 g/100 ml/unidad, no indexado) |
| `platoIngredientes` | `++id` | Junction plato↔ingrediente con `cantidad`; guarda ids locales **y** `platoSyncId`/`ingredienteSyncId` |
| `planificaciones` | `++id` | `fecha` (`YYYY-MM-DD`), `estado` (`pendiente\|preparado`) |
| `compras` | `++id` | `numeroSemana`, `anio`, `estado` (`comprado\|pendiente`) |
| `unidades` | `++id` | 24 unidades seed |
| `etiquetas` | `++id` | Etiquetas de platos (v6) |
| `platoEtiquetas` | `++id` | Junction plato↔etiqueta (v6) |
| `config` | `key` (string) | `pin`, `appsScriptUrl`, `lastSyncPushTs` |
| `deletions` | `++id` | Tombstones `{syncId, table, deletedAt}` |

Reglas clave:

- **`syncId`** es la identidad entre dispositivos (`crypto.randomUUID()`; seeds con ids deterministas `seed-xxx-nombre`). El `id` local es solo del dispositivo.
- **`updatedAt`** (ISO string) se actualiza en cada escritura; la sync resuelve conflictos por *last-writer-wins*.
- **Toda eliminación es soft-delete**: primero se escribe un tombstone en `deletions`, luego se borra la fila.
- **Fechas**: siempre strings locales `YYYY-MM-DD` (usar `parseFechaLocal` para parsear, evita el off-by-one de UTC). Semanas inician lunes; número de semana ISO 8601.

## Sincronización (Google Apps Script)

Ciclo cada **120s** (si hay red), al recuperar conexión (`online` event) y manual desde Ajustes:

1. **Pull**: `GET` al Web App → `{ data: { tabla: filas[] }, deletions: [] }`.
2. **Merge** local: aplica tombstones remotos, upsert con LWW por `updatedAt` (remapeando FKs por `syncId`).
3. **Push**: `POST` con `Content-Type: text/plain` (evita preflight CORS de Apps Script) enviando filas con `updatedAt > lastSyncPushTs` + deletions pendientes.

El servidor (Sheet) mantiene una hoja por tabla + hoja `deletions`, y devuelve siempre el estado completo mergeado. Detalles y código en [`GOOGLE_APPS_SCRIPT.md`](./GOOGLE_APPS_SCRIPT.md).

> No editar manualmente las columnas `syncId` o `updatedAt` en el spreadsheet.

## PWA

- `vite-plugin-pwa` con `registerType: 'autoUpdate'`, precache Workbox y SW habilitado en dev (carpeta `dev-dist/`).
- Manifest inline en `vite.config.ts` (`theme_color #fd9e02`, `background_color #ffecd1`, standalone, portrait, español).
- Íconos generados desde `public/pwa-icon.svg` con `@vite-pwa/assets-generator` (preset `minimal-2023`).
- **Actualización forzada** desde Ajustes: desregistra SWs, borra Cache Storage y recarga.

## Despliegue

- **Vercel**: rewrite `/(.*) → /` (`vercel.json`) para SPA routing. Deploy automático del repositorio.
- El backend de sync es independiente: solo se necesita pegar la URL `/exec` del Web App en Ajustes → Sync.

## Notas

- La UI y los textos están en español (sin tildes en varios strings).
- La sync usa `axios` con `Content-Type: text/plain` en el POST (evita preflight CORS de Apps Script) y timeouts de 60s (GET) / 120s (POST).
- Documentación para agentes de IA: [`AGENTS.md`](./AGENTS.md).
- Formatos JSON de importación (para IAs): [`Documentacion/json-de-importacion.md`](./Documentacion/json-de-importacion.md).
