import { useState } from 'react'
import { CheckCircle, Circle } from 'lucide-react'
import { usePlanificacionStore } from '../store/planificacionStore'
import type { ListaItem, PlatoPlanificacion } from '../store/planificacionStore'
import { obtenerSemanaActual, obtenerProximaSemana, obtenerNumeroSemana, parseFechaLocal } from '../utils/obtenerSemana'
import { obtenerNombreDia } from '../utils/obtenerNombreDia'
import CustomTab from '../components/CustomTab'
import DiasSemana from '../components/DiasSemana'
import BottomSheet from '../components/ui/BottomSheet'

interface PlanificacionDia {
  dia: string
  platos: PlatoPlanificacion[]
}

const Home = () => {
  const planificacion = usePlanificacionStore((s) => s.planificacion)
  const calcularListaCompras = usePlanificacionStore((s) => s.calcularListaCompras)
  const loadCompras = usePlanificacionStore((s) => s.loadCompras)
  const toggleCompra = usePlanificacionStore((s) => s.toggleCompra)
  const getPlanificacionBetweenDates = usePlanificacionStore((s) => s.getPlanificacionBetweenDates)
  const compras = usePlanificacionStore((s) => s.compras)

  const [activeTab, setActiveTab] = useState(0)
  const [showCompras, setShowCompras] = useState(false)
  const [showPlanificacion, setShowPlanificacion] = useState(false)
  const [listaCompras, setListaCompras] = useState<ListaItem[]>([])
  const [numeroSemana, setNumeroSemana] = useState(0)
  const [anio, setAnio] = useState(0)
  const [planificacionSemanal, setPlanificacionSemanal] = useState<PlanificacionDia[]>([])

  const semanaActual = obtenerSemanaActual(planificacion)
  const proximaSemana = obtenerProximaSemana(planificacion)

  const handleListaComprasModal = async () => {
    const semana = activeTab === 0 ? semanaActual : proximaSemana
    const fechaInicio = semana[0].fecha
    const fechaFin = semana[6].fecha
    const numSemana = obtenerNumeroSemana(parseFechaLocal(fechaInicio))
    const year = parseFechaLocal(fechaInicio).getFullYear()
    const lista = await calcularListaCompras(fechaInicio, fechaFin)
    await loadCompras(numSemana, year)
    setListaCompras(lista)
    setNumeroSemana(numSemana)
    setAnio(year)
    setShowCompras(true)
  }

  const openModalPlanificacion = () => {
    const semana = activeTab === 0 ? semanaActual : proximaSemana
    const fechaInicio = semana[0].fecha
    const fechaFin = semana[6].fecha
    const result = getPlanificacionBetweenDates(fechaInicio, fechaFin)
    const mapped = result.map((data) => ({
      dia: obtenerNombreDia(data.fecha),
      platos: data.platos,
    }))
    setPlanificacionSemanal(mapped)
    setShowPlanificacion(true)
  }

  const tabs = [
    {
      title: 'Semana Actual',
      content: (
        <div className="p-4">
          <DiasSemana semana={semanaActual} />
        </div>
      ),
    },
    {
      title: 'Semana Proxima',
      content: (
        <div className="p-4">
          <DiasSemana semana={proximaSemana} />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full bg-backdrop">
      <div className="flex-1 w-full bg-backdrop overflow-hidden flex flex-col">
        <CustomTab tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      <div className="flex flex-row gap-3 py-3 px-4 w-full bg-backdrop border-t border-gray-300">
        <button
          className="flex-1 bg-primary py-2.5 rounded-lg text-light text-sm sm:text-base font-semibold active:scale-95 transition-all"
          onClick={handleListaComprasModal}
        >
          Ver Compras
        </button>
        <button
          className="flex-1 bg-secondary py-2.5 rounded-lg text-light text-sm sm:text-base font-semibold active:scale-95 transition-all"
          onClick={openModalPlanificacion}
        >
          Ver Planificacion
        </button>
      </div>

      <BottomSheet
        isVisible={showCompras}
        onClose={() => setShowCompras(false)}
        title="Lista de Compras"
        height={0.86}
      >
        {listaCompras.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay ingredientes para comprar</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(() => {
              const comprados = new Set(compras.filter((c) => c.estado === 'comprado').map((c) => c.ingredienteId))
              return [...listaCompras].sort((a, b) => {
                const aDone = comprados.has(a.id)
                const bDone = comprados.has(b.id)
                return aDone === bDone ? 0 : aDone ? 1 : -1
              }).map((item) => {
              const compra = compras.find((c) => c.ingredienteId === item.id)
              const isComprado = compra?.estado === 'comprado'
              return (
                <button
                  key={item.id}
                  onClick={() => toggleCompra(item.id, item.cantidad_total, numeroSemana, anio)}
                  className={`w-full flex flex-row justify-between items-center px-4 py-3 rounded-xl transition-colors ${isComprado ? 'bg-success-light/50' : 'bg-backdrop'
                    }`}
                >
                  <span className="text-lg text-gray-800 truncate">{item.ingrediente}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-600 text-sm whitespace-nowrap">
                      {item.cantidad_total} {item.unidad}
                    </span>
                    {isComprado ? (
                      <CheckCircle size={22} className="text-success-dark shrink-0" />
                    ) : (
                      <Circle size={22} className="text-[#6B7280] shrink-0" />
                    )}
                  </div>
                </button>
              )
            })
            })()}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        isVisible={showPlanificacion}
        onClose={() => setShowPlanificacion(false)}
        title="Planificacion Semanal"
        height={0.80}
      >
        {planificacionSemanal.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay planificacion esta semana</p>
        ) : (
          planificacionSemanal.map((dia, i) => (
            <div key={i} className="mb-6">
              <h3 className="text-xl font-bold uppercase mb-2 text-primary">{dia.dia}</h3>
              {dia.platos.length === 0 ? (
                <p className="text-gray-400 text-sm">Sin platos planificados</p>
              ) : (
                dia.platos.map((plato) => (
                  <div
                    key={plato.planificacionId}
                    className="flex flex-row justify-between items-center bg-white border border-gray-200 px-3 py-2 rounded-lg mb-1"
                  >
                    <span className="text-lg text-black">{plato.nombre}</span>
                    <span
                      className={`px-2 py-1 rounded-full font-semibold text-sm ${plato.estado === 'preparado'
                          ? 'bg-success-light/30 text-success'
                          : 'bg-danger-light/30 text-danger'
                        }`}
                    >
                      {plato.estado === 'preparado' ? 'Preparado' : 'Pendiente'}
                    </span>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </BottomSheet>
    </div>
  )
}

export default Home
