import { useState } from 'react'
import { Navigate } from 'react-router'
import { useAuthStore } from '../store/authStore'
import Input from '../components/ui/Input'

const Login = () => {
  const hasPin = useAuthStore((s) => s.hasPin)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const createPin = useAuthStore((s) => s.createPin)
  const login = useAuthStore((s) => s.login)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  if (isAuthenticated) return <Navigate to="/home" replace />

  const filterPin = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4)

  const handlePinChange = (value: string) => {
    setPin(filterPin(value))
    setLocalError(null)
    clearError()
  }

  const handleConfirmChange = (value: string) => {
    setConfirmPin(filterPin(value))
    setLocalError(null)
  }

  const handleCreate = async () => {
    if (pin.length !== 4) {
      setLocalError('El PIN debe tener 4 digitos')
      return
    }
    if (pin !== confirmPin) {
      setLocalError('Los PINs no coinciden')
      return
    }
    setLocalError(null)
    await createPin(pin)
    await login(pin)
  }

  const handleLogin = async () => {
    if (pin.length !== 4) return
    await login(pin)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (hasPin) {
      handleLogin()
    } else {
      handleCreate()
    }
  }

  const displayError = hasPin ? (error ?? undefined) : (localError ?? undefined)

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-center items-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #025250, #024141)' }}
    >
      <div className="absolute top-20 left-5 w-20 h-20 rounded-full bg-primary/20" />
      <div className="absolute top-40 right-10 w-32 h-32 rounded-full bg-primary/10" />
      <div className="absolute bottom-40 left-10 w-40 h-40 rounded-full bg-primary/5" />

      <h1 className="text-primary text-4xl font-bold text-center mb-2">MenuPlanner</h1>
      <p className="text-light text-lg text-center mb-8">
        {hasPin ? 'Bienvenido de nuevo' : 'Crea tu PIN'}
      </p>

      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-soft w-full max-w-sm">
        <h2 className="text-light font-bold text-2xl mb-6 text-center">
          {hasPin ? 'Ingresar' : 'Crear PIN'}
        </h2>

        <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
          <Input
            type="password"
            placeholder={hasPin ? 'Ingrese su PIN' : 'Crear PIN (4 digitos)'}
            value={pin}
            onChange={handlePinChange}
            error={hasPin ? displayError : undefined}
            autoFocus
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
          />

          {!hasPin && (
            <Input
              type="password"
              placeholder="Confirmar PIN"
              value={confirmPin}
              onChange={handleConfirmChange}
              error={localError ?? undefined}
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          )}
        </div>

        <button
          onClick={hasPin ? handleLogin : handleCreate}
          className="w-full bg-primary p-4 rounded-full text-secondary-dark text-xl font-bold text-center mt-6 active:opacity-70 transition-opacity"
        >
          {hasPin ? 'Ingresar' : 'Crear PIN'}
        </button>
      </div>
    </div>
  )
}

export default Login
