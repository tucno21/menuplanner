import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Circle, CheckCircle2, UtensilsCrossed, Eye, Trash2, X } from 'lucide-react'
import BackButton from '../components/ui/BackButton'
import SwipeReveal from '../components/ui/SwipeReveal'
import { usePlanificacionStore } from '../store/planificacionStore'
import type { PlatoWithIngredientes } from '../store/planificacionStore'
import Modal from '../components/ui/Modal'
import AlertCustom from '../components/ui/AlertCustom'

const Dia = () => {
  const { fecha } = useParams()
  const navigate = useNavigate()

  const planificacion = usePlanificacionStore((s) => s.planificacion)
  const setModificarEstado = usePlanificacionStore((s) => s.setModificarEstado)
  const removePlanificacion = usePlanificacionStore((s) => s.removePlanificacion)
  const getPlatoById = usePlanificacionStore((s) => s.getPlatoById)

  const [openModal, setOpenModal] = useState(false)
  const [platoDetalle, setPlatoDetalle] = useState<PlatoWithIngredientes | null>(null)
  const [planificacionIdSeleccionada, setPlanificacionIdSeleccionada] = useState<number | null>(null)
  const [openAlert, setOpenAlert] = useState(false)
  const [swipedOpenId, setSwipedOpenId] = useState<number | null>(null)

  const fechaStr = fecha ?? ''
  const diaData = planificacion.find((p) => p.fecha === fechaStr)
  const platos = diaData?.platos ?? []

  const toggleEstado = (planificacionId: number) => {
    setModificarEstado(planificacionId)
  }

  const verDetalle = async (platoId: number) => {
    const detalle = await getPlatoById(platoId)
    if (detalle) {
      setPlatoDetalle(detalle)
      setOpenModal(true)
    }
  }

  const abrirAlert = (planificacionId: number) => {
    setPlanificacionIdSeleccionada(planificacionId)
    setOpenAlert(true)
  }

  const confirmarEliminar = async () => {
    if (planificacionIdSeleccionada !== null) {
      await removePlanificacion(planificacionIdSeleccionada)
    }
    setOpenAlert(false)
    setPlanificacionIdSeleccionada(null)
  }

  return (
    <div className="flex flex-col p-5 bg-backdrop min-h-full">
      <div className="flex items-center gap-3 mb-1">
        <BackButton />
        <p className="text-xl font-semibold text-dark">Dia: {fechaStr}</p>
      </div>
      <h1 className="text-2xl font-bold text-primary uppercase text-center mb-4">Platos del dia</h1>

      {platos.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No hay platos planificados para este dia</p>
      ) : (
        <div className="flex-1">
          {platos.map((plato) => {
            const gradiente =
              plato.estado === 'pendiente'
                ? 'linear-gradient(to right, #fd9e02, #ffb703)'
                : 'linear-gradient(to right, #4ade80, #22c55e)'
            return (
              <SwipeReveal
                className="mb-4 shadow-card"
                isOpen={swipedOpenId === plato.planificacionId}
                onOpenChange={(open) => setSwipedOpenId(open ? plato.planificacionId : null)}
                actions={[
                  { icon: <Eye size={20} color="white" />, onClick: () => verDetalle(plato.platoId), className: 'bg-info' },
                  { icon: <Trash2 size={20} color="white" />, onClick: () => abrirAlert(plato.planificacionId), className: 'bg-danger' },
                ]}
              >
                <div
                  className="flex flex-row justify-between items-center p-4"
                  style={{ background: gradiente }}
                >
                  <div className="flex flex-row items-center gap-4">
                    <button onClick={(e) => { e.stopPropagation(); toggleEstado(plato.planificacionId) }}>
                      {plato.estado === 'pendiente' ? (
                        <Circle size={24} color="white" />
                      ) : (
                        <CheckCircle2 size={24} color="white" />
                      )}
                    </button>
                    <span className="text-white text-xl font-semibold">{plato.nombre}</span>
                  </div>
                  <UtensilsCrossed size={24} className="text-white" />
                </div>
              </SwipeReveal>
            )
          })}
        </div>
      )}

      <button
        onClick={() => navigate(`/home/planificar/${fechaStr}`)}
        className="bg-primary px-6 py-3 rounded-lg text-light text-lg font-semibold active:scale-95 transition-all mt-4 self-center"
      >
        Planificar
      </button>

      <Modal isOpen={openModal} onClose={() => setOpenModal(false)}>
        {platoDetalle && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="relative bg-gradient-to-r from-primary to-primary-dark px-5 py-4">
              <h2 className="text-xl font-bold text-white pr-8">{platoDetalle.nombre}</h2>
              <button
                onClick={() => setOpenModal(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full" />
                  Ingredientes
                </h3>
                {platoDetalle.ingredientes.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Sin ingredientes</p>
                ) : (
                  <ul className="space-y-1.5 list-disc list-inside">
                    {platoDetalle.ingredientes.map((ing) => (
                      <li key={ing.id} className="text-gray-800">
                        {ing.nombre}
                        <span className="text-gray-500 text-sm ml-1.5">
                          {ing.cantidad} {ing.unidad}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-gray-100" />

              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full" />
                  Procedimiento
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {platoDetalle.descripcion || 'Sin procedimiento'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <AlertCustom
        isAlert={openAlert}
        title="¿Eliminar este plato de la planificacion?"
        onConfirm={confirmarEliminar}
        onClose={() => setOpenAlert(false)}
      />
    </div>
  )
}

export default Dia
