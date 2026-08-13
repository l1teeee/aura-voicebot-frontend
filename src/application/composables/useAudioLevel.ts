import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import { createAudioLevelMeter } from '@/infrastructure/speech/audioLevelMeter'

export interface UseAudioLevelReturn {
  level: Ref<number>
  isActive: Ref<boolean>
  start: () => Promise<void>
  stop: () => void
}

export function useAudioLevel(): UseAudioLevelReturn {
  const meter = createAudioLevelMeter()
  const level = ref(0)
  const isActive = ref(false)

  async function start(): Promise<void> {
    if (isActive.value) return
    try {
      await meter.start((value) => {
        level.value = value
      })
      isActive.value = true
    } catch {
      isActive.value = false
      level.value = 0
    }
  }

  function stop(): void {
    meter.stop()
    isActive.value = false
    level.value = 0
  }

  onUnmounted(() => {
    stop()
  })

  return {
    level,
    isActive,
    start,
    stop,
  }
}
