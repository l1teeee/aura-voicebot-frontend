import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import type { VoiceError } from '@/domain/types/voice-error'
import { createRecognitionClient } from '@/infrastructure/speech/speechRecognitionClient'

export interface UseSpeechRecognitionHandlers {
  onFinalTranscript: (transcript: string) => void
  onError: (error: VoiceError) => void
  onEnd: () => void
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean
  isListening: Ref<boolean>
  interimTranscript: Ref<string>
  start: () => void
  stop: () => void
  abort: () => void
}

export function useSpeechRecognition(handlers: UseSpeechRecognitionHandlers): UseSpeechRecognitionReturn {
  const client = createRecognitionClient()
  const isListening = ref(false)
  const interimTranscript = ref('')

  function start(): void {
    if (isListening.value) return
    interimTranscript.value = ''
    isListening.value = true

    client.start({
      onInterim: (transcript) => {
        interimTranscript.value = transcript
      },
      onFinal: (transcript) => {
        handlers.onFinalTranscript(transcript)
      },
      onError: (error) => {
        isListening.value = false
        interimTranscript.value = ''
        handlers.onError(error)
      },
      onEnd: () => {
        isListening.value = false
        interimTranscript.value = ''
        handlers.onEnd()
      },
    })
  }

  function stop(): void {
    client.stop()
  }

  function abort(): void {
    client.abort()
  }

  onUnmounted(() => {
    client.dispose()
  })

  return {
    isSupported: client.isSupported,
    isListening,
    interimTranscript,
    start,
    stop,
    abort,
  }
}
