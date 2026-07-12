import { useState } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Trash2, Lock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { db, ingredientesSeed, unidadesSeed } from '../db/dexie'
import Modal from '../components/ui/Modal'
import AlertCustom from '../components/ui/AlertCustom'

const Settings = () => {
  const navigate = useNavigate()
  const changePin = useAuthStore((s) => s.changePin)
  const logout = useAuthStore((s) => s.logout)

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showResetAlert, setShowResetAlert] = useState(false)

  const filterPin = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 4)

  const openPinModal = () => {
    setOldPin('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
    setShowPinModal(true)
  }

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

    setShowPinModal(false)
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
    <div className="flex flex-col flex-1 px-5 py-5 bg-backdrop min-h-full">
      <div className="flex justify-end mb-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-danger/10 border border-danger/30 py-2 px-4 rounded-lg text-danger text-sm font-medium hover:bg-danger/20 active:scale-95 transition-all"
        >
          <LogOut size={16} />
          Cerrar Sesion
        </button>
      </div>

      <div className="space-y-3">
        <button
          onClick={openPinModal}
          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-medium active:scale-[0.99] transition-all"
        >
          <div className="bg-primary/10 p-2.5 rounded-lg">
            <Lock size={20} className="text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-dark font-semibold">Cambiar PIN</p>
            <p className="text-gray-400 text-sm">Actualiza tu PIN de acceso</p>
          </div>
        </button>

        <button
          onClick={() => setShowResetAlert(true)}
          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-card hover:shadow-medium active:scale-[0.99] transition-all"
        >
          <div className="bg-danger/10 p-2.5 rounded-lg">
            <Trash2 size={20} className="text-danger" />
          </div>
          <div className="text-left flex-1">
            <p className="text-dark font-semibold">Restablecer datos</p>
            <p className="text-gray-400 text-sm">Borra todo y vuelve al inicio</p>
          </div>
        </button>
      </div>

      <Modal isOpen={showPinModal} onClose={() => setShowPinModal(false)}>
        <div className="bg-white rounded-2xl p-6 w-11/12 max-w-sm">
          <h2 className="text-xl font-bold text-primary mb-4 text-center">Cambiar PIN</h2>

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

          {error && <p className="text-danger text-sm text-center mb-3">{error}</p>}

          <div className="flex flex-row gap-3">
            <button
              onClick={() => setShowPinModal(false)}
              className="flex-1 bg-gray-200 py-3 rounded-lg text-gray-700 font-semibold active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleChangePin}
              className="flex-1 bg-primary py-3 rounded-lg text-light font-semibold active:scale-95 transition-all"
            >
              Cambiar
            </button>
          </div>
        </div>
      </Modal>

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
