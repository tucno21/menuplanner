import { useState } from 'react'
import { Navigate } from 'react-router'
import { ChefHat } from 'lucide-react'
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
      className="min-h-dvh w-full flex flex-col items-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #025250, #024141)' }}
    >
      <div className="absolute top-[15%] left-[10%] w-[20vw] h-[20vw] max-w-[180px] max-h-[180px] rounded-full bg-primary/20" />
      <div className="absolute top-[25%] right-[5%] w-[30vw] h-[30vw] max-w-[260px] max-h-[260px] rounded-full bg-primary/10" />
      <div className="absolute bottom-[20%] left-[5%] w-[35vw] h-[35vw] max-w-[300px] max-h-[300px] rounded-full bg-primary/5" />

      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-sm md:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary/20 p-4 rounded-full mb-4">
            <ChefHat size={36} className="text-primary" />
          </div>
          <h1 className="text-primary text-4xl font-bold text-center">MenuPlanner</h1>
          <p className="text-light/80 text-lg text-center mt-2">
            {hasPin ? 'Bienvenido de nuevo' : 'Organiza tus comidas'}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-soft w-full max-w-sm md:max-w-md">
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
            className="w-full bg-primary p-4 rounded-lg text-secondary-dark text-xl font-bold text-center mt-6 active:scale-95 transition-all hover:opacity-90"
          >
            {hasPin ? 'Ingresar' : 'Crear PIN'}
          </button>
        </div>
      </div>

      <footer className="pb-4 text-light/60 text-xs text-center">
        &copy; {new Date().getFullYear()} Desarrollado por: Carlos Tucno
      </footer>
    </div>
  )
}

export default Login
