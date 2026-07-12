import { useState, useRef, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useToastStore, type ToastType } from '../../store/toastStore'

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const borderIconMap: Record<ToastType, string> = {
  success: 'border-l-success text-success',
  error: 'border-l-danger text-danger',
  warning: 'border-l-warning text-warning',
  info: 'border-l-info text-info',
}

const progressMap: Record<ToastType, string> = {
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
}

interface ToastItemProps {
  toast: {
    id: string
    message: string
    type: ToastType
    duration: number
  }
}

const ToastItem = ({ toast }: ToastItemProps) => {
  const removeToast = useToastStore((s) => s.removeToast)
  const [remaining, setRemaining] = useState(toast.duration)
  const [paused, setPaused] = useState(false)
  const lastTickRef = useRef(Date.now())
  const rafRef = useRef<number>()

  const tick = useCallback(() => {
    const now = Date.now()
    const delta = now - lastTickRef.current
    lastTickRef.current = now

    setRemaining((prev) => {
      const next = prev - delta
      if (next <= 0) {
        removeToast(toast.id)
        return 0
      }
      return next
    })
  }, [toast.id, removeToast])

  useEffect(() => {
    if (paused) return

    lastTickRef.current = Date.now()

    const loop = () => {
      tick()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [paused, tick])

  const progress = Math.max(0, (remaining / toast.duration) * 100)
  const Icon = iconMap[toast.type]

  return (
    <div
      className={`toast-enter pointer-events-auto relative mt-2 sm:mt-0 sm:mb-2 w-[calc(100vw-2rem)] sm:w-80 bg-white border border-gray-200 border-l-4 rounded-xl shadow-medium overflow-hidden ${borderIconMap[toast.type]}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Icon size={20} className="shrink-0 mt-0.5" />
        <p className="text-sm font-medium flex-1 text-dark">{toast.message}</p>
        <button
          onClick={() => removeToast(toast.id)}
          className="shrink-0 p-0.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
        >
          <X size={16} />
        </button>
      </div>
      <div className="h-1 bg-gray-100 w-full">
        <div
          className={`h-full rounded-full transition-none ${progressMap[toast.type]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

const Toast = () => {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col items-center sm:items-end sm:top-4 sm:right-4 sm:left-auto pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

export default Toast
