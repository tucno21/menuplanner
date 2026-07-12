import { CircleUser, Bookmark } from 'lucide-react'

const Integrantes = () => {
  return (
    <div className="flex flex-col flex-1 bg-backdrop min-h-full">
      <div className="flex-1 px-5 overflow-y-auto">
        <h1 className="text-2xl font-bold text-primary my-6 text-center">Lista de integrantes</h1>

        <div className="flex flex-row items-center justify-between mb-4 bg-white p-3 rounded-lg">
          <div className="flex flex-row items-center gap-3">
            <CircleUser size={28} className="text-primary" />
            <div className="flex flex-col">
              <span className="font-semibold text-gray-800">Yo</span>
              <span className="text-xs text-gray-500">Usuario local</span>
            </div>
          </div>
          <Bookmark size={24} className="text-primary-dark" />
        </div>
      </div>

      <div className="p-4 bg-backdrop">
        <p className="text-center text-gray-500 text-sm">
          Las invitaciones no estan disponibles en modo local
        </p>
      </div>
    </div>
  )
}

export default Integrantes
