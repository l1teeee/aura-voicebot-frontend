export interface SynthesisHandlers {
  onStart?: () => void
  onEnd?: () => void
  onError?: () => void
  onBoundary?: (charLength: number) => void
  // Solo lo emite el cliente que reproduce audio real; la Web Speech API no
  // expone amplitud y deja este canal vacio.
  onLevel?: (level: number) => void
}

export interface SynthesisClient {
  readonly isSupported: boolean
  speak(text: string, handlers?: SynthesisHandlers): void
  cancel(): void
  dispose(): void
}

const SPANISH_LANG_PRIORITY = ['es-MX', 'es-US', 'es-ES']

// Las voces SAPI locales de Windows (Sabina, Helena) suenan roboticas y suelen
// aparecer primero en getVoices(). Puntuamos para que ganen las neuronales.
function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  let score = 0

  if (name.includes('natural')) score += 100
  if (name.includes('online')) score += 40
  if (name.includes('google')) score += 60
  if (!voice.localService) score += 30

  const langIndex = SPANISH_LANG_PRIORITY.indexOf(voice.lang)
  score += langIndex === -1 ? 0 : (SPANISH_LANG_PRIORITY.length - langIndex) * 5

  return score
}

function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const spanish = voices.filter((voice) => voice.lang.toLowerCase().startsWith('es'))
  if (spanish.length === 0) return null

  return spanish.reduce((best, voice) => (scoreVoice(voice) > scoreVoice(best) ? voice : best))
}

export function createSynthesisClient(): SynthesisClient {
  const isSupported = typeof window.speechSynthesis !== 'undefined'
  const synth = isSupported ? window.speechSynthesis : null
  let cachedVoices: SpeechSynthesisVoice[] | null = null

  function handleVoicesChanged(): void {
    cachedVoices = synth?.getVoices() ?? null
  }

  synth?.addEventListener('voiceschanged', handleVoicesChanged)

  function resolveVoices(): SpeechSynthesisVoice[] {
    if (cachedVoices !== null && cachedVoices.length > 0) return cachedVoices
    const voices = synth?.getVoices() ?? []
    if (voices.length > 0) cachedVoices = voices
    return voices
  }

  function speak(text: string, handlers: SynthesisHandlers = {}): void {
    if (synth === null) return

    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickSpanishVoice(resolveVoices())

    if (voice !== null) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'es-ES'
    }

    utterance.rate = 0.95
    utterance.pitch = 1.05
    utterance.volume = 1

    utterance.onstart = () => handlers.onStart?.()
    utterance.onend = () => handlers.onEnd?.()
    utterance.onerror = () => handlers.onError?.()
    // Marca el ritmo real del habla: cada palabra dispara un boundary.
    utterance.onboundary = (event) => handlers.onBoundary?.(event.charLength ?? 0)

    synth.speak(utterance)
  }

  function cancel(): void {
    synth?.cancel()
  }

  function dispose(): void {
    synth?.cancel()
    synth?.removeEventListener('voiceschanged', handleVoicesChanged)
  }

  return { isSupported, speak, cancel, dispose }
}
