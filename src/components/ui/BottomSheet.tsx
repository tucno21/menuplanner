import { useState, useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  isVisible: boolean
  onClose: () => void
  title: string
  children: ReactNode
  height?: number
}

const BottomSheet = ({ isVisible, onClose, title, children, height = 0.8 }: BottomSheetProps) => {
  const [render, setRender] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setRender(true)
      requestAnimationFrame(() => setAnimate(true))
    } else {
      setAnimate(false)
      const timer = setTimeout(() => setRender(false), 350)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, onClose])

  if (!render) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-300"
        style={{ opacity: animate ? 1 : 0 }}
        onClick={onClose}
      />
      <div className="w-full h-full relative flex flex-col justify-end px-3 sm:px-4 max-w-[480px] sm:max-w-lg md:max-w-2xl lg:max-w-4xl">
        <div
          className="relative w-full bg-white rounded-t-2xl flex flex-col shadow-xl"
          style={{
            height: `${height * 100}dvh`,
            maxHeight: '90dvh',
            transform: animate ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between px-5 py-2 shrink-0">
            <h3 className="font-bold text-lg text-gray-800">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-90 transition-all"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BottomSheet
