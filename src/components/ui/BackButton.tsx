import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'

const BackButton = () => {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(-1)} className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
      <ChevronLeft size={22} className="text-primary" />
    </button>
  )
}

export default BackButton
