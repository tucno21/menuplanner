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
  { "nombre": "Arroz", "unidad": "kg", "nutricion": { "base": 100, "unidadBase": "gr", "calorias": 360, "proteinas": 7, "carbohidratos": 79, "grasas": 0.7, "fibra": 1.3 } },
  { "nombre": "Pollo", "unidad": "kg", "nutricion": { "base": 100, "unidadBase": "gr", "calorias": 165, "proteinas": 31, "carbohidratos": 0, "grasas": 3.6, "fibra": 0 } },
  { "nombre": "Huevos", "unidad": "unidad", "nutricion": { "base": 1, "unidadBase": "unidad", "calorias": 70, "proteinas": 6, "carbohidratos": 0.5, "grasas": 5, "fibra": 0 } },
  { "nombre": "Leche", "unidad": "ml", "nutricion": { "base": 100, "unidadBase": "ml", "calorias": 60, "proteinas": 3, "carbohidratos": 5, "grasas": 3, "fibra": 0 } },
  { "nombre": "Tomate", "unidad": "unidad" },
  { "nombre": "Cebolla", "unidad": "unidad" }
]
```

**Sobre `nutricion` (OPCIONAL):**

- Los JSON antiguos sin `nutricion` siguen siendo 100% validos (como "Tomate" y "Cebolla" arriba).
- Sirve para el **calculo nutricional automatico de los platos**: la app multiplica la cantidad usada en cada receta (convertida a la unidad base) por estos valores.
- `base`: cantidad de referencia (numero > 0). Lo normal es `100`.
- `unidadBase`: a que se refiere la base. Solo se aceptan **`"gr"`, `"ml"` o `"unidad"`** (acepta `"g"` como alias de `"gr"`).
  - Solidos: `base: 100, unidadBase: "gr"` (valores por 100 g).
  - Liquidos: `base: 100, unidadBase: "ml"` (valores por 100 ml).
  - Piezas: `base: 1, unidadBase: "unidad"` (valores por unidad: huevo, pan, lata...).
- `calorias` = kcal; `proteinas`, `carbohidratos`, `grasas` y `fibra` = gramos. Unidades NO se escriben como texto.
- Campos faltantes de los 5 valores se completan con `0`. Valores negativos o no numericos rechazan TODO el import (all-or-nothing).
- La app convierte automaticamente: 1 kg = 1000 gr, 1 L = 1000 ml (tambien libra y onza). Unidades no convertibles (taza, lata, cucharada...) solo funcionan si `unidadBase` es esa misma unidad — **nunca se inventan conversiones**.
- Para diferenciar crudo/cocido (Arroz crudo vs Arroz cocido), crear **ingredientes separados** con su propia nutricion y elegir el correcto en cada receta.

**Restricciones:**
- Formato por elemento: `{ "nombre": string, "unidad": string, "nutricion"?: {...} }`.
  - También se acepta un string simple (`"Arroz"`) → la unidad queda como `"unidad"` por defecto.
- La unidad **debería existir** en la tabla de unidades (importar unidades primero). Si la unidad no existe, el ingrediente se crea igual, pero al crear **platos** con esa unidad el import fallará.
- `nutricion` (si se incluye) se valida: `base` número > 0, `unidadBase` ∈ {gr, ml, unidad}, valores numéricos ≥ 0. Si cualquier nutricion del archivo es invalida, **no se importa nada**.
- ⚠️ **Protección:** si el ingrediente "Pollo" está usado por platos y no está en el archivo → error:
  `No se puede importar: el ingrediente "Pollo" esta siendo usado por platos y no esta en el archivo`
- Los ingredientes que coinciden por nombre **conservan su identidad**; si cambia la unidad o la nutricion, se actualizan. Si el ingrediente existia con nutricion y en el archivo no la trae, se **elimina** su nutricion (el archivo es la fuente de verdad).

---

### 3.4 Platos (Recetas Completas) — `platos-AAAA-MM-DD.json`

**Comportamiento al importar: UPSERT (no destructivo).** Los platos cuyo nombre coincida (sin mayúsculas) se **actualizan**; los nuevos se **agregan**. Los platos existentes que no estén en el archivo **no se tocan**.

```json
[
  {
    "nombre": "Pollo al horno con papa y verduras",
    "descripcion": "1. Sazonar el pollo.\n2. Hornear 40 minutos a 200°C.\n3. Servir con papa y verduras.",
    "etiquetas": ["nutritivo", "gustos"],
    "porciones": 4,
    "nutricion": {
      "calorias": 450,
      "proteinas": 35,
      "carbohidratos": 42,
      "grasas": 14,
      "fibra": 8
    },
    "ingredientes": [
      { "nombre": "Pollo", "cantidad": 600, "unidad": "gr" },
      { "nombre": "Papa", "cantidad": 500, "unidad": "gr" },
      { "nombre": "Zanahoria", "cantidad": 200, "unidad": "gr" },
      { "nombre": "Brocoli", "cantidad": 300, "unidad": "unidad" },
      { "nombre": "Aceite", "cantidad": 20, "unidad": "ml" }
    ]
  },
  {
    "nombre": "Arroz con pollo",
    "descripcion": "1. Sofreir la cebolla y el ajo.\n2. Agregar el pollo y dorar.\n3. Añadir el arroz y el agua.\n4. Cocinar 20 minutos.",
    "etiquetas": ["nutritivo"],
    "ingredientes": [
      { "nombre": "Arroz", "cantidad": 0.5, "unidad": "kg" },
      { "nombre": "Pollo", "cantidad": 1, "unidad": "kg" },
      { "nombre": "Cebolla", "cantidad": 1, "unidad": "unidad" },
      { "nombre": "Sal", "cantidad": 5, "unidad": "gr" }
    ]
  }
]
```

**Sobre `porciones` y `nutricion` (ambos OPCIONALES):**

- Los JSON antiguos sin estos campos siguen siendo 100% validos — un plato sin nutricion funciona igual que siempre.
- `porciones`: entero > 0 (numero de porciones que rinde la receta).
- `nutricion` (si se incluye): objeto con las 5 claves. **Unidades fijas**: `calorias` = kcal; `proteinas`, `carbohidratos`, `grasas` y `fibra` = gramos. No se escriben unidades como texto.
- Si `nutricion` viene **parcial** (ej: solo `calorias`), los campos faltantes se completan con `0` — no es error.
- Los valores nutricionales representan **POR PORCION** (la app los muestra como "valores por porcion").
- Si `nutricion` viene con todos los campos vacios, se ignora (plato sin nutricion).

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
| 9 | `porciones`, si se incluye, debe ser número > 0 | `Valor invalido de porciones en el plato "X"` |
| 10 | `nutricion`, si se incluye, debe ser un objeto (no array ni texto) | `Valor invalido de nutricion en el plato "X"` |
| 11 | Cada campo de `nutricion` debe ser número ≥ 0 (vacíos → 0) | `Valor invalido de calorias/proteinas/carbohidratos/grasas/fibra en el plato "X"` |

**Detalles importantes para generar el archivo:**

- `cantidad` es un **número** (no texto): `0.5`, no `"1/2 kg"`.
- `descripcion` es el procedimiento paso a paso; usar `\n` para saltos de línea. Opcional (default: `""`).
- `etiquetas` es opcional; si se incluye, sus nombres deben existir previamente (o usar `[]` para platos sin etiquetas).
- `porciones` y `nutricion` son opcionales; incluirlos solo cuando se conozcan valores reales (nunca inventar valores nutricionales). Si los ingredientes tienen `nutricion`, la app calcula el plato automaticamente y estos campos manuales solo se usan como fallback.
- El nombre del ingrediente en el archivo debe coincidir con uno existente (ignorando mayúsculas/minúsculas) — la cantidad y unidad del plato son propias del plato, no del ingrediente.

---

## 4. Checklist para una IA que genere estos archivos

1. **Preguntar/considerar el orden**: si el usuario quiere cargar todo desde cero → generar 4 archivos: `unidades`, `ingredientes`, `etiquetas`, `platos` (en ese orden de importación).
2. Unidades: lista simple de strings, sin duplicados.
3. Ingredientes: cada uno con `{nombre, unidad}` y opcionalmente `nutricion` (por 100 gr / 100 ml / unidad). Incluir `nutricion` SIEMPRE que se conozcan valores reales: habilita el calculo nutricional automatico de los platos. La `unidad` ∈ unidades del archivo 1.
4. Etiquetas: lista simple de strings.
5. Platos: `ingredientes[].nombre` ∈ ingredientes del archivo 2; `ingredientes[].unidad` ∈ unidades del archivo 1; `etiquetas[]` ∈ etiquetas del archivo 3; `cantidad` numérica > 0. `porciones`/`nutricion` del plato son OPCIONALES: si los ingredientes tienen `nutricion`, la app **calcula automáticamente** los valores del plato (los del plato solo son un fallback manual para recetas sin datos en ingredientes — no inventarlos).
6. Sin tildes problemáticas no importa (UTF-8 ok), pero mantener nombres **consistentes** entre archivos (mejor todo minúsculas o misma capitalización).
7. Si el usuario ya tiene datos, sugerirle primero **"Descargar JSON"** en cada tarjeta y usar esos archivos como base para no perder relaciones.
