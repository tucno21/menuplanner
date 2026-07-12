import { useNavigate } from 'react-router'
import { Users, ChevronRight } from 'lucide-react'

const GroupList = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 w-full justify-center items-center p-5 bg-backdrop min-h-full">
      <h1 className="text-2xl text-slate-800 text-center font-bold mb-8">Lista de grupos</h1>

      <button
        onClick={() => navigate('/grupos/1')}
        className="w-full bg-primary px-6 py-5 rounded-xl flex flex-row items-center shadow-card"
      >
        <div className="bg-light p-3 rounded-full">
          <Users size={24} className="text-primary" />
        </div>
        <span className="text-light text-xl font-semibold ml-4 flex-1 text-left">Mi Cocina</span>
        <ChevronRight size={24} className="text-light" />
      </button>
    </div>
  )
}

export default GroupList
