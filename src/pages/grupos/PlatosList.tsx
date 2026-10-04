import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { UtensilsCrossed, X, Tag } from 'lucide-react'
import { usePlanificacionStore } from '../../store/planificacionStore'
import { platoCoincideBusqueda } from '../../utils/busqueda'

const PlatosList = () => {
  const navigate = useNavigate()

  const platos = usePlanificacionStore((s) => s.platos)
  const etiquetas = usePlanificacionStore((s) => s.etiquetas)
  const platoEtiquetas = usePlanificacionStore((s) => s.platoEtiquetas)
  const loadPlatos = usePlanificacionStore((s) => s.loadPlatos)
  const loadEtiquetas = usePlanificacionStore((s) => s.loadEtiquetas)

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadPlatos()
    loadEtiquetas()
  }, [loadPlatos, loadEtiquetas])

  // Mapa platoId -> nombres de etiquetas para la busqueda
  const etiquetasPorPlato = new Map<number, string[]>()
  for (const pe of platoEtiquetas) {
    const etq = etiquetas.find((e) => e.id === pe.etiquetaId)
    if (!etq || pe.platoId == null) continue
    const lista = etiquetasPorPlato.get(pe.platoId) ?? []
    lista.push(etq.nombre)
    etiquetasPorPlato.set(pe.platoId, lista)
  }

  const filteredPlatos = platos.filter((p) =>
    platoCoincideBusqueda(p.nombre, p.id != null ? etiquetasPorPlato.get(p.id) ?? [] : [], searchQuery)
  )

  return (
    <div className="flex flex-col flex-1 px-5 pt-3 pb-5 bg-backdrop min-h-full">
      <div className="flex items-center justify-center relative mb-3">
        <h1 className="text-2xl font-bold text-center text-primary">Mis Platos</h1>
        <button
          onClick={() => navigate('/platos/etiquetas')}
          title="Etiquetas de platos"
          className="absolute right-0 bg-secondary/10 p-2 rounded-lg text-secondary hover:bg-secondary/20 active:scale-95 transition-all"
        >
          <Tag size={20} />
        </button>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Buscar platos"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-white text-lg text-black text-center p-3 rounded-lg border border-primary-light w-full outline-none pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1">
        {filteredPlatos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay platos creados</p>
        ) : (
          filteredPlatos.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/platos/plato/${p.id}`)}
              className="w-full p-4 mb-2 rounded-lg flex flex-row items-center bg-white border border-primary"
            >
              <div className="bg-primary rounded-full p-2">
                <UtensilsCrossed size={20} className="text-light" />
              </div>
              <span className="text-xl ml-4 flex-1 text-dark text-left">{p.nombre}</span>
            </button>
          ))
        )}
      </div>

      <button
        onClick={() => navigate('/platos/crear-plato')}
        className="w-full bg-primary rounded-lg py-3 text-light text-lg font-semibold shadow-card mt-4 active:scale-95 transition-all"
      >
        + Agregar Plato
      </button>
    </div>
  )
}

export default PlatosList
