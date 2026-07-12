export const obtenerNombreDia = (fecha: Date): string => {
  const opciones: Intl.DateTimeFormatOptions = { weekday: 'long' }
  return fecha.toLocaleDateString('es-ES', opciones)
}
