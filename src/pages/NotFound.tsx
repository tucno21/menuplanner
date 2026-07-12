import { useNavigate } from 'react-router'

const NotFound = () => {
  const navigate = useNavigate()
  return (
    <div className="min-h-full flex flex-col justify-center items-center gap-4">
      <h1 className="text-6xl font-bold text-secondary">404</h1>
      <p className="text-xl text-gray-600">Pagina no encontrada</p>
      <button
        onClick={() => navigate('/home')}
        className="bg-primary px-6 py-3 rounded-full text-secondary-dark font-bold"
      >
        Volver al inicio
      </button>
    </div>
  )
}

export default NotFound
