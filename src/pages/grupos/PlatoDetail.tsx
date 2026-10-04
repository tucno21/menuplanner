import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Tag } from 'lucide-react'
import { usePlanificacionStore } from '../../store/planificacionStore'
import type { PlatoWithIngredientes } from '../../store/planificacionStore'
import { calcularNutricionReceta } from '../../utils/calcularNutricion'
import BackButton from '../../components/ui/BackButton'
import AlertCustom from '../../components/ui/AlertCustom'
import PanelNutricionCalculada from '../../components/ui/PanelNutricionCalculada'

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

  // Cálculo dinámico a partir de los ingredientes; el valor manual del plato es solo fallback
  const calculoNutricion = calcularNutricionReceta(
    plato.ingredientes.map((ing) => ({
      nombre: ing.nombre,
      cantidad: Number(ing.cantidad) || 0,
      unidad: ing.unidad,
      nutricion: ing.nutricion ?? null,
      pesoPorUnidad: ing.pesoPorUnidad ?? null,
    })),
    plato.porciones
  )
  const mostrarCalculo = calculoNutricion.estado !== 'sin-informacion'

  return (
    <div className="flex flex-col flex-1 bg-backdrop min-h-full">
      <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton />
          <h1 className="text-xl sm:text-2xl font-bold text-primary truncate">{plato.nombre}</h1>
        </div>

        {plato.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {plato.etiquetas.map((etq) => (
              <span
                key={etq.id}
                className="flex items-center gap-1 bg-secondary/10 border border-secondary/30 text-secondary px-3 py-1 rounded-full text-xs font-medium"
              >
                <Tag size={12} />
                {etq.nombre}
              </span>
            ))}
          </div>
        )}

        {mostrarCalculo ? (
          <div className="mb-4">
            <PanelNutricionCalculada calculo={calculoNutricion} />
            {plato.porciones !== undefined && (
              <p className="text-sm text-gray-500 mt-2">
                Receta para {plato.porciones} {plato.porciones === 1 ? 'porcion' : 'porciones'}
              </p>
            )}
          </div>
        ) : (plato.porciones !== undefined || plato.nutricion) && (
          <div className="bg-white rounded-xl p-4 sm:p-6 mb-4 shadow-card">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block" />
              Informacion nutricional
            </h2>

            {plato.porciones !== undefined && (
              <p className="text-sm text-gray-500 mb-3">
                Receta para {plato.porciones} {plato.porciones === 1 ? 'porcion' : 'porciones'}
              </p>
            )}

            {plato.nutricion && (
              <ul className="space-y-1.5 text-sm sm:text-base text-gray-700">
                <li>🔥 {plato.nutricion.calorias} kcal</li>
                <li>🥩 {plato.nutricion.proteinas} g proteinas</li>
                <li>🍚 {plato.nutricion.carbohidratos} g carbohidratos</li>
                <li>🥑 {plato.nutricion.grasas} g grasas</li>
                <li>🌱 {plato.nutricion.fibra} g fibra</li>
              </ul>
            )}

            {plato.porciones !== undefined && plato.nutricion && (
              <p className="text-xs text-gray-400 mt-3">Valores por porcion</p>
            )}

            {plato.nutricion && (
              <p className="text-[11px] text-gray-400 mt-1">Valores manuales. Agrega informacion nutricional a los ingredientes para calcular automaticamente.</p>
            )}
          </div>
        )}

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
          className="flex-1 bg-danger rounded-lg py-3 text-light text-sm sm:text-base font-semibold active:scale-95 transition-all"
        >
          Eliminar
        </button>
        <button
          onClick={() => navigate(`/platos/actualizar-plato/${platoIdNum}`)}
          className="flex-1 bg-success rounded-lg py-3 text-light text-sm sm:text-base font-semibold active:scale-95 transition-all"
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
