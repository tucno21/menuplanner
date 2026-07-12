import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Trash2, Salad } from 'lucide-react'
import { usePlanificacionStore } from '../../store/planificacionStore'
import Modal from '../../components/ui/Modal'

interface IngredienteSeleccionado {
  id: number
  nombre: string
  unidad: string
  cantidad: string
}

const CrearPlato = () => {
  const navigate = useNavigate()

  const ingredientes = usePlanificacionStore((s) => s.ingredientes)
  const loadIngredientes = usePlanificacionStore((s) => s.loadIngredientes)
  const createPlato = usePlanificacionStore((s) => s.createPlato)

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [selectedIngredientes, setSelectedIngredientes] = useState<IngredienteSeleccionado[]>([])
  const [showModal, setShowModal] = useState(false)
  const [searchIngredientes, setSearchIngredientes] = useState('')

  useEffect(() => {
    loadIngredientes()
  }, [loadIngredientes])

  const filteredIngredientes = ingredientes.filter((ing) =>
    ing.nombre.toLowerCase().includes(searchIngredientes.toLowerCase())
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

  const handleGuardar = async () => {
    if (!nombre.trim() || !descripcion.trim() || selectedIngredientes.length === 0) return
    if (selectedIngredientes.some((i) => !i.cantidad || Number(i.cantidad) <= 0)) return

    await createPlato({
      nombre,
      descripcion,
      ingredientes: selectedIngredientes.map((i) => ({ id: i.id, cantidad: Number(i.cantidad) })),
    })
    navigate(-1)
  }

  return (
    <div className="flex flex-col flex-1 bg-backdrop min-h-full">
      <div className="flex-1 px-4 py-2">
        <h1 className="text-center text-2xl font-bold text-primary mb-2">Agregar Un plato</h1>

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

        <button
          onClick={() => setShowModal(true)}
          className="bg-primary py-3 rounded-lg mb-3 w-full text-light text-lg font-semibold text-center"
        >
          Agregar Ingredientes
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
                  className="bg-danger/20 p-2 rounded-full"
                >
                  <Trash2 size={24} className="text-danger" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 flex flex-row justify-between">
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-300 py-3 px-6 rounded-full flex-1 mr-2 text-gray-700 text-lg font-semibold"
        >
          Regresar
        </button>
        <button
          onClick={handleGuardar}
          className="bg-primary py-3 px-6 rounded-full flex-1 ml-2 text-light text-lg font-semibold"
        >
          Guardar
        </button>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="bg-white px-4 py-6 max-h-[90vh] rounded-2xl flex flex-col overflow-hidden">
          <input
            type="text"
            placeholder="Buscar ingredientes"
            value={searchIngredientes}
            onChange={(e) => setSearchIngredientes(e.target.value)}
            className="bg-gray-100 text-sm mb-3 text-gray-800 p-2 rounded-lg border border-secondary-light w-full outline-none"
          />

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
            onClick={() => setShowModal(false)}
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
