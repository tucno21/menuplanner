import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { UtensilsCrossed } from 'lucide-react'
import { usePlanificacionStore } from '../../store/planificacionStore'

const PlatosList = () => {
  const navigate = useNavigate()

  const platos = usePlanificacionStore((s) => s.platos)
  const loadPlatos = usePlanificacionStore((s) => s.loadPlatos)

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadPlatos()
  }, [loadPlatos])

  const filteredPlatos = platos.filter((p) =>
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col flex-1 px-5 pt-5 pb-5 bg-backdrop min-h-full">
      <h1 className="text-2xl font-bold text-center text-primary mb-6">Mis Platos</h1>

      <input
        type="text"
        placeholder="Buscar platos"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="bg-white text-lg text-black text-center p-3 rounded-lg border border-primary-light mb-4 outline-none"
      />

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
        className="bg-primary rounded-full py-3 px-6 text-light text-lg font-semibold shadow-card mt-4"
      >
        Agregar
      </button>
    </div>
  )
}

export default PlatosList
