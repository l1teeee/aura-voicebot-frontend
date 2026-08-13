import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import { createSynthesisClient } from '@/infrastructure/speech/speechSynthesisClient'

export interface UseSpeechSynthesisReturn {
  isSupported: boolean
  isSpeaking: Ref<boolean>
  speak: (text: string, handlers?: { onEnd?: () => void; onError?: () => void }) => void
  cancel: () => void
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const client = createSynthesisClient()
  const isSpeaking = ref(false)

  function speak(text: string, handlers?: { onEnd?: () => void; onError?: () => void }): void {
    client.speak(text, {
      onStart: () => {
        isSpeaking.value = true
      },
      onEnd: () => {
        isSpeaking.value = false
        handlers?.onEnd?.()
      },
      onError: () => {
        isSpeaking.value = false
        handlers?.onError?.()
      },
    })
  }

  function cancel(): void {
    client.cancel()
  }

  onUnmounted(() => {
    client.dispose()
  })

  return {
    isSupported: client.isSupported,
    isSpeaking,
    speak,
    cancel,
  }
}
