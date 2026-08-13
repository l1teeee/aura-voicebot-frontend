import type { VoiceError } from '@/domain/types/voice-error'

export interface RecognitionHandlers {
  onInterim: (transcript: string) => void
  onFinal: (transcript: string) => void
  onError: (error: VoiceError) => void
  onEnd: () => void
}

export interface RecognitionClient {
  readonly isSupported: boolean
  start(handlers: RecognitionHandlers): void
  stop(): void
  abort(): void
  dispose(): void
}

function mapRecognitionError(error: SpeechRecognitionErrorCode): VoiceError | null {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        code: 'permission-denied',
        message: 'Necesito permiso para usar el microfono.',
        recoverable: true,
      }
    case 'no-speech':
      return { code: 'no-speech', message: 'No te escuche. Intentalo de nuevo.', recoverable: true }
    case 'audio-capture':
      return { code: 'audio-capture', message: 'No pude acceder al microfono.', recoverable: true }
    case 'network':
      return {
        code: 'network',
        message: 'Hubo un problema de conexion. Intentalo de nuevo.',
        recoverable: true,
      }
    case 'aborted':
      return null
    default:
      return {
        code: 'unknown',
        message: 'Ocurrio un error con el reconocimiento de voz.',
        recoverable: true,
      }
  }
}

export function createRecognitionClient(): RecognitionClient {
  const RecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  const isSupported = RecognitionConstructor !== undefined
  let recognition: SpeechRecognition | null = null

  function clearHandlers(): void {
    if (recognition === null) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
  }

  function start(handlers: RecognitionHandlers): void {
    if (RecognitionConstructor === undefined) {
      handlers.onError({
        code: 'recognition-unsupported',
        message: 'Tu navegador no admite el reconocimiento de voz.',
        recoverable: false,
      })
      return
    }

    clearHandlers()
    recognition?.abort()

    const instance = new RecognitionConstructor()
    instance.lang = 'es-MX'
    instance.continuous = false
    instance.interimResults = true
    instance.maxAlternatives = 1

    instance.onresult = (event) => {
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          handlers.onFinal(transcript)
        } else {
          interimTranscript += transcript
        }
      }
      if (interimTranscript !== '') {
        handlers.onInterim(interimTranscript)
      }
    }

    instance.onerror = (event) => {
      const mapped = mapRecognitionError(event.error)
      if (mapped !== null) {
        handlers.onError(mapped)
      }
    }

    instance.onend = () => {
      handlers.onEnd()
    }

    recognition = instance
    recognition.start()
  }

  function stop(): void {
    recognition?.stop()
  }

  function abort(): void {
    recognition?.abort()
  }

  function dispose(): void {
    clearHandlers()
    recognition?.abort()
    recognition = null
  }

  return { isSupported, start, stop, abort, dispose }
}
