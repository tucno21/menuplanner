import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Ruler, Pencil, Trash2 } from 'lucide-react'
import { usePlanificacionStore } from '../store/planificacionStore'
import Modal from '../components/ui/Modal'
import AlertCustom from '../components/ui/AlertCustom'

const Unidades = () => {
  const navigate = useNavigate()

  const unidades = usePlanificacionStore((s) => s.unidades)
  const loadUnidades = usePlanificacionStore((s) => s.loadUnidades)
  const createUnidad = usePlanificacionStore((s) => s.createUnidad)
  const updateUnidad = usePlanificacionStore((s) => s.updateUnidad)
  const deleteUnidad = usePlanificacionStore((s) => s.deleteUnidad)

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [showAlert, setShowAlert] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  useEffect(() => {
    loadUnidades()
  }, [loadUnidades])

  const filteredUnidades = unidades.filter((u) =>
    u.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openCreate = () => {
    setEditingId(null)
    setFormNombre('')
    setShowModal(true)
  }

  const openEdit = (id: number, nombre: string) => {
    setEditingId(id)
    setFormNombre(nombre)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formNombre.trim()) return
    if (editingId !== null) {
      await updateUnidad(editingId, { nombre: formNombre })
    } else {
      await createUnidad({ nombre: formNombre })
    }
    setShowModal(false)
  }

  const openDelete = (id: number) => {
    setDeleteTargetId(id)
    setShowAlert(true)
  }

  const confirmDelete = async () => {
    if (deleteTargetId !== null) {
      await deleteUnidad(deleteTargetId)
    }
    setShowAlert(false)
    setDeleteTargetId(null)
  }

  return (
    <div className="flex flex-col flex-1 px-5 pt-5 pb-5 bg-backdrop min-h-full">
      <div className="flex flex-row items-center mb-6">
        <button onClick={() => navigate(-1)} className="p-1">
          <ChevronLeft size={28} className="text-secondary" />
        </button>
        <h1 className="flex-1 text-center text-2xl font-bold text-primary">Tipos de Unidades</h1>
      </div>

      <input
        type="text"
        placeholder="Buscar unidades"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="bg-white text-lg text-black text-center p-3 rounded-lg border border-primary-light mb-4 outline-none"
      />

      <div className="flex-1 overflow-y-auto">
        {filteredUnidades.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay unidades</p>
        ) : (
          filteredUnidades.map((u) => (
            <div
              key={u.id}
              className="flex flex-row items-center justify-between mb-2 bg-white p-3 rounded-lg border border-primary"
            >
              <div className="flex flex-row items-center gap-3 flex-1">
                <div className="bg-secondary rounded-full p-2">
                  <Ruler size={20} className="text-light" />
                </div>
                <span className="text-lg text-dark font-medium">{u.nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(u.id!, u.nombre)}
                  className="bg-info/20 p-2 rounded-full"
                >
                  <Pencil size={18} className="text-info" />
                </button>
                <button
                  onClick={() => openDelete(u.id!)}
                  className="bg-danger/20 p-2 rounded-full"
                >
                  <Trash2 size={18} className="text-danger" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={openCreate}
        className="bg-primary rounded-full py-3 px-6 text-light text-lg font-semibold shadow-card mt-4"
      >
        Agregar Unidad
      </button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
          <h2 className="text-xl font-bold text-primary mb-4 text-center">
            {editingId !== null ? 'Editar Unidad' : 'Nueva Unidad'}
          </h2>

          <input
            type="text"
            placeholder="Nombre de la unidad (ej: gr, ml, kg)"
            value={formNombre}
            onChange={(e) => setFormNombre(e.target.value)}
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-4 border border-gray-300 outline-none text-dark"
          />

          <div className="flex flex-row gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 bg-gray-300 py-3 rounded-full text-gray-700 font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-primary py-3 rounded-full text-light font-semibold"
            >
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      <AlertCustom
        isAlert={showAlert}
        title="¿Eliminar esta unidad?"
        onConfirm={confirmDelete}
        onClose={() => setShowAlert(false)}
      />
    </div>
  )
}

export default Unidades
