import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Trash2, Salad, X, Tag, Flame } from 'lucide-react'
import { usePlanificacionStore } from '../../store/planificacionStore'
import { coincideBusqueda } from '../../utils/busqueda'
import { useToastStore } from '../../store/toastStore'
import type { Nutricion, NutricionKey } from '../../utils/nutricion'
import { calcularNutricionReceta } from '../../utils/calcularNutricion'
import BackButton from '../../components/ui/BackButton'
import Modal from '../../components/ui/Modal'
import PanelNutricionCalculada from '../../components/ui/PanelNutricionCalculada'

interface IngredienteSeleccionado {
  id: number
  nombre: string
  unidad: string
  cantidad: string
}

interface NutricionForm {
  porciones: string
  calorias: string
  proteinas: string
  carbohidratos: string
  grasas: string
  fibra: string
}

const NUTRICION_FORM_VACIO: NutricionForm = {
  porciones: '',
  calorias: '',
  proteinas: '',
  carbohidratos: '',
  grasas: '',
  fibra: '',
}

const CAMPOS_NUTRICION: { key: NutricionKey; label: string }[] = [
  { key: 'calorias', label: 'Calorias (kcal)' },
  { key: 'proteinas', label: 'Proteinas (g)' },
  { key: 'carbohidratos', label: 'Carbohidratos (g)' },
  { key: 'grasas', label: 'Grasas (g)' },
  { key: 'fibra', label: 'Fibra (g)' },
]

