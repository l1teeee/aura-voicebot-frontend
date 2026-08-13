import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { chatGatewayKey } from '@/config/injection'
import type { ConversationStatus } from '@/domain/types/conversation-status'
import type { Message } from '@/domain/types/message'
import type { MicPermissionState } from '@/domain/types/mic-permission-state'
import type { VoiceError } from '@/domain/types/voice-error'
import { toVoiceError } from '@/infrastructure/api/httpChatGateway'
import { useConversationStore } from '@/application/stores/conversation.store'
import { useAudioLevel } from './useAudioLevel'
import { useMicrophonePermission } from './useMicrophonePermission'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useSpeechSynthesis } from './useSpeechSynthesis'

const MAX_MESSAGE_LENGTH = 1000

const SESSION_EXPIRED_TEXT = 'Se perdio el historial por inactividad. Empezamos una conversacion nueva.'

const INSECURE_CONTEXT_ERROR: VoiceError = {
  code: 'insecure-context',
  message: 'Necesitas una conexion segura (HTTPS) para usar el microfono.',
  recoverable: false,
}

const RECOGNITION_UNSUPPORTED_ERROR: VoiceError = {
  code: 'recognition-unsupported',
  message: 'Tu navegador no puede escucharte. Escribe tu mensaje para hablar con Aura.',
  recoverable: false,
}

const allowedTransitions: Record<ConversationStatus, readonly ConversationStatus[]> = {
  idle: ['listening', 'processing'],
  listening: ['processing', 'idle'],
  processing: ['speaking', 'error'],
  speaking: ['idle'],
  error: ['idle'],
}

function canTransition(from: ConversationStatus, to: ConversationStatus): boolean {
  if (from === to) {
    return false
  }
  return to === 'idle' || allowedTransitions[from].includes(to)
}

export interface UseVoiceConversationReturn {
  status: ComputedRef<ConversationStatus>
  messages: ComputedRef<Message[]>
  error: ComputedRef<VoiceError | null>
  interimTranscript: Ref<string>
  audioLevel: Ref<number>
  micPermission: Ref<MicPermissionState>
  isSecureContext: boolean
  isRecognitionSupported: boolean
  needsTextFallback: ComputedRef<boolean>
  isRequestingPermission: Ref<boolean>
  toggle: () => Promise<void>
  requestMicPermission: () => Promise<void>
  sendText: (text: string) => Promise<void>
  dismissError: () => void
}

export function useVoiceConversation(): UseVoiceConversationReturn {
  const injectedGateway = inject(chatGatewayKey)
  if (injectedGateway === undefined) {
    throw new Error('Falta el ChatGateway: registralo con app.provide(chatGatewayKey, new HttpChatGateway())')
  }
  const gateway = injectedGateway

  const store = useConversationStore()
  const permission = useMicrophonePermission()
  const synthesis = useSpeechSynthesis()
  const audioMeter = useAudioLevel()
  const isRequestingPermission = ref(false)

  const recognition = useSpeechRecognition({
    onFinalTranscript: handleFinalTranscript,
    onError: handleRecognitionError,
    onEnd: handleRecognitionEnd,
  })

  function transition(to: ConversationStatus): void {
    if (!canTransition(store.status, to)) {
      return
    }
    store.setStatus(to)
  }

  function speakReply(reply: string): void {
    if (!synthesis.isSupported) {
      transition('idle')
      return
    }

    transition('speaking')
    synthesis.speak(reply, {
      onEnd: () => {
        transition('idle')
      },
      onError: () => {
        transition('idle')
      },
    })
  }

  async function exchange(text: string): Promise<void> {
    if (store.rotateSessionIfExpired()) {
      store.addMessage('assistant', SESSION_EXPIRED_TEXT)
    }

    store.addMessage('user', text)
    transition('processing')

    try {
      const response = await gateway.sendMessage(text, store.sessionId)
      store.addMessage('assistant', response.reply, response.action)
      speakReply(response.reply)
    } catch (error) {
      store.setError(toVoiceError(error))
      transition('error')
    } finally {
      store.touchActivity()
    }
  }

  function handleFinalTranscript(transcript: string): void {
    audioMeter.stop()

    const text = transcript.trim()
    if (text === '' || text.length > MAX_MESSAGE_LENGTH) {
      transition('idle')
      return
    }

    void exchange(text)
  }

  function handleRecognitionError(voiceError: VoiceError): void {
    audioMeter.stop()

    if (voiceError.code === 'no-speech') {
      transition('idle')
      return
    }

    if (voiceError.code === 'permission-denied') {
      permission.state.value = 'denied'
      transition('idle')
      return
    }

    store.setError(voiceError)
    transition('idle')
  }

  function handleRecognitionEnd(): void {
    audioMeter.stop()
    if (store.status === 'listening') {
      transition('idle')
    }
  }

  async function requestMicPermission(): Promise<void> {
    if (isRequestingPermission.value) {
      return
    }

    isRequestingPermission.value = true
    try {
      await permission.request()
    } finally {
      isRequestingPermission.value = false
    }
  }

  async function startListening(): Promise<void> {
    transition('idle')
    store.setError(null)

    if (!permission.isSecureContext) {
      store.setError(INSECURE_CONTEXT_ERROR)
      return
    }

    if (!recognition.isSupported) {
      store.setError(RECOGNITION_UNSUPPORTED_ERROR)
      return
    }

    if (!permission.isGranted.value) {
      await requestMicPermission()
      return
    }

    transition('listening')
    recognition.start()

    try {
      await audioMeter.start()
    } catch {
      audioMeter.stop()
    }
  }

  async function toggle(): Promise<void> {
    const current = store.status

    if (current === 'processing') {
      return
    }

    if (current === 'speaking') {
      synthesis.cancel()
      transition('idle')
      return
    }

    if (current === 'listening') {
      recognition.stop()
      audioMeter.stop()
      return
    }

    await startListening()
  }

  async function sendText(text: string): Promise<void> {
    const trimmed = text.trim()
    if (trimmed === '' || trimmed.length > MAX_MESSAGE_LENGTH || store.status === 'processing') {
      return
    }

    if (store.status === 'listening') {
      recognition.abort()
      audioMeter.stop()
    }
    if (store.status === 'speaking') {
      synthesis.cancel()
    }

    transition('idle')
    store.setError(null)

    await exchange(trimmed)
  }

  function dismissError(): void {
    store.setError(null)
    transition('idle')
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState !== 'hidden' || store.status !== 'listening') {
      return
    }

    recognition.abort()
    audioMeter.stop()
    transition('idle')
  }

  onMounted(() => {
    void permission.checkOnMount()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    recognition.abort()
    synthesis.cancel()
    audioMeter.stop()
  })

  return {
    status: computed(() => store.status),
    messages: computed(() => store.messages),
    error: computed(() => store.error),
    interimTranscript: recognition.interimTranscript,
    audioLevel: audioMeter.level,
    micPermission: permission.state,
    isSecureContext: permission.isSecureContext,
    isRecognitionSupported: recognition.isSupported,
    needsTextFallback: computed(
      () =>
        !recognition.isSupported ||
        !permission.isSecureContext ||
        permission.state.value === 'unavailable',
    ),
    isRequestingPermission,
    toggle,
    requestMicPermission,
    sendText,
    dismissError,
  }
}
