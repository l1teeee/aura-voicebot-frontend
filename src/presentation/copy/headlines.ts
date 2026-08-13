export const HEADLINES: readonly string[] = [
  '¿Qué quieres saber hoy?',
  '¿En qué estás pensando?',
  '¿De qué hablamos?',
  '¿Qué te ronda la cabeza?',
  '¿Por dónde empezamos?',
  '¿Qué necesitas resolver?',
  'Cuéntame qué traes.',
  'Aquí estoy, ¿qué pasa?',
]

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

export function headlineForSession(sessionId: string): string {
  if (!sessionId) return HEADLINES[0]
  const index = hashString(sessionId) % HEADLINES.length
  return HEADLINES[index]
}
