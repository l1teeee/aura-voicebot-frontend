import { env } from '@/config/env'
import type { SynthesisClient, SynthesisHandlers } from './speechSynthesisClient'

const SPEECH_PATH = '/api/speech'
// El endpoint solo acepta de 1 a 800 caracteres: fuera de ese rango no se pide
// nada y quien llama resuelve con la voz del navegador.
const MAX_TEXT_LENGTH = 800
const FFT_SIZE = 256
const SMOOTHING_FACTOR = 0.3
const PLAYBACK_START_TIMEOUT_MS = 5000
// El RMS de una voz normalizada rara vez pasa de 0.35: se escala para que el
// orbe recorra el mismo rango visual que tenia la envolvente sintetica.
const LEVEL_GAIN = 2.6

// WAV mudo de 44 bytes. Se reproduce dentro del gesto del usuario porque Safari
// iOS exige un gesto tanto para arrancar un <audio> como para crear o reanudar
// un AudioContext, y cuando llega la respuesta del backend ya no queda gesto.
const SILENT_CLIP = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown']

type AudioContextConstructor = typeof AudioContext

interface AudioGraph {
  context: AudioContext
  element: HTMLAudioElement
  analyser: AnalyserNode
}

function resolveAudioContext(): AudioContextConstructor | null {
  const scope = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

function canPlayMpeg(): boolean {
  if (typeof Audio === 'undefined') return false
  return new Audio().canPlayType('audio/mpeg') !== ''
}

export function createRemoteSpeechClient(): SynthesisClient {
  const AudioContextClass = resolveAudioContext()
  const isSupported = AudioContextClass !== null && canPlayMpeg()

  let graph: AudioGraph | null = null
  let handlers: SynthesisHandlers | null = null
  let request: AbortController | null = null
  let objectUrl: string | null = null
  let frameId: number | null = null
  let smoothedLevel = 0
  // Invalida reproducciones viejas: el fetch y el play() son asincronos y el
  // usuario puede interrumpir a Aura en cualquier punto.
  let playbackId = 0
  let primed = false

  function handleEnded(): void {
    if (handlers === null || graph === null || !graph.element.ended) return
    finish('end')
  }

  function handleMediaError(): void {
    if (handlers === null || graph === null || graph.element.error === null) return
    finish('error')
  }

  function buildGraph(): AudioGraph | null {
    if (graph !== null) return graph
    if (AudioContextClass === null) return null

    try {
      const context = new AudioContextClass()
      const element = new Audio()
      element.preload = 'auto'

      const analyser = context.createAnalyser()
      analyser.fftSize = FFT_SIZE
      // El blob es same-origin, asi que el nodo de medios no queda silenciado
      // por CORS y el analizador puede leer la onda real.
      context.createMediaElementSource(element).connect(analyser)
      analyser.connect(context.destination)

      element.addEventListener('ended', handleEnded)
      element.addEventListener('error', handleMediaError)

      graph = { context, element, analyser }
      return graph
    } catch {
      return null
    }
  }

  function detachGestureListeners(): void {
    GESTURE_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, prime, true)
    })
  }

  // El primer gesto de la app (el toque en el orbe) sirve de llave: aqui se
  // crea el grafo y se desbloquea el elemento, no cuando responde el backend.
  function prime(): void {
    if (primed || !isSupported) return
    primed = true
    detachGestureListeners()

    const ready = buildGraph()
    if (ready === null) return
    const primingId = playbackId

    void ready.context.resume().catch(() => {
      // Sin contexto activo se cae al fallback al hablar, no hay nada que hacer aqui.
    })

    try {
      ready.element.src = SILENT_CLIP
      void ready.element.play().then(() => {
        if (primingId !== playbackId) return
        ready.element.pause()
        ready.element.currentTime = 0
      }).catch(() => {
        // El desbloqueo es best effort: si falla, speak() lo detecta y avisa.
      })
    } catch {
      // Igual que arriba: el fallback cubre el caso.
    }
  }

  function stopLevelLoop(): void {
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
    smoothedLevel = 0
  }

  // Mismo RMS que el medidor del microfono, pero sobre la salida de Aura.
  function startLevelLoop(active: AudioGraph): void {
    if (frameId !== null) return

    const timeDomainData = new Uint8Array(active.analyser.fftSize)
    smoothedLevel = 0

    function tick(): void {
      active.analyser.getByteTimeDomainData(timeDomainData)

      let sumOfSquares = 0
      for (let i = 0; i < timeDomainData.length; i += 1) {
        const normalized = (timeDomainData[i] - 128) / 128
        sumOfSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumOfSquares / timeDomainData.length)
      smoothedLevel += SMOOTHING_FACTOR * (rms - smoothedLevel)

      handlers?.onLevel?.(Math.min(1, smoothedLevel * LEVEL_GAIN))
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
  }

  function releasePlayback(): void {
    stopLevelLoop()

    if (request !== null) {
      request.abort()
      request = null
    }

    if (graph !== null) {
      graph.element.pause()
      graph.element.removeAttribute('src')
      graph.element.load()
    }

    if (objectUrl !== null) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
  }

  function finish(outcome: 'end' | 'error'): void {
    const active = handlers
    handlers = null
    playbackId += 1
    releasePlayback()

    if (outcome === 'end') {
      active?.onEnd?.()
      return
    }
    active?.onError?.()
  }

  async function startPlayback(element: HTMLAudioElement): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('speech-playback-timeout')), PLAYBACK_START_TIMEOUT_MS)
    })

    try {
      await Promise.race([element.play(), timeout])
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }

  async function play(text: string, id: number): Promise<void> {
    const active = buildGraph()
    if (active === null) {
      finish('error')
      return
    }

    if (active.context.state !== 'running') {
      try {
        await active.context.resume()
      } catch {
        // El estado real se comprueba justo debajo.
      }
    }
    if (id !== playbackId) return
    // Un contexto suspendido reproduce en silencio: mejor fallar y que el
    // llamador use la voz del navegador.
    if (active.context.state !== 'running') {
      finish('error')
      return
    }

    const controller = new AbortController()
    request = controller
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, env.requestTimeoutMs)

    try {
      const response = await fetch(`${env.apiBaseUrl}${SPEECH_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error('speech-request-failed')
      }

      const audio = await response.blob()
      if (id !== playbackId) return
      if (audio.size === 0) {
        throw new Error('speech-empty-body')
      }

      if (request === controller) {
        request = null
      }
      clearTimeout(timeoutId)

      objectUrl = URL.createObjectURL(audio)
      active.element.src = objectUrl
      await startPlayback(active.element)
    } catch {
      if (id !== playbackId) return
      finish('error')
      return
    } finally {
      clearTimeout(timeoutId)
      if (request === controller) {
        request = null
      }
    }

    if (id !== playbackId) return
    startLevelLoop(active)
    handlers?.onStart?.()
  }

  function speak(text: string, nextHandlers: SynthesisHandlers = {}): void {
    if (!isSupported) {
      nextHandlers.onError?.()
      return
    }

    cancel()

    const trimmed = text.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LENGTH) {
      nextHandlers.onError?.()
      return
    }

    playbackId += 1
    handlers = nextHandlers
    void play(trimmed, playbackId)
  }

  function cancel(): void {
    playbackId += 1
    handlers = null
    releasePlayback()
  }

  // El AudioContext no se cierra en cancel(): en iOS solo se puede reanudar
  // dentro de un gesto y el usuario interrumpe a Aura a mitad de conversacion.
  // Se cierra aqui, cuando el composable se desmonta.
  function dispose(): void {
    cancel()
    detachGestureListeners()

    if (graph !== null) {
      graph.element.removeEventListener('ended', handleEnded)
      graph.element.removeEventListener('error', handleMediaError)
      void graph.context.close().catch(() => {
        // Cerrar un contexto ya cerrado no es un error que interese propagar.
      })
      graph = null
    }
  }

  if (isSupported) {
    GESTURE_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, prime, { capture: true, passive: true })
    })
  }

  return { isSupported, speak, cancel, dispose }
}
