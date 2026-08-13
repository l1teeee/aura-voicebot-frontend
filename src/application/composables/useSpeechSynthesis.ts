import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import { createRemoteSpeechClient } from '@/infrastructure/speech/remoteSpeechClient'
import { createSynthesisClient } from '@/infrastructure/speech/speechSynthesisClient'

export interface SpeechCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: () => void
}

export interface UseSpeechSynthesisReturn {
  isSupported: boolean
  isSpeaking: Ref<boolean>
  level: Ref<number>
  speak: (text: string, handlers?: SpeechCallbacks) => void
  cancel: () => void
}

// La Web Speech API no expone amplitud, asi que la envolvente se arma con el
// ritmo real (boundary por palabra) sobre una onda base de respiracion.
// Sube rapido y baja lento para que el latido se lea como voz y no como parpadeo.
// Solo se usa en la ruta de fallback: con audio del backend la amplitud es real.
const PULSE_DECAY = 0.9
const ATTACK = 0.38
const RELEASE = 0.12
const REDUCED_MOTION_LEVEL = 0.4

// Varias voces remotas (Chrome/Edge online) nunca emiten boundary. Si no llega
// ninguno, se sostiene un ritmo sintetico de silabas para que el orbe siga vivo.
const BOUNDARY_GRACE_MS = 700
const SYNTHETIC_GAP_MIN_MS = 170
const SYNTHETIC_GAP_MAX_MS = 320

const LEVEL_PRECISION = 100

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const remoteClient = createRemoteSpeechClient()
  const browserClient = createSynthesisClient()
  const isSpeaking = ref(false)
  const level = ref(0)

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let frameId: number | null = null
  let startedAt = 0
  let pulse = 0
  let smoothed = 0
  let lastBoundaryAt = 0
  let nextSyntheticAt = 0
  // Cada peticion de habla lleva version: los eventos que llegan tarde tras un
  // cancel (o tras caer al fallback) no deben tocar el estado ya reiniciado.
  let speechVersion = 0

  function tick(now: number): void {
    const elapsed = (now - startedAt) / 1000
    pulse *= PULSE_DECAY

    if (now - lastBoundaryAt > BOUNDARY_GRACE_MS && now >= nextSyntheticAt) {
      pulse = Math.max(pulse, 0.34 + Math.random() * 0.3)
      nextSyntheticAt = now + SYNTHETIC_GAP_MIN_MS + Math.random() * (SYNTHETIC_GAP_MAX_MS - SYNTHETIC_GAP_MIN_MS)
    }

    const breath = 0.19 + Math.sin(elapsed * 3.4) * 0.06 + Math.sin(elapsed * 8.1) * 0.03
    const target = Math.min(1, Math.max(0, breath + pulse))
    smoothed += (target - smoothed) * (target > smoothed ? ATTACK : RELEASE)
    level.value = Math.round(smoothed * LEVEL_PRECISION) / LEVEL_PRECISION

    frameId = requestAnimationFrame(tick)
  }

  function startEnvelope(): void {
    if (prefersReducedMotion) {
      level.value = REDUCED_MOTION_LEVEL
      return
    }
    if (frameId !== null) return

    startedAt = performance.now()
    pulse = 0
    smoothed = 0
    lastBoundaryAt = 0
    nextSyntheticAt = 0
    frameId = requestAnimationFrame(tick)
  }

  function stopEnvelope(): void {
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
    pulse = 0
    smoothed = 0
    lastBoundaryAt = 0
    nextSyntheticAt = 0
    level.value = 0
  }

  // Con audio del backend la amplitud llega medida: nada de envolvente ni de
  // ritmo sintetico, solo el nivel que publica el cliente remoto.
  function startMeasuredLevel(): void {
    stopEnvelope()
    if (prefersReducedMotion) {
      level.value = REDUCED_MOTION_LEVEL
    }
  }

  function speakWithBrowser(text: string, version: number, handlers?: SpeechCallbacks): void {
    browserClient.speak(text, {
      onStart: () => {
        if (version !== speechVersion) return
        isSpeaking.value = true
        startEnvelope()
        handlers?.onStart?.()
      },
      onBoundary: (charLength) => {
        if (version !== speechVersion) return
        pulse = Math.min(0.8, 0.34 + Math.min(charLength, 12) / 26)
        lastBoundaryAt = performance.now()
      },
      onEnd: () => {
        if (version !== speechVersion) return
        isSpeaking.value = false
        stopEnvelope()
        handlers?.onEnd?.()
      },
      onError: () => {
        if (version !== speechVersion) return
        isSpeaking.value = false
        stopEnvelope()
        handlers?.onError?.()
      },
    })
  }

  function speakWithRemote(text: string, version: number, handlers?: SpeechCallbacks): void {
    let playbackStarted = false

    remoteClient.speak(text, {
      onStart: () => {
        if (version !== speechVersion) return
        playbackStarted = true
        isSpeaking.value = true
        startMeasuredLevel()
        handlers?.onStart?.()
      },
      onLevel: (value) => {
        if (version !== speechVersion || prefersReducedMotion) return
        level.value = Math.round(value * LEVEL_PRECISION) / LEVEL_PRECISION
      },
      onEnd: () => {
        if (version !== speechVersion) return
        isSpeaking.value = false
        stopEnvelope()
        handlers?.onEnd?.()
      },
      onError: () => {
        if (version !== speechVersion) return
        // Si el audio del backend nunca llego a sonar se repite con la voz del
        // navegador: peor timbre, pero el usuario no se queda sin respuesta.
        if (!playbackStarted && browserClient.isSupported) {
          speakWithBrowser(text, version, handlers)
          return
        }
        isSpeaking.value = false
        stopEnvelope()
        handlers?.onError?.()
      },
    })
  }

  function speak(text: string, handlers?: SpeechCallbacks): void {
    speechVersion += 1
    const version = speechVersion
    // Se corta a los dos por si la respuesta anterior acabo en el fallback.
    remoteClient.cancel()
    browserClient.cancel()
    isSpeaking.value = false
    stopEnvelope()

    if (remoteClient.isSupported) {
      speakWithRemote(text, version, handlers)
      return
    }

    speakWithBrowser(text, version, handlers)
  }

  function cancel(): void {
    speechVersion += 1
    remoteClient.cancel()
    browserClient.cancel()
    isSpeaking.value = false
    stopEnvelope()
  }

  onUnmounted(() => {
    speechVersion += 1
    stopEnvelope()
    remoteClient.dispose()
    browserClient.dispose()
  })

  return {
    isSupported: remoteClient.isSupported || browserClient.isSupported,
    isSpeaking,
    level,
    speak,
    cancel,
  }
}
