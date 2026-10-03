# MenuPlanner — Formato JSON para importar datos

> Documento pensado para ser entregado a un chat de IA: explica de qué va la app y cómo generar correctamente los 4 tipos de archivos JSON que se pueden importar desde **Ajustes (/settings)**.

---

## 1. ¿De qué trata MenuPlanner?

**MenuPlanner** es una aplicación web móvil (PWA, funciona sin internet) en español para planificar menús semanales de comida y generar automáticamente la **lista de compras**.

Sus conceptos principales son:

| Concepto | Qué es |
|---|---|
| **Unidades** | Tipos de medida de los ingredientes (kg, gr, ml, unidad, lata...). |
| **Ingredientes** | Alimentos con un nombre y una unidad por defecto (ej: "Arroz" en "kg"). |
| **Etiquetas** | Palabras clave para clasificar platos (ej: "nutritivo", "gustos", "rapido"). |
| **Platos** | Recetas: nombre + procedimiento + lista de ingredientes con cantidades + etiquetas opcionales. |
| **Planificaciones** | Platos asignados a fechas concretas de la semana. |
| **Compras** | Check-off de la lista de compras semanal. |

Los datos viven en el navegador del usuario y se sincronizan con un Google Sheet (opcional).

**Regla de oro de las relaciones:** un plato está formado por ingredientes que **deben existir** en la base de datos, cada ingrediente usa una **unidad que debe existir**, y sus etiquetas también **deben existir**. Por eso el orden recomendado de importación es:

1. Unidades → 2. Ingredientes → 3. Etiquetas → 4. Platos

---

## 2. Cómo importar un archivo

1. Abrir la app → **Ajustes** (pestaña Settings).
2. Tocar la tarjeta correspondiente: *Tipos de Unidades*, *Etiquetas de Platos*, *Ingredientes* o *Platos (Recetas Completas)*.
3. Pulsar **"Importar JSON"** y elegir el archivo `.json`.
4. Confirmar el mensaje de advertencia.
5. Ver el toast de éxito (`Se cargaron N ...`) o el toast rojo con el error exacto.

Todos los archivos también pueden **descargarse** desde el mismo modal ("Descargar JSON") — útil como plantilla con datos reales.

---

## 3. Formatos y restricciones

### Reglas generales (aplican a los 4 formatos)

- Archivo **UTF-8** válido con extensión `.json`. Si el JSON está malformado → error `"Archivo JSON invalido"`.
- Los nombres se comparan **sin distinguir mayúsculas/minúsculas** y se recortan espacios al inicio/fin.
- Se acepta un **array plano en la raíz** o un objeto con la clave envolvente (`{"unidades": [...]}`, `{"platos": [...]}`, etc.).
- Las importaciones de unidades, etiquetas e ingredientes son **destructivas (reemplazo total)**; la de platos es **acumulativa (upsert)**. Ver detalle en cada formato.
- Después de importar, los cambios se propagan a los demás dispositivos sincronizados.

---

### 3.1 Unidades — `unidades-AAAA-MM-DD.json`

**Comportamiento al importar: REEMPLAZO TOTAL.** Se eliminan todas las unidades actuales y se cargan las del archivo.

```json
[
  "gr",
  "kg",
  "ml",
  "L",
  "unidad",
  "cucharada",
  "cucharadita",
  "taza",
  "lata",
  "pizca"
]
```

También es válido el formato con objetos:

```json
[
  { "nombre": "gr" },
  { "nombre": "kg" }
]
```

**Restricciones:**
- Cada elemento debe ser un string (o un objeto `{ "nombre": string }`).
- Elementos vacíos o solo con espacios se ignoran.
- Duplicados (aunque difieran en mayúsculas/minúsculas) se descartan automáticamente: solo se carga el primero.
- ⚠️ No hay protección: si borras unidades que ingredientes estaban usando **por nombre**, esos ingredientes conservan el texto antiguo de unidad (la unidad del ingrediente es un texto, no un vínculo).

---

### 3.2 Etiquetas — `etiquetas-AAAA-MM-DD.json`

**Comportamiento al importar: REEMPLAZO TOTAL con protección.** Se eliminan las etiquetas actuales y se cargan las del archivo, **excepto** si alguna etiqueta está siendo usada por platos y falta en el archivo → en ese caso **no se importa nada** y se muestra error.

```json
[
  "nutritivo",
  "gustos",
  "rapido",
  "economico",
  "vegetariano",
  "postre"
]
```

También es válido `[ { "nombre": "nutritivo" }, ... ]`.

**Restricciones:**
- Cada elemento debe ser un string (o `{ "nombre": string }`).
- Duplicados case-insensitive se descartan; vacíos se ignoran.
- ⚠️ **Protección:** si un plato usa la etiqueta "gustos" y el archivo no incluye "gustos", la importación se cancela con el error:
  `No se puede importar: la etiqueta "gustos" esta siendo usada por platos y no esta en el archivo`
- Las etiquetas que coinciden por nombre **conservan su identidad** (no se rompen los vínculos con los platos).

---

### 3.3 Ingredientes — `ingredientes-AAAA-MM-DD.json`

**Comportamiento al importar: REEMPLAZO TOTAL con protección.** Igual que etiquetas: si un ingrediente usado por algún plato falta en el archivo, **no se importa nada**.

