import { useNavigate } from 'react-router'
import { Users, UtensilsCrossed, ChevronRight } from 'lucide-react'

const GrupoDetail = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 justify-center items-center py-4 px-8 bg-backdrop min-h-full">
      <h1 className="text-3xl font-bold mt-5">Mi Cocina</h1>

      <div className="flex-1 flex flex-col justify-center items-center w-full gap-y-8">
        <button
          onClick={() => navigate('/grupos/integrantes/1')}
          className="w-full bg-secondary px-6 py-5 rounded-xl flex flex-row items-center shadow-card"
        >
          <div className="bg-light p-3 rounded-full">
            <Users size={24} className="text-secondary" />
          </div>
          <span className="text-light text-xl font-semibold ml-4 flex-1 text-left">
            Ver Integrantes
          </span>
          <ChevronRight size={24} className="text-light" />
        </button>

        <button
          onClick={() => navigate('/grupos/platos/1')}
          className="w-full bg-primary px-6 py-5 rounded-xl flex flex-row items-center shadow-card"
        >
          <div className="bg-light p-3 rounded-full">
            <UtensilsCrossed size={24} className="text-primary" />
          </div>
          <span className="text-light text-xl font-semibold ml-4 flex-1 text-left">
            Ver Platos del grupo
          </span>
          <ChevronRight size={24} className="text-light" />
        </button>
      </div>
    </div>
  )
}

export default GrupoDetail
