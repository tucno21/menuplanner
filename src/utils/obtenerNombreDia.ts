import { parseFechaLocal } from './obtenerSemana'

export const obtenerNombreDia = (fechaStr: string): string => {
  const fecha = parseFechaLocal(fechaStr)
  const opciones: Intl.DateTimeFormatOptions = { weekday: 'long' }
  return fecha.toLocaleDateString('es-ES', opciones)
}
