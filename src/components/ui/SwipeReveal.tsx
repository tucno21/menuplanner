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
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const ITEM_WIDTH = 64

const SwipeReveal = ({ children, actions, threshold = 45, className = '', isOpen: controlled, onOpenChange }: SwipeRevealProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlled !== undefined
  const isOpenState = isControlled ? controlled : internalOpen
  const isOpenRef = useRef(isOpenState)
  const trackingRef = useRef<{ startX: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const prevControlled = useRef(controlled)
  const onOpenChangeRef = useRef(onOpenChange)
  const isControlledRef = useRef(isControlled)
  onOpenChangeRef.current = onOpenChange
  isControlledRef.current = isControlled

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
    if (!isControlledRef.current) setInternalOpen(true)
    else if (onOpenChangeRef.current) onOpenChangeRef.current(true)
    setTransform(1, true)
    setTimeout(resetTransition, 200)
  }

  const close = () => {
    isOpenRef.current = false
    if (!isControlledRef.current) setInternalOpen(false)
    else if (onOpenChangeRef.current) onOpenChangeRef.current(false)
    setTransform(0, true)
    setTimeout(resetTransition, 200)
  }

  useEffect(() => {
    isOpenRef.current = isOpenState
  }, [isOpenState])

  useEffect(() => {
    if (!isControlled) return
    if (controlled === prevControlled.current) return
    prevControlled.current = controlled
    isOpenRef.current = controlled
    setTransform(controlled ? 1 : 0, true)
    setTimeout(resetTransition, 200)
  }, [controlled]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [actionsWidth, threshold]) // eslint-disable-line react-hooks/exhaustive-deps

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
          transform: `scaleX(${isOpenState ? 1 : 0})`,
          transition: 'transform 0.2s ease',
          pointerEvents: isOpenState ? 'auto' : 'none',
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
          transform: `translateX(${-(isOpenState ? actionsWidth : 0)}px)`,
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
