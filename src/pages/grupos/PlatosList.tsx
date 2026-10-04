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
    <div className="flex flex-col flex-1 px-4 sm:px-5 pt-3 pb-5 bg-backdrop min-h-full">
      {/* Cabecera fija superior */}
      <div className="sticky top-0 z-20 bg-backdrop pt-1 pb-3 -mx-4 sm:-mx-5 px-4 sm:px-5 border-b border-gray-200/80 shadow-xs mb-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-primary truncate">Mis Platos</h1>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/platos/etiquetas')}
              title="Etiquetas de platos"
              className="bg-secondary/10 p-2 rounded-lg text-secondary hover:bg-secondary/20 active:scale-95 transition-all"
            >
              <Tag size={18} />
            </button>
            <button
              onClick={() => navigate('/platos/crear-plato')}
              className="bg-primary hover:bg-primary-dark text-white px-3.5 py-2 rounded-lg text-sm sm:text-base font-semibold active:scale-95 transition-all shadow-sm flex items-center gap-1"
            >
              + Agregar Plato
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Buscar platos o etiquetas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-gray-700 px-3.5 py-2 text-sm rounded-lg border border-primary-light outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        {filteredPlatos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay platos creados</p>
        ) : (
          filteredPlatos.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/platos/plato/${p.id}`)}
              className="w-full p-3.5 mb-2 rounded-lg flex flex-row items-center bg-white border border-gray-200 hover:border-primary-light shadow-xs transition-colors"
            >
              <div className="bg-primary rounded-full p-2 shrink-0">
                <UtensilsCrossed size={18} className="text-light" />
              </div>
              <span className="text-base sm:text-lg ml-3.5 flex-1 text-dark text-left font-medium">{p.nombre}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default PlatosList