```json
[
  { "nombre": "Arroz", "unidad": "kg" },
  { "nombre": "Pollo", "unidad": "kg" },
  { "nombre": "Sal", "unidad": "gr" },
  { "nombre": "Aceite", "unidad": "ml" },
  { "nombre": "Huevos", "unidad": "unidad" },
  { "nombre": "Leche", "unidad": "ml" },
  { "nombre": "Tomate", "unidad": "unidad" },
  { "nombre": "Cebolla", "unidad": "unidad" },
  { "nombre": "Ajo", "unidad": "diente" },
  { "nombre": "Queso", "unidad": "gr" }
]
```

**Restricciones:**
- Formato por elemento: `{ "nombre": string, "unidad": string }`.
  - También se acepta un string simple (`"Arroz"`) → la unidad queda como `"unidad"` por defecto.
- La unidad **debería existir** en la tabla de unidades (importar unidades primero). Si la unidad no existe, el ingrediente se crea igual, pero al crear **platos** con esa unidad el import fallará.
- ⚠️ **Protección:** si el ingrediente "Pollo" está usado por platos y no está en el archivo → error:
  `No se puede importar: el ingrediente "Pollo" esta siendo usado por platos y no esta en el archivo`
- Los ingredientes que coinciden por nombre **conservan su identidad**; si cambia la unidad, se actualiza.

---

### 3.4 Platos (Recetas Completas) — `platos-AAAA-MM-DD.json`

**Comportamiento al importar: UPSERT (no destructivo).** Los platos cuyo nombre coincida (sin mayúsculas) se **actualizan**; los nuevos se **agregan**. Los platos existentes que no estén en el archivo **no se tocan**.

```json
[
  {
    "nombre": "Arroz con pollo",
    "descripcion": "1. Sofreir la cebolla y el ajo.\n2. Agregar el pollo y dorar.\n3. Añadir el arroz y el agua.\n4. Cocinar 20 minutos.",
    "etiquetas": ["nutritivo", "gustos"],
    "ingredientes": [
      { "nombre": "Arroz", "cantidad": 0.5, "unidad": "kg" },
      { "nombre": "Pollo", "cantidad": 1, "unidad": "kg" },
      { "nombre": "Cebolla", "cantidad": 1, "unidad": "unidad" },
      { "nombre": "Ajo", "cantidad": 2, "unidad": "diente" },
      { "nombre": "Sal", "cantidad": 5, "unidad": "gr" }
    ]
  },
  {
    "nombre": "Ensalada fresca",
    "descripcion": "Lavar y cortar todas las verduras. Mezclar y aliñar.",
    "etiquetas": ["nutritivo", "rapido"],
    "ingredientes": [
      { "nombre": "Lechuga", "cantidad": 1, "unidad": "unidad" },
      { "nombre": "Tomate", "cantidad": 2, "unidad": "unidad" },
      { "nombre": "Aceite", "cantidad": 10, "unidad": "ml" }
    ]
  }
]
```

**Restricciones (validación all-or-nothing):**

Si **cualquier** validación falla, **NO se registra NADA** (ni siquiera los platos válidos) y se muestra el error exacto. Validaciones en orden:

| # | Regla | Mensaje de error |
|---|---|---|
| 1 | El archivo debe ser un array con al menos 1 plato | `El archivo no contiene platos validos` |
| 2 | Todo plato necesita `nombre` (texto no vacío) | `Hay un plato sin nombre en el archivo` |
| 3 | Nombres de platos sin duplicados dentro del archivo | `Plato duplicado en el archivo: "X"` |
| 4 | Cada plato necesita ≥ 1 ingrediente | `El plato "X" no tiene ingredientes` |
| 5 | El `nombre` de cada ingrediente **debe existir** en la base de datos | `Ingrediente no encontrado: "X" (plato "Y")` |
| 6 | La `cantidad` debe ser numérica y mayor que 0 | `Cantidad invalida para "X" en el plato "Y"` |
| 7 | La `unidad` **debe existir** en la base de datos | `Unidad no encontrada: "X" (plato "Y")` |
| 8 | Cada etiqueta (si se incluye) **debe existir** en la base de datos | `Etiqueta no encontrada: "X" (plato "Y")` |

**Detalles importantes para generar el archivo:**

- `cantidad` es un **número** (no texto): `0.5`, no `"1/2 kg"`.
- `descripcion` es el procedimiento paso a paso; usar `\n` para saltos de línea. Opcional (default: `""`).
- `etiquetas` es opcional; si se incluye, sus nombres deben existir previamente (o usar `[]` para platos sin etiquetas).
- El nombre del ingrediente en el archivo debe coincidir con uno existente (ignorando mayúsculas/minúsculas) — la cantidad y unidad del plato son propias del plato, no del ingrediente.

---

## 4. Checklist para una IA que genere estos archivos

1. **Preguntar/considerar el orden**: si el usuario quiere cargar todo desde cero → generar 4 archivos: `unidades`, `ingredientes`, `etiquetas`, `platos` (en ese orden de importación).
2. Unidades: lista simple de strings, sin duplicados.
3. Ingredientes: cada uno con `{nombre, unidad}` donde `unidad` ∈ unidades del archivo 1.
4. Etiquetas: lista simple de strings.
5. Platos: `ingredientes[].nombre` ∈ ingredientes del archivo 2; `ingredientes[].unidad` ∈ unidades del archivo 1; `etiquetas[]` ∈ etiquetas del archivo 3; `cantidad` numérica > 0.
6. Sin tildes problemáticas no importa (UTF-8 ok), pero mantener nombres **consistentes** entre archivos (mejor todo minúsculas o misma capitalización).
7. Si el usuario ya tiene datos, sugerirle primero **"Descargar JSON"** en cada tarjeta y usar esos archivos como base para no perder relaciones.
