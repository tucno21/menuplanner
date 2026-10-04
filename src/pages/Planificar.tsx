import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { UtensilsCrossed, CheckCircle2 } from 'lucide-react'
import { usePlanificacionStore } from '../store/planificacionStore'
import { platoCoincideBusqueda } from '../utils/busqueda'
import BackButton from '../components/ui/BackButton'
const Planificar = () => {
  const { fecha } = useParams()
  const navigate = useNavigate()

  const platos = usePlanificacionStore((s) => s.platos)
  const etiquetas = usePlanificacionStore((s) => s.etiquetas)
  const platoEtiquetas = usePlanificacionStore((s) => s.platoEtiquetas)
  const loadPlatos = usePlanificacionStore((s) => s.loadPlatos)
  const loadEtiquetas = usePlanificacionStore((s) => s.loadEtiquetas)
  const addPlatoToFecha = usePlanificacionStore((s) => s.addPlatoToFecha)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatos, setSelectedPlatos] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadPlatos()
    loadEtiquetas()
  }, [loadPlatos, loadEtiquetas])

  const fechaStr = fecha ?? ''

  // Mapa platoId -> nombres de etiquetas para la busqueda
  const etiquetasPorPlato = new Map<number, string[]>()
  for (const pe of platoEtiquetas) {
    const etq = etiquetas.find((e) => e.id === pe.etiquetaId)
    if (!etq || pe.platoId == null) continue
    const lista = etiquetasPorPlato.get(pe.platoId) ?? []
    lista.push(etq.nombre)
    etiquetasPorPlato.set(pe.platoId, lista)
  }

  const filteredPlatos = platos.filter(
    (p) =>
      platoCoincideBusqueda(p.nombre, p.id != null ? etiquetasPorPlato.get(p.id) ?? [] : [], searchQuery) ||
      (p.id != null && selectedPlatos.has(p.id))
  )

  const togglePlatoSelection = (id: number) => {
    const newSet = new Set(selectedPlatos)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedPlatos(newSet)
  }

  const handleRegistrar = async () => {
    for (const platoId of selectedPlatos) {
      await addPlatoToFecha(platoId, fechaStr, 'pendiente')
    }
    navigate(-1)
  }

  return (
    <div className="flex flex-col flex-1 px-4 sm:px-5 pt-3 pb-6 bg-backdrop min-h-full">
      {/* Cabecera fija superior */}
      <div className="sticky top-0 z-20 bg-backdrop pt-1 pb-3 -mx-4 sm:-mx-5 px-4 sm:px-5 border-b border-gray-200/80 shadow-xs mb-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <BackButton />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-primary leading-tight truncate">
                Seleccionar Platos
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                Fecha: <span className="text-gray-700 font-semibold">{fechaStr}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleRegistrar}
            disabled={selectedPlatos.size === 0}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm sm:text-base font-semibold shrink-0 disabled:opacity-40 active:scale-95 transition-all shadow-sm"
          >
            Registrar {selectedPlatos.size > 0 ? `(${selectedPlatos.size})` : ''}
          </button>
        </div>

        <input
          type="text"
          placeholder="Buscar platos o etiquetas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white text-gray-700 px-3.5 py-2 text-sm rounded-lg border border-primary-light outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
        />
      </div>

      <div className="flex-1">
        {filteredPlatos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay platos disponibles</p>
        ) : (
          filteredPlatos.map((p) => {
            const id = p.id!
            const isSelected = selectedPlatos.has(id)
            return (
              <button
                key={id}
                onClick={() => togglePlatoSelection(id)}
                className={`w-full p-3.5 mb-2 rounded-lg flex flex-row items-center transition-colors ${isSelected
                  ? 'bg-success-light/20 border border-primary'
                  : 'bg-white border border-gray-200 hover:border-primary-light'
                  }`}
              >
                <div className={`rounded-full p-2 shrink-0 ${isSelected ? 'bg-primary-dark' : 'bg-primary'}`}>
                  <UtensilsCrossed size={18} color="white" />
                </div>
                <span className="text-base sm:text-lg ml-3.5 flex-1 text-gray-800 text-left font-medium">{p.nombre}</span>
                {isSelected && <CheckCircle2 size={22} className="text-primary shrink-0" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Planificar
