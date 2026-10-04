import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Leaf, Pencil, Trash2, Settings2 } from 'lucide-react'
import { coincideBusqueda } from '../utils/busqueda'
import { usePlanificacionStore } from '../store/planificacionStore'
import { useToastStore } from '../store/toastStore'
import Modal from '../components/ui/Modal'
import AlertCustom from '../components/ui/AlertCustom'

const Ingredientes = () => {
  const navigate = useNavigate()

  const ingredientes = usePlanificacionStore((s) => s.ingredientes)
  const unidades = usePlanificacionStore((s) => s.unidades)
  const loadIngredientes = usePlanificacionStore((s) => s.loadIngredientes)
  const createIngrediente = usePlanificacionStore((s) => s.createIngrediente)
  const updateIngrediente = usePlanificacionStore((s) => s.updateIngrediente)
  const deleteIngrediente = usePlanificacionStore((s) => s.deleteIngrediente)
  const addToast = useToastStore((s) => s.addToast)

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formUnidad, setFormUnidad] = useState('')
  const [formPeso, setFormPeso] = useState('')
  const [showAlert, setShowAlert] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  useEffect(() => {
    loadIngredientes()
  }, [loadIngredientes])

  const filteredIngredientes = ingredientes.filter((ing) =>
    coincideBusqueda(ing.nombre, searchQuery)
  )

  const openCreate = () => {
    setEditingId(null)
    setFormNombre('')
    setFormUnidad('')
    setFormPeso('')
    setShowModal(true)
  }

  const openEdit = (id: number, nombre: string, unidad: string, pesoPorUnidad?: number) => {
    setEditingId(id)
    setFormNombre(nombre)
    setFormUnidad(unidad)
    setFormPeso(pesoPorUnidad !== undefined ? String(pesoPorUnidad) : '')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formNombre.trim() || !formUnidad.trim()) return
    // pesoPorUnidad SOLO aplica cuando la unidad es 'unidad'; campo vacio = sin peso
    let peso: number | undefined
    if (formUnidad.trim().toLowerCase() === 'unidad' && formPeso.trim()) {
      const n = Number(formPeso)
      if (!Number.isFinite(n) || n <= 0) {
        addToast('El peso por unidad debe ser un numero mayor a 0', 'warning')
        return
      }
      peso = n
    }
    if (editingId !== null) {
      await updateIngrediente(editingId, { nombre: formNombre, unidad: formUnidad, pesoPorUnidad: peso })
    } else {
      await createIngrediente({ nombre: formNombre, unidad: formUnidad, pesoPorUnidad: peso })
    }
    setShowModal(false)
  }

  const openDelete = (id: number) => {
    setDeleteTargetId(id)
    setShowAlert(true)
  }

  const confirmDelete = async () => {
    if (deleteTargetId !== null) {
      await deleteIngrediente(deleteTargetId)
    }
    setShowAlert(false)
    setDeleteTargetId(null)
  }

  return (
    <div className="flex flex-col flex-1 px-5 pt-3 pb-3 bg-backdrop min-h-full">
      <div className="flex flex-row items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-primary">Mis Ingredientes</h1>
        <button
          onClick={() => navigate('/ingredientes/unidades')}
          className="flex items-center gap-1 bg-secondary px-3 py-2 rounded-lg text-light text-sm font-medium"
        >
          <Settings2 size={16} />
          Unidades
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
        <input
          type="text"
          placeholder="Buscar ingredientes"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-white text-black text-center p-2 rounded-lg border border-primary-light outline-none"
        />

        <button
          onClick={openCreate}
          className="w-full sm:w-auto bg-primary rounded-lg py-2.5 px-5 text-light text-sm font-semibold active:scale-95 transition-all shrink-0"
        >
          + Agregar Ingrediente
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredIngredientes.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay ingredientes</p>
        ) : (
          filteredIngredientes.map((ing) => (
            <div
              key={ing.id}
              className="flex flex-row items-center justify-between mb-2 bg-white p-3 rounded-lg border border-primary"
            >
              <div className="flex flex-row items-center gap-3 flex-1">
                <div className="bg-primary rounded-full p-2">
                  <Leaf size={20} className="text-light" />
                </div>
                <div>
                  <span className="text-lg text-dark font-medium">{ing.nombre}</span>
                  {ing.pesoPorUnidad !== undefined && (
                    <p className="text-xs text-gray-400">1 unidad ≈ {ing.pesoPorUnidad} g</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 mr-2">{ing.unidad}</span>
                <button onClick={() => openEdit(ing.id!, ing.nombre, ing.unidad, ing.pesoPorUnidad)}
                  className="bg-info/20 p-2 rounded-full">
                  <Pencil size={18} className="text-info" />
                </button>
                <button onClick={() => openDelete(ing.id!)}
                  className="bg-danger/20 p-2 rounded-full">
                  <Trash2 size={18} className="text-danger" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="bg-white rounded-2xl p-6 w-11/12 max-w-md mx-auto">
          <h2 className="text-xl font-bold text-primary mb-4 text-center">
            {editingId !== null ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
          </h2>

          <input
            type="text"
            placeholder="Nombre"
            value={formNombre}
            onChange={(e) => setFormNombre(e.target.value)}
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          />

          <select
            value={formUnidad}
            onChange={(e) => setFormUnidad(e.target.value)}
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          >
            <option value="">Seleccionar unidad</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nombre}>{u.nombre}</option>
            ))}
          </select>

          {formUnidad.trim().toLowerCase() === 'unidad' && (
            <div className="mb-4">
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="Peso aproximado por unidad (g)"
                value={formPeso}
                onChange={(e) => setFormPeso(e.target.value)}
                className="bg-gray-100 rounded-lg px-4 py-3 w-full border border-gray-300 outline-none text-dark"
              />
              <p className="text-[11px] text-gray-400 mt-1">Opcional. Ej: Brocoli = 600. Se usa solo para el calculo nutricional.</p>
            </div>
          )}

          <div className="flex flex-row gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 bg-gray-300 py-3 rounded-lg text-gray-700 font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-primary py-3 rounded-lg text-light font-semibold"
            >
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      <AlertCustom
        isAlert={showAlert}
        title="¿Eliminar este ingrediente?"
        onConfirm={confirmDelete}
        onClose={() => setShowAlert(false)}
      />
    </div>
  )
}

export default Ingredientes
