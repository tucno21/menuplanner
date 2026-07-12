import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { usePlanificacionStore } from '../../store/planificacionStore'
import type { PlatoWithIngredientes } from '../../store/planificacionStore'
import BackButton from '../../components/ui/BackButton'
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
      <div className="flex flex-col justify-center items-center min-h-full bg-backdrop gap-3 px-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Cargando plato...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-backdrop min-h-full">
      <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton />
          <h1 className="text-xl sm:text-2xl font-bold text-primary truncate">{plato.nombre}</h1>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 mb-4 shadow-card">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full inline-block" />
            Ingredientes
          </h2>

          {plato.ingredientes.length === 0 ? (
            <p className="text-gray-400 text-sm py-2">Sin ingredientes</p>
          ) : (
            <ul className="space-y-1.5">
              {plato.ingredientes.map((ing) => (
                <li key={ing.id} className="flex items-baseline gap-2 text-sm sm:text-base text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                  <span className="font-medium">{ing.nombre}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-gray-500">
                    {ing.cantidad} {ing.unidad}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-card">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full inline-block" />
            Procedimiento
          </h2>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line">
            {plato.descripcion}
          </p>
        </div>
      </div>

      <div className="p-3 sm:p-4 flex flex-row gap-3">
        <button
          onClick={() => setOpenAlert(true)}
          className="flex-1 bg-danger rounded-full py-3 text-light text-sm sm:text-base font-semibold active:scale-95 transition-all"
        >
          Eliminar
        </button>
        <button
          onClick={() => navigate(`/platos/actualizar-plato/${platoIdNum}`)}
          className="flex-1 bg-success rounded-full py-3 text-light text-sm sm:text-base font-semibold active:scale-95 transition-all"
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
