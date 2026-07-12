import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { usePlanificacionStore } from '../../store/planificacionStore'
import type { PlatoWithIngredientes } from '../../store/planificacionStore'
import AlertCustom from '../../components/ui/AlertCustom'

const PlatoDetail = () => {
  const navigate = useNavigate()
  const { platoId } = useParams()

  const getPlatoById = usePlanificacionStore((s) => s.getPlatoById)
  const deletePlato = usePlanificacionStore((s) => s.deletePlato)

  const [plato, setPlato] = useState<PlatoWithIngredientes | null>(null)
  const [openAlert, setOpenAlert] = useState(false)

  const platoIdNum = Number(platoId)

  useEffect(() => {
    const load = async () => {
      if (platoIdNum) {
        const data = await getPlatoById(platoIdNum)
        setPlato(data)
      }
    }
    load()
  }, [platoIdNum, getPlatoById])

  const confirmarEliminar = async () => {
    await deletePlato(platoIdNum)
    setOpenAlert(false)
    navigate(-1)
  }

  if (!plato) {
    return (
      <div className="flex justify-center items-center min-h-full bg-backdrop">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-backdrop min-h-full">
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="bg-white rounded-xl p-6 mb-6 shadow-card">
          <h1 className="text-2xl font-bold text-primary mb-2">{plato.nombre}</h1>
          <div className="h-0.5 bg-indigo-100 w-full mb-4" />

          <h2 className="text-xl font-semibold text-black mb-3">Ingredientes</h2>
          {plato.ingredientes.length === 0 ? (
            <p className="text-gray-500 mb-4">Sin ingredientes</p>
          ) : (
            plato.ingredientes.map((ing) => (
              <div key={ing.id} className="flex items-center mb-2">
                <ChevronRight size={18} className="text-primary" />
                <span className="text-lg ml-3 text-gray-700">
                  {ing.nombre} - {ing.cantidad} {ing.unidad}
                </span>
              </div>
            ))
          )}

          <h2 className="text-xl font-semibold text-black mb-3 mt-4">Procedimiento</h2>
          <p className="text-lg text-gray-700 leading-relaxed">{plato.descripcion}</p>
        </div>
      </div>

      <div className="p-4 flex-row justify-around flex">
        <button
          onClick={() => setOpenAlert(true)}
          className="bg-danger rounded-full py-3 px-6 flex-1 mr-2 text-light text-lg font-semibold"
        >
          Eliminar
        </button>
        <button
          onClick={() => navigate(`/platos/actualizar-plato/${platoIdNum}`)}
          className="bg-success rounded-full py-3 px-6 flex-1 ml-2 text-light text-lg font-semibold"
        >
          Actualizar
        </button>
      </div>

      <AlertCustom
        isAlert={openAlert}
        title="¿Desea eliminar el plato?"
        onConfirm={confirmarEliminar}
        onClose={() => setOpenAlert(false)}
      />
    </div>
  )
}

export default PlatoDetail
