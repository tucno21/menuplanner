import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CheckCircle, Circle, Sparkles, Zap } from 'lucide-react'
import { usePlanificacionStore } from '../store/planificacionStore'
import type { ListaItem, PlatoPlanificacion } from '../store/planificacionStore'
import { useToastStore } from '../store/toastStore'
import { db } from '../db/dexie'
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
  const navigate = useNavigate()
  const planificacion = usePlanificacionStore((s) => s.planificacion)
  const platos = usePlanificacionStore((s) => s.platos)
  const etiquetas = usePlanificacionStore((s) => s.etiquetas)
  const platoEtiquetas = usePlanificacionStore((s) => s.platoEtiquetas)
  const planificarSemana = usePlanificacionStore((s) => s.planificarSemana)
  const planificarSemanaConIA = usePlanificacionStore((s) => s.planificarSemanaConIA)
  const loadEtiquetas = usePlanificacionStore((s) => s.loadEtiquetas)
  const calcularListaCompras = usePlanificacionStore((s) => s.calcularListaCompras)
  const loadCompras = usePlanificacionStore((s) => s.loadCompras)
  const toggleCompra = usePlanificacionStore((s) => s.toggleCompra)
  const getPlanificacionBetweenDates = usePlanificacionStore((s) => s.getPlanificacionBetweenDates)
  const compras = usePlanificacionStore((s) => s.compras)
  const addToast = useToastStore((s) => s.addToast)

  const [activeTab, setActiveTab] = useState(0)
  const [showCompras, setShowCompras] = useState(false)
  const [showPlanificacion, setShowPlanificacion] = useState(false)
  const [showPlanificar, setShowPlanificar] = useState(false)
  const [seleccionEtiquetas, setSeleccionEtiquetas] = useState<string[]>([])
  const [modoIA, setModoIA] = useState(false)
  const [comentarioIA, setComentarioIA] = useState('')
  const [tieneKeyIA, setTieneKeyIA] = useState(false)
  const [planificando, setPlanificando] = useState(false)
  const [listaCompras, setListaCompras] = useState<ListaItem[]>([])
  const [numeroSemana, setNumeroSemana] = useState(0)
  const [anio, setAnio] = useState(0)
  const [planificacionSemanal, setPlanificacionSemanal] = useState<PlanificacionDia[]>([])

  useEffect(() => {
    loadEtiquetas()
    db.config.get('aiApiKey').then((c) => setTieneKeyIA(!!c?.value))
    db.config.get('aiComentario').then((c) => setComentarioIA(c?.value ?? ''))
  }, [loadEtiquetas])

  const semanaActual = obtenerSemanaActual(planificacion)
  const proximaSemana = obtenerProximaSemana(planificacion)

  // Mapa platoId -> etiquetas para el contador de coincidencias del planificador
  const etiquetasPorPlato = new Map<number, string[]>()
  for (const pe of platoEtiquetas) {
    const etq = etiquetas.find((e) => e.id === pe.etiquetaId)
    if (!etq || pe.platoId == null) continue
    const lista = etiquetasPorPlato.get(pe.platoId) ?? []
    lista.push(etq.nombre)
    etiquetasPorPlato.set(pe.platoId, lista)
  }

  const seleccionClaves = new Set(seleccionEtiquetas.map((e) => e.toLowerCase()))
  const platosCoincidentes = platos.filter((p) => {
    if (p.id == null) return false
    const etqs = etiquetasPorPlato.get(p.id) ?? []
    return etqs.some((n) => seleccionClaves.has(n.toLowerCase()))
  }).length

  const toggleEtiquetaSeleccion = (nombre: string) => {
    setSeleccionEtiquetas((prev) =>
      prev.includes(nombre) ? prev.filter((e) => e !== nombre) : [...prev, nombre]
    )
  }

  const handlePlanificar = async () => {
    if (modoIA && !navigator.onLine) {
      addToast('Sin internet para usar la IA', 'error')
      return
    }
    const semana = activeTab === 0 ? semanaActual : proximaSemana
    const fechas = semana.map((d) => d.fecha)
    setPlanificando(true)
    const resultado = modoIA
      ? await planificarSemanaConIA(fechas, seleccionEtiquetas, comentarioIA)
      : await planificarSemana(fechas, seleccionEtiquetas)
    setPlanificando(false)
    if (!resultado.ok) {
      addToast(resultado.error ?? 'No se pudo planificar', 'error')
      return
    }
    if (resultado.dias === 0) {
      addToast('Todos los dias de la semana ya tienen platos', 'info')
    } else {
      addToast(`Se planificaron ${resultado.dias} dia(s) (${resultado.platosAsignados} platos)`, 'success')
    }
    if (resultado.avisoLocal) {
      addToast(resultado.avisoLocal, 'warning')
    }
    setShowPlanificar(false)
    setSeleccionEtiquetas([])
  }

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

      <div className="flex flex-row gap-2 py-3 px-3 w-full bg-backdrop border-t border-gray-300">
        <button
          className="flex-1 bg-primary py-2.5 rounded-lg text-light text-xs sm:text-sm font-semibold active:scale-95 transition-all"
          onClick={handleListaComprasModal}
        >
          Compras
        </button>
        <button
          className="flex-1 bg-secondary py-2.5 rounded-lg text-light text-xs sm:text-sm font-semibold active:scale-95 transition-all"
          onClick={openModalPlanificacion}
        >
          Planificacion
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 bg-primary-dark py-2.5 rounded-lg text-light text-xs sm:text-sm font-semibold active:scale-95 transition-all"
          onClick={() => { setSeleccionEtiquetas([]); setShowPlanificar(true) }}
        >
          <Sparkles size={15} />
          Planificar
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
      <BottomSheet
        isVisible={showPlanificar}
        onClose={() => { setShowPlanificar(false); setSeleccionEtiquetas([]) }}
        title="Planificar Semana"
        height={0.75}
      >
        {etiquetas.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-3">No tienes etiquetas creadas</p>
            <button
              onClick={() => navigate('/platos/etiquetas')}
              className="bg-secondary py-2.5 px-5 rounded-lg text-light text-sm font-semibold active:scale-95 transition-all"
            >
              Crear etiquetas
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">Selecciona una o mas etiquetas:</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {etiquetas.map((etq) => {
                const selected = seleccionEtiquetas.includes(etq.nombre)
                return (
                  <button
                    key={etq.id}
                    onClick={() => toggleEtiquetaSeleccion(etq.nombre)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border active:scale-95 transition-all ${selected
                      ? 'bg-secondary border-secondary text-light'
                      : 'bg-white border-gray-300 text-gray-600'
                      }`}
                  >
                    {etq.nombre}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setModoIA(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border active:scale-95 transition-all ${!modoIA
                  ? 'bg-secondary border-secondary text-light'
                  : 'bg-white border-gray-300 text-gray-600'
                  }`}
              >
                <Zap size={15} />
                Rapido (offline)
              </button>
              <button
                onClick={() => setModoIA(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border active:scale-95 transition-all ${modoIA
                  ? 'bg-primary border-primary text-light'
                  : 'bg-white border-gray-300 text-gray-600'
                  }`}
              >
                <Sparkles size={15} />
                IA (Gemini)
              </button>
            </div>

            {modoIA && (
              <div className="mb-4">
                {!tieneKeyIA && (
                  <button
                    onClick={() => navigate('/settings')}
                    className="w-full text-left bg-primary/10 border border-primary/30 text-dark text-xs rounded-lg p-3 mb-2"
                  >
                    No tienes API key de Gemini. Tocala para configurarla en Ajustes.
                  </button>
                )}
                <textarea
                  placeholder="Comentarios para la IA (opcional): alergias, salud, preferencias, platos por dia..."
                  value={comentarioIA}
                  onChange={(e) => setComentarioIA(e.target.value)}
                  className="bg-gray-100 text-sm text-dark p-2 rounded-lg border border-gray-300 w-full outline-none resize-none"
                  rows={3}
                />
              </div>
            )}

            <p className="text-sm text-center font-medium text-gray-700 mb-4">
              {seleccionEtiquetas.length === 0
                ? 'Elige etiquetas para ver cuantos platos coinciden'
                : platosCoincidentes === 0
                  ? 'Ningun plato coincide con esas etiquetas'
                  : `${platosCoincidentes} plato(s) coinciden`}
            </p>

            <button
              onClick={handlePlanificar}
              disabled={planificando || seleccionEtiquetas.length === 0 || platosCoincidentes === 0 || (modoIA && (!tieneKeyIA || !navigator.onLine))}
              className="w-full flex items-center justify-center gap-2 bg-primary py-3 rounded-lg text-light text-lg font-semibold active:scale-95 transition-all disabled:opacity-50"
            >
              {modoIA ? <Sparkles size={18} /> : <Zap size={18} />}
              {planificando ? 'Planificando...' : modoIA ? 'Planificar con IA' : 'Planificar'}
            </button>

            <p className="text-[11px] text-gray-400 text-center mt-3">
              {modoIA
                ? 'La IA decide cuantos platos por dia (1 a 3) segun tus platos y comentarios. Requiere internet. Si falla, se usa el plan local.'
                : 'Se llenaran los dias vacios de la semana con 2 platos por dia. Los platos ya asignados no se tocan.'}
            </p>
          </>
        )}
      </BottomSheet>
    </div>
  )
}

export default Home
