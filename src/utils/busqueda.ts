// Utilidades de busqueda compartidas por los buscadores de la app.

// Minusculas y sin tildes/diacriticos: "telefono" coincide con "Teléfono"
export function normalizarTexto(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Todas las palabras de la consulta deben aparecer en el texto,
// en cualquier orden: "arroz pollo" coincide con "Arroz con pollo"
export function coincideBusqueda(texto: string, consulta: string): boolean {
  const q = normalizarTexto(consulta).trim()
  if (!q) return true
  const t = normalizarTexto(texto)
  return q.split(/\s+/).every((palabra) => t.includes(palabra))
}

// Busqueda de platos: todas las palabras deben aparecer en el nombre
// o en sus etiquetas (busqueda por etiqueta incluida)
export function platoCoincideBusqueda(nombre: string, etiquetas: string[], consulta: string): boolean {
  const q = normalizarTexto(consulta).trim()
  if (!q) return true
  const campo = normalizarTexto(nombre + ' ' + etiquetas.join(' '))
  return q.split(/\s+/).every((palabra) => campo.includes(palabra))
}
