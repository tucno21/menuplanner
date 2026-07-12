import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

interface AlertCustomProps {
  isAlert: boolean
  title: string
  onConfirm: () => void
  onClose: () => void
}

const AlertCustom = ({ isAlert, title, onConfirm, onClose }: AlertCustomProps) => {
  return (
    <Modal isOpen={isAlert} onClose={onClose}>
      <div className="bg-white w-11/12 max-w-sm px-6 py-8 rounded-3xl flex flex-col items-center">
        <div className="bg-red-100 p-3 rounded-full mb-4">
          <AlertTriangle size={48} color="#EF4444" />
        </div>
        <p className="text-center text-xl font-semibold text-gray-800 mb-6">{title}</p>
        <div className="flex flex-row gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 py-3 px-6 rounded-full text-gray-700 font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 py-3 px-6 rounded-full text-white font-semibold"
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default AlertCustom
