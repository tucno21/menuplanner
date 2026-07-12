import { useState } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { db, ingredientesSeed, unidadesSeed } from '../db/dexie'
import AlertCustom from '../components/ui/AlertCustom'

const Settings = () => {
  const navigate = useNavigate()
  const changePin = useAuthStore((s) => s.changePin)
  const logout = useAuthStore((s) => s.logout)

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showResetAlert, setShowResetAlert] = useState(false)

  const filterPin = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4)

  const handleChangePin = async () => {
    setError(null)

    if (oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      setError('Todos los PINs deben tener 4 digitos')
      return
    }

    if (newPin !== confirmPin) {
      setError('Los PINs nuevos no coinciden')
      return
    }

    const success = await changePin(oldPin, newPin)
    if (!success) {
      setError('PIN actual incorrecto')
      return
    }

    setOldPin('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleResetData = async () => {
    await Promise.all([
      db.platos.clear(),
      db.ingredientes.clear(),
      db.platoIngredientes.clear(),
      db.planificaciones.clear(),
      db.compras.clear(),
      db.config.clear(),
      db.unidades.clear(),
    ])
    await Promise.all([
      db.unidades.bulkAdd(unidadesSeed),
      db.ingredientes.bulkAdd(ingredientesSeed),
    ])
    setShowResetAlert(false)
    logout()
    navigate('/')
  }

  return (
    <div className="flex flex-col flex-1 justify-between items-center px-5 py-5 bg-backdrop min-h-full relative">
      <div className="w-full">
        <h1 className="text-xl font-bold mb-4">Configuracion</h1>

        <div className="bg-white rounded-2xl p-6 w-full shadow-card mb-6">
          <h2 className="text-lg font-semibold text-dark mb-4">Cambiar PIN</h2>

          <input
            type="password"
            placeholder="PIN actual"
            value={oldPin}
            onChange={(e) => setOldPin(filterPin(e.target.value))}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          />

          <input
            type="password"
            placeholder="Nuevo PIN"
            value={newPin}
            onChange={(e) => setNewPin(filterPin(e.target.value))}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          />

          <input
            type="password"
            placeholder="Confirmar nuevo PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(filterPin(e.target.value))}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            className="bg-gray-100 rounded-lg px-4 py-3 w-full mb-3 border border-gray-300 outline-none text-dark"
          />

          <button
            onClick={handleChangePin}
            className="bg-primary py-3 rounded-full w-full text-light font-semibold"
          >
            Cambiar
          </button>

          {error && <p className="text-danger text-sm text-center mt-2">{error}</p>}
        </div>

        <button
          onClick={() => setShowResetAlert(true)}
          className="w-full flex items-center justify-center gap-2 bg-danger/10 border border-danger/30 py-3 rounded-xl text-danger font-semibold"
        >
          <Trash2 size={20} />
          Restablecer datos de fabrica
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="absolute bottom-5 right-5 bg-danger p-4 rounded-full"
      >
        <LogOut size={24} className="text-white" />
      </button>

      <AlertCustom
        isAlert={showResetAlert}
        title="¿Eliminar todos los datos? Esta accion no se puede deshacer."
        onConfirm={handleResetData}
        onClose={() => setShowResetAlert(false)}
      />
    </div>
  )
}

export default Settings
