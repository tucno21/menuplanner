import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  isVisible: boolean
  onClose: () => void
  title: string
  children: ReactNode
  height?: number
}

const BottomSheet = ({ isVisible, onClose, title, children, height = 0.8 }: BottomSheetProps) => {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="w-full max-w-[480px] h-full relative flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          className="relative w-full bg-white rounded-t-3xl shadow-lg flex flex-col transition-transform duration-300"
          style={{ height: `${height * 100}%`, transform: 'translateY(0)' }}
        >
          <div className="flex flex-row justify-between items-center p-5 pb-3">
            <h3 className="font-bold text-lg text-gray-800">{title}</h3>
            <button onClick={onClose} className="text-blue-500 font-bold p-2">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 pt-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BottomSheet
