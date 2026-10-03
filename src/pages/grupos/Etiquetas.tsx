import { useState, useEffect } from 'react'
import { Tag, Pencil, Trash2 } from 'lucide-react'
import { usePlanificacionStore } from '../../store/planificacionStore'
import BackButton from '../../components/ui/BackButton'
import Modal from '../../components/ui/Modal'
import AlertCustom from '../../components/ui/AlertCustom'

const Etiquetas = () => {

  const etiquetas = usePlanificacionStore((s) => s.etiquetas)
  const loadEtiquetas = usePlanificacionStore((s) => s.loadEtiquetas)
  const createEtiqueta = usePlanificacionStore((s) => s.createEtiqueta)
  const updateEtiqueta = usePlanificacionStore((s) => s.updateEtiqueta)
  const deleteEtiqueta = usePlanificacionStore((s) => s.deleteEtiqueta)

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [showAlert, setShowAlert] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  useEffect(() => {
    loadEtiquetas()
  }, [loadEtiquetas])

  const filteredEtiquetas = etiquetas.filter((e) =>
    e.nombre.toLowerCase().includes(searchQuery.toLowerCase())
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
      await updateEtiqueta(editingId, { nombre: formNombre })
    } else {
      await createEtiqueta({ nombre: formNombre })
    }
    setShowModal(false)
  }

  const openDelete = (id: number) => {
    setDeleteTargetId(id)
    setShowAlert(true)
  }

  const confirmDelete = async () => {
    if (deleteTargetId !== null) {
      await deleteEtiqueta(deleteTargetId)
    }
    setShowAlert(false)
    setDeleteTargetId(null)
  }

  return (
    <div className="flex flex-col flex-1 px-5 pt-3 pb-3 bg-backdrop min-h-full">
      <div className="flex items-center gap-3 mb-4">
        <BackButton />
        <h1 className="text-xl sm:text-2xl font-bold text-primary">Etiquetas de Platos</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
        <input
          type="text"
          placeholder="Buscar etiquetas"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-white text-black text-center p-2 rounded-lg border border-primary-light outline-none"
        />

        <button
          onClick={openCreate}
          className="w-full sm:w-auto bg-primary rounded-lg py-2.5 px-5 text-light text-sm font-semibold active:scale-95 transition-all shrink-0"
        >
          + Agregar Etiqueta
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredEtiquetas.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay etiquetas</p>
        ) : (
          filteredEtiquetas.map((e) => (
            <div
              key={e.id}
              className="flex flex-row items-center justify-between mb-2 bg-white p-3 rounded-lg border border-primary"
            >
              <div className="flex flex-row items-center gap-3 flex-1">
                <div className="bg-secondary rounded-full p-2">
                  <Tag size={20} className="text-light" />
                </div>
                <span className="text-lg text-dark font-medium">{e.nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(e.id!, e.nombre)}
                  className="bg-info/20 p-2 rounded-full">
                  <Pencil size={18} className="text-info" />
                </button>
                <button onClick={() => openDelete(e.id!)}
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
            {editingId !== null ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
          </h2>

          <input
            type="text"
            placeholder="Nombre de la etiqueta (ej: nutritivo)"
            value={formNombre}
            onChange={(e) => setFormNombre(e.target.value)}
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-4 border border-gray-300 outline-none text-dark"
          />

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
        title="¿Eliminar esta etiqueta? Se quitara de los platos que la usan."
        onConfirm={confirmDelete}
        onClose={() => setShowAlert(false)}
      />
    </div>
  )
}

export default Etiquetas
