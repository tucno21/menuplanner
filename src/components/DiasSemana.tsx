import { useNavigate } from 'react-router'
import { UtensilsCrossed, CheckCircle, CircleX } from 'lucide-react'
import type { DiaSemana } from '../utils/obtenerSemana'
import { formatearFechaLocal } from '../utils/obtenerSemana'

interface DiasSemanaProps {
  semana: DiaSemana[]
}

const GRADIENTE_GRIS = 'linear-gradient(to right, #9ca3af, #6b7280)'
const GRADIENTE_VERDE = 'linear-gradient(to right, #4ade80, #22c55e)'
const GRADIENTE_ROJO = 'linear-gradient(to right, #f87171, #ef4444)'

const DiasSemana = ({ semana }: DiasSemanaProps) => {
  const navigate = useNavigate()

  // Dia actual del dispositivo (YYYY-MM-DD local), se evalua una vez por render
  const hoy = formatearFechaLocal(new Date())

  return (
    <div className="w-full">
      {semana.map((dia, i) => {
        const esPasado = dia.fecha < hoy
        const esHoy = dia.fecha === hoy

        const gradient = esPasado
          ? GRADIENTE_GRIS
          : dia.data === 'si'
            ? GRADIENTE_VERDE
            : GRADIENTE_ROJO

        return (
          <button
            key={i}
            onClick={() => navigate(`/home/dia/${dia.fecha}`)}
            className={`w-full mb-3 rounded-xl overflow-hidden shadow-card ${esHoy ? 'ring-4 ring-primary' : ''
              }`}
          >
            <div
              className="py-4 px-5 flex flex-row justify-between items-center"
              style={{ background: gradient }}
            >
              <div className="flex flex-row items-center">
                <span className="text-white text-2xl font-bold mr-3">{dia.dia}</span>
                <span className="bg-white/30 rounded-full px-2 py-1 flex items-center gap-1">
                  <UtensilsCrossed size={16} className="text-secondary" />
                  <span className="text-secondary text-sm">{dia.cantidad}</span>
                </span>
                {esHoy && (
                  <span className="ml-2 bg-white/30 rounded-full px-2 py-1 text-white text-xs font-bold">
                    HOY
                  </span>
                )}
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="text-white text-sm">{dia.fecha.split('-').reverse().join('-')}</span>
                {dia.data === 'si' ? (
                  <CheckCircle size={24} className="text-white" />
                ) : (
                  <CircleX size={24} className="text-white" />
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default DiasSemana
