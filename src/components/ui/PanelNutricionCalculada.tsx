import { Flame } from 'lucide-react'
import { formatarNutricional, type ResultadoCalculo } from '../../utils/calcularNutricion'
import type { Nutricion } from '../../utils/nutricion'

const ETIQUETAS_ESTADO: Record<ResultadoCalculo['estado'], string> = {
  calculado: 'Calculado',
  parcial: 'Parcial',
  'sin-informacion': 'Sin informacion',
}

const ESTILOS_ESTADO: Record<ResultadoCalculo['estado'], string> = {
  calculado: 'bg-success/10 text-success',
  parcial: 'bg-secondary/10 text-secondary',
  'sin-informacion': 'bg-gray-100 text-gray-500',
}

interface PanelNutricionCalculadaProps {
  calculo: ResultadoCalculo
}

const FilasValores = ({ valores }: { valores: Nutricion }) => (
  <ul className="space-y-1 text-sm text-gray-700">
    <li>🔥 {formatarNutricional(valores.calorias)} kcal</li>
    <li>🥩 {formatarNutricional(valores.proteinas)} g proteina</li>
    <li>🍚 {formatarNutricional(valores.carbohidratos)} g carbohidratos</li>
    <li>🥑 {formatarNutricional(valores.grasas)} g grasas</li>
    <li>🌱 {formatarNutricional(valores.fibra)} g fibra</li>
  </ul>
)

const PanelNutricionCalculada = ({ calculo }: PanelNutricionCalculadaProps) => {
  return (
    <div className="bg-white rounded-xl p-4 shadow-card">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-base font-bold text-dark flex items-center gap-1.5">
          <Flame size={16} className="text-primary" />
          Informacion nutricional calculada
        </h2>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ESTILOS_ESTADO[calculo.estado]}`}>
          {ETIQUETAS_ESTADO[calculo.estado]}
        </span>
      </div>

      {calculo.total && (
        <>
          <p className="text-xs font-semibold text-gray-400 mb-1">Receta completa</p>
          <FilasValores valores={calculo.total} />
        </>
      )}

      {calculo.porPorcion && calculo.porciones && (
        <>
          <p className="text-xs font-semibold text-gray-400 mt-3 mb-1">Por porcion ({calculo.porciones})</p>
          <FilasValores valores={calculo.porPorcion} />
        </>
      )}

      {calculo.sinEquivalencia.length > 0 && (
        <p className="text-xs text-danger mt-3">
          ⚠ Falta indicar el peso de 1 unidad para: {calculo.sinEquivalencia.join(', ')}
        </p>
      )}

      {calculo.faltantes.length > 0 && (
        <p className="text-xs text-danger mt-3">
          ⚠ Falta informacion nutricional para: {calculo.faltantes.join(', ')}
        </p>
      )}

      <p className="text-[11px] text-gray-400 mt-3">
        Valores nutricionales aproximados segun los ingredientes registrados.
      </p>
    </div>
  )
}

export default PanelNutricionCalculada
