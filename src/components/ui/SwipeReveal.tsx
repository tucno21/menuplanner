import { useState, useRef, useEffect } from 'react'

interface SwipeAction {
  icon: React.ReactNode
  onClick: () => void
  className?: string
}

interface SwipeRevealProps {
  children: React.ReactNode
  actions: SwipeAction[]
  threshold?: number
  className?: string
}

const ITEM_WIDTH = 64

const SwipeReveal = ({ children, actions, threshold = 45, className = '' }: SwipeRevealProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const isOpenRef = useRef(false)
  const trackingRef = useRef<{ startX: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  const actionsWidth = actions.length * ITEM_WIDTH

  const setTransform = (progress: number, transition = false) => {
    const c = contentRef.current
    const a = actionsRef.current
    if (!c || !a) return
    c.style.transition = transition ? 'transform 0.2s ease' : 'none'
    a.style.transition = transition ? 'transform 0.2s ease' : 'none'
    c.style.transform = `translateX(${-progress * actionsWidth}px)`
    a.style.transform = `scaleX(${progress})`
  }

  const resetTransition = () => {
    if (contentRef.current) contentRef.current.style.transition = 'none'
    if (actionsRef.current) actionsRef.current.style.transition = 'none'
  }

  const stopTracking = () => {
    trackingRef.current = null
  }

  const snapBack = () => {
    setTransform(isOpenRef.current ? 1 : 0, true)
    setTimeout(resetTransition, 200)
  }

  const open = () => {
    isOpenRef.current = true
    setIsOpen(true)
    setTransform(1, true)
    setTimeout(resetTransition, 200)
  }

  const close = () => {
    isOpenRef.current = false
    setIsOpen(false)
    setTransform(0, true)
    setTimeout(resetTransition, 200)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!trackingRef.current) return
      const delta = e.clientX - trackingRef.current.startX
      const nowOpen = isOpenRef.current
      const factor = actionsWidth * 0.7
      const raw = nowOpen ? 1 - delta / factor : -delta / factor
      setTransform(Math.max(0, Math.min(1, raw)))
    }

    const onUp = (e: PointerEvent) => {
      if (!trackingRef.current) return
      const delta = e.clientX - trackingRef.current.startX
      stopTracking()
      const nowOpen = isOpenRef.current

      if (Math.abs(delta) < 8) return

      if (nowOpen) {
        if (delta > threshold) close()
        else snapBack()
      } else {
        if (delta < -threshold) open()
        else snapBack()
      }
    }

    const onCancel = () => {
      if (!trackingRef.current) return
      stopTracking()
      snapBack()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [actionsWidth, threshold])

  const handlePointerDown = (e: React.PointerEvent) => {
    trackingRef.current = { startX: e.clientX }
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ touchAction: 'none' }}>
      <div
        ref={actionsRef}
        className="absolute inset-y-0 right-0 z-10 flex items-center"
        data-actions-container
        style={{
          width: `${actionsWidth}px`,
          transformOrigin: 'right center',
          transform: `scaleX(${isOpen ? 1 : 0})`,
          transition: 'transform 0.2s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); action.onClick() }}
            className={`${action.className || 'bg-primary'} h-full flex-1 flex items-center justify-center ${
              i === actions.length - 1 ? 'rounded-r-lg' : ''
            }`}
          >
            {action.icon}
          </button>
        ))}
      </div>
      <div
        ref={contentRef}
        data-swipe-content
        className="select-none"
        style={{
          transform: `translateX(${-(isOpen ? actionsWidth : 0)}px)`,
          transition: 'transform 0.2s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
      >
        {children}
      </div>
    </div>
  )
}

export default SwipeReveal
