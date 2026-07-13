import type { DataPlanificacion } from '../store/planificacionStore'

export interface DiaSemana {
  dia: string
  fecha: string
  data: 'si' | 'no'
  cantidad: number
}

const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

const formatearFecha = (fecha: Date): string => {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const parseFechaLocal = (fechaStr: string): Date => {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const construirSemana = (lunes: Date, planificacion: DataPlanificacion[]): DiaSemana[] => {
  const semana: DiaSemana[] = []

  for (let i = 0; i < 7; i++) {
    const fecha = new Date(lunes)
    fecha.setDate(lunes.getDate() + i)
    const fechaStr = formatearFecha(fecha)
    const diaData = planificacion.find((p) => p.fecha === fechaStr)
    const cantidad = diaData ? diaData.platos.length : 0
    semana.push({
      dia: diasSemana[fecha.getDay()],
      fecha: fechaStr,
      data: cantidad > 0 ? 'si' : 'no',
      cantidad,
    })
  }

  return semana
}

export const obtenerSemanaActual = (planificacion: DataPlanificacion[]): DiaSemana[] => {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - hoy.getDay() + 1)
  return construirSemana(lunes, planificacion)
}

export const obtenerProximaSemana = (planificacion: DataPlanificacion[]): DiaSemana[] => {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - hoy.getDay() + 8)
  return construirSemana(lunes, planificacion)
}

export const obtenerNumeroSemana = (date: Date): number => {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}
