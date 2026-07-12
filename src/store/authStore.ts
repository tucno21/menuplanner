import { create } from 'zustand'
import { db } from '../db/dexie'

interface AuthState {
  isAuthenticated: boolean
  hasPin: boolean
  loading: boolean
  error: string | null

  initialize: () => Promise<void>
  createPin: (pin: string) => Promise<void>
  login: (pin: string) => Promise<boolean>
  logout: () => void
  changePin: (oldPin: string, newPin: string) => Promise<boolean>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  hasPin: false,
  loading: true,
  error: null,

  initialize: async () => {
    const pinRecord = await db.config.get('pin')
    const hasPin = !!pinRecord
    const loggedOut = sessionStorage.getItem('mp_loggedOut') === 'true'
    set({ hasPin, isAuthenticated: hasPin && !loggedOut, loading: false })
  },

  createPin: async (pin: string) => {
    await db.config.put({ key: 'pin', value: pin })
    sessionStorage.removeItem('mp_loggedOut')
    set({ hasPin: true, isAuthenticated: true, error: null })
  },

  login: async (pin: string) => {
    const pinRecord = await db.config.get('pin')
    if (pinRecord && pinRecord.value === pin) {
      sessionStorage.removeItem('mp_loggedOut')
      set({ isAuthenticated: true, error: null })
      return true
    }
    set({ error: 'PIN incorrecto' })
    return false
  },

  logout: () => {
    sessionStorage.setItem('mp_loggedOut', 'true')
    set({ isAuthenticated: false })
  },

  changePin: async (oldPin: string, newPin: string) => {
    const pinRecord = await db.config.get('pin')
    if (pinRecord && pinRecord.value === oldPin) {
      await db.config.put({ key: 'pin', value: newPin })
      return true
    }
    return false
  },

  clearError: () => set({ error: null }),
}))
