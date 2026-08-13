export interface SynthesisHandlers {
  onStart?: () => void
  onEnd?: () => void
  onError?: () => void
}

export interface SynthesisClient {
  readonly isSupported: boolean
  speak(text: string, handlers?: SynthesisHandlers): void
  cancel(): void
  dispose(): void
}

const SPANISH_LANG_PRIORITY = ['es-MX', 'es-US', 'es-ES']

function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const lang of SPANISH_LANG_PRIORITY) {
    const exact = voices.find((voice) => voice.lang === lang)
    if (exact !== undefined) return exact
  }
  const anySpanish = voices.find((voice) => voice.lang.startsWith('es'))
  return anySpanish ?? null
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

    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => handlers.onStart?.()
    utterance.onend = () => handlers.onEnd?.()
    utterance.onerror = () => handlers.onError?.()

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
