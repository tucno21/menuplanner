import type { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  withInput?: boolean
}

const Modal = ({ isOpen, onClose, children }: ModalProps) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[85vw] max-w-sm sm:max-w-lg md:max-w-xl lg:max-w-2xl flex justify-center"
      >
        {children}
      </div>
    </div>
  )
}

export default Modal