const CrearPlato = () => {
  const navigate = useNavigate()

  const ingredientes = usePlanificacionStore((s) => s.ingredientes)
  const loadIngredientes = usePlanificacionStore((s) => s.loadIngredientes)
  const etiquetas = usePlanificacionStore((s) => s.etiquetas)
  const loadEtiquetas = usePlanificacionStore((s) => s.loadEtiquetas)
  const createPlato = usePlanificacionStore((s) => s.createPlato)
  const addToast = useToastStore((s) => s.addToast)

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [selectedIngredientes, setSelectedIngredientes] = useState<IngredienteSeleccionado[]>([])
  const [selectedEtiquetas, setSelectedEtiquetas] = useState<number[]>([])
  const [nutricionForm, setNutricionForm] = useState<NutricionForm>(NUTRICION_FORM_VACIO)
  const [showModal, setShowModal] = useState(false)
  const [searchIngredientes, setSearchIngredientes] = useState('')

  useEffect(() => {
    loadIngredientes()
    loadEtiquetas()
  }, [loadIngredientes, loadEtiquetas])

  const filteredIngredientes = ingredientes.filter((ing) =>
    coincideBusqueda(ing.nombre, searchIngredientes)
  )

  // Cálculo nutricional en vivo: se recalcula al cambiar ingredientes, cantidades o porciones
  const mapaNutricionIng = new Map(ingredientes.map((i) => [i.id as number, i.nutricion ?? null]))
  const calculoNutricion = calcularNutricionReceta(
    selectedIngredientes.map((sel) => ({
      nombre: sel.nombre,
      cantidad: Number(sel.cantidad) || 0,
      unidad: sel.unidad,
      nutricion: mapaNutricionIng.get(sel.id) ?? null,
    })),
    nutricionForm.porciones.trim() ? Number(nutricionForm.porciones) : undefined
  )

  const isIngredienteSelected = (id: number) =>
    selectedIngredientes.some((i) => i.id === id)

  const toggleIngrediente = (id: number, nombre: string, unidad: string) => {
    if (isIngredienteSelected(id)) {
      setSelectedIngredientes(selectedIngredientes.filter((i) => i.id !== id))
    } else {
      setSelectedIngredientes([...selectedIngredientes, { id, nombre, unidad, cantidad: '' }])
    }
  }

  const updateCantidad = (id: number, cantidad: string) => {
    if (cantidad.startsWith('-')) return
    setSelectedIngredientes(
      selectedIngredientes.map((i) => (i.id === id ? { ...i, cantidad } : i))
    )
  }

  const removeIngrediente = (id: number) => {
    setSelectedIngredientes(selectedIngredientes.filter((i) => i.id !== id))
  }

  const toggleEtiqueta = (id: number) => {
    setSelectedEtiquetas(
      selectedEtiquetas.includes(id)
        ? selectedEtiquetas.filter((e) => e !== id)
        : [...selectedEtiquetas, id]
    )
  }

  // Devuelve porciones/nutricion para guardar, o un string con el error de validacion
  const construirNutricion = (): { porciones?: number; nutricion?: Nutricion } | string => {
    const porcStr = nutricionForm.porciones.trim()
    let porciones: number | undefined
    if (porcStr) {
      const n = Number(porcStr)
      if (!Number.isFinite(n) || n <= 0) return 'Las porciones deben ser un numero mayor a 0'
      porciones = n
    }
    const conDatos = CAMPOS_NUTRICION.some((c) => nutricionForm[c.key].trim() !== '')
    if (!conDatos) return { porciones }
    const nutricion: Nutricion = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
    for (const { key } of CAMPOS_NUTRICION) {
      const s = nutricionForm[key].trim()
      if (!s) continue
      const n = Number(s)
      if (!Number.isFinite(n) || n < 0) return 'Los valores nutricionales deben ser numeros mayores o iguales a 0'
      nutricion[key] = n
    }
    return { porciones, nutricion }
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      addToast('El nombre del plato es obligatorio', 'warning')
      return
    }
    if (!descripcion.trim()) {
      addToast('La descripcion del plato es obligatoria', 'warning')
      return
    }
    if (selectedIngredientes.length === 0) {
      addToast('Debe seleccionar al menos un ingrediente', 'warning')
      return
    }
    if (selectedIngredientes.some((i) => !i.cantidad || Number(i.cantidad) <= 0)) {
      addToast('Todos los ingredientes deben tener una cantidad valida', 'warning')
      return
    }

    const nutri = construirNutricion()
    if (typeof nutri === 'string') {
      addToast(nutri, 'warning')
      return
    }

    await createPlato({
      nombre,
      descripcion,
      ingredientes: selectedIngredientes.map((i) => ({ id: i.id, cantidad: Number(i.cantidad) })),
      etiquetas: selectedEtiquetas,
      porciones: nutri.porciones,
      nutricion: nutri.nutricion,
    })
    addToast('Plato creado correctamente', 'success')
    navigate(-1)
  }

  return (
    <div className="flex flex-col flex-1 bg-backdrop min-h-full">
      <div className="flex-1 px-4 py-2">
        <div className="flex items-center gap-3 mb-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-primary">Agregar Un plato</h1>
        </div>

        <input
          type="text"
          placeholder="Nombre del plato"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="bg-gray-100 text-lg mb-4 text-dark p-2 rounded-lg border border-primary-light w-full outline-none"
        />

        <textarea
          placeholder="Descripcion / Procedimiento"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="bg-gray-100 text-lg mb-4 text-dark p-2 rounded-lg border border-primary-light w-full outline-none min-h-[100px] resize-none"
        />

        <div className="bg-white rounded-xl p-4 shadow-card mb-4">
          <h2 className="text-base font-bold mb-0.5 text-dark flex items-center gap-1.5">
            <Flame size={16} className="text-primary" />
            Informacion nutricional
          </h2>
          <p className="text-xs text-gray-400 mb-3">Valores por porcion (opcional). Se usan solo si los ingredientes no tienen datos.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Porciones</label>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={nutricionForm.porciones}
                onChange={(e) => setNutricionForm({ ...nutricionForm, porciones: e.target.value })}
                className="bg-gray-100 text-dark text-sm p-2 rounded-lg border border-gray-300 w-full outline-none"
                placeholder="0"
              />
            </div>
            {CAMPOS_NUTRICION.map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={nutricionForm[key]}
                  onChange={(e) => setNutricionForm({ ...nutricionForm, [key]: e.target.value })}
                  className="bg-gray-100 text-dark text-sm p-2 rounded-lg border border-gray-300 w-full outline-none"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {etiquetas.length > 0 && (
          <div className="mb-4">
            <h2 className="text-base font-bold mb-2 text-dark flex items-center gap-1.5">
              <Tag size={16} className="text-secondary" />
              Etiquetas:
            </h2>
            <div className="flex flex-wrap gap-2">
              {etiquetas.map((etq) => {
                const id = etq.id!
                const selected = selectedEtiquetas.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggleEtiqueta(id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border active:scale-95 transition-all ${selected
                      ? 'bg-secondary border-secondary text-light'
                      : 'bg-white border-gray-300 text-gray-600'
                      }`}
                  >
                    {etq.nombre}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowModal(true)}
          className="border-2 border-primary text-primary py-2.5 rounded-lg mb-3 w-full text-lg font-semibold text-center hover:bg-primary/5 active:scale-95 transition-all"
        >
          + Agregar Ingredientes
        </button>

        <h2 className="text-xl font-bold mb-4 text-dark">Ingredientes seleccionados:</h2>

        {selectedIngredientes.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay ingredientes seleccionados</p>
        ) : (
          selectedIngredientes.map((ing) => (
            <div
              key={ing.id}
              className="flex flex-row items-center justify-between mb-3 pb-2 border-b border-gray-300"
            >
              <span className="text-lg text-gray-600 font-semibold flex-1">{ing.nombre}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.2"
                  value={ing.cantidad}
                  onChange={(e) => updateCantidad(ing.id, e.target.value)}
                  className="bg-white text-center rounded border border-gray-400 w-20 p-1 outline-none"
                  placeholder="0"
                />
                <span className="text-gray-500 text-sm w-16">{ing.unidad}</span>
                <button
                  onClick={() => removeIngrediente(ing.id)}
                  className="bg-danger/20 p-1 rounded-full"
                >
                  <Trash2 size={18} className="text-danger" />
                </button>
              </div>
            </div>
          ))
        )}

        {selectedIngredientes.length > 0 && (
          <div className="mt-4">
            <PanelNutricionCalculada calculo={calculoNutricion} />
          </div>
        )}
      </div>

      <div className="p-4">
        <button
          onClick={handleGuardar}
          className="w-full bg-primary py-3 rounded-lg text-light text-lg font-semibold active:scale-95 transition-all"
        >
          Guardar
        </button>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setSearchIngredientes('') }}>
        <div className="bg-white px-4 py-6 max-h-[90vh] rounded-2xl flex flex-col overflow-hidden">
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Buscar ingredientes"
              value={searchIngredientes}
              onChange={(e) => setSearchIngredientes(e.target.value)}
              className="bg-gray-100 text-sm text-gray-800 p-2 rounded-lg border border-secondary-light w-full outline-none pr-8"
            />
            {searchIngredientes && (
              <button
                onClick={() => setSearchIngredientes('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredIngredientes.map((ing) => {
              const id = ing.id!
              const selected = isIngredienteSelected(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleIngrediente(id, ing.nombre, ing.unidad)}
                  className={`w-full p-3 rounded-lg flex flex-row items-center ${selected
                    ? 'bg-primary-light border border-primary'
                    : 'bg-gray-100 border border-gray-300'
                    }`}
                >
                  <Salad size={20} className="text-gray-700" />
                  <span className="text-lg ml-3 text-gray-800">{ing.nombre}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => { setShowModal(false); setSearchIngredientes('') }}
            className="bg-gray-300 py-3 rounded-lg w-full text-gray-700 text-lg font-semibold mt-4"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default CrearPlato
