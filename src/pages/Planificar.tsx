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
    <div className="flex flex-col flex-1 px-5 pt-3 pb-6 bg-backdrop min-h-full">
      <div className="flex items-center gap-3 mb-3">
        <BackButton />
        <h1 className="text-2xl font-bold text-primary">Seleccione los Platos</h1>
      </div>

      <div className="bg-white text-gray-700 text-center p-2 rounded-lg border border-primary-light mb-4">
        {fechaStr}
      </div>

      <input
        type="text"
        placeholder="Buscar platos"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="bg-white text-gray-700 p-2 rounded-lg border border-primary-light mb-4 outline-none"
      />

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
                className={`w-full p-4 mb-2 rounded-lg flex flex-row items-center transition-colors ${isSelected
                  ? 'bg-success-light/20 border border-primary'
                  : 'bg-white border border-primary'
                  }`}
              >
                <div className={`rounded-full p-2 ${isSelected ? 'bg-primary-dark' : 'bg-primary'}`}>
                  <UtensilsCrossed size={20} color="white" />
                </div>
                <span className="text-lg ml-4 flex-1 text-gray-800 text-left">{p.nombre}</span>
                {isSelected && <CheckCircle2 size={24} className="text-primary" />}
              </button>
            )
          })
        )}
      </div>

      <button
        onClick={handleRegistrar}
        disabled={selectedPlatos.size === 0}
        className="bg-primary rounded-lg py-3 px-6 text-light text-lg font-semibold w-full mt-4 disabled:opacity-50 active:scale-95 transition-all"
      >
        Registrar
      </button>
    </div>
  )
}

export default Planificar
