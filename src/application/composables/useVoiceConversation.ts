import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { chatGatewayKey } from '@/config/injection'
import type { ConversationStatus } from '@/domain/types/conversation-status'
import type { Conversation, Message } from '@/domain/types/message'
import type { MicPermissionState } from '@/domain/types/mic-permission-state'
import type { VoiceError } from '@/domain/types/voice-error'
import { toVoiceError } from '@/infrastructure/api/httpChatGateway'
import { useConversationStore } from '@/application/stores/conversation.store'
import { useAudioLevel } from './useAudioLevel'
import { useMicrophonePermission } from './useMicrophonePermission'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useSpeechSynthesis } from './useSpeechSynthesis'

const MAX_MESSAGE_LENGTH = 1000

// Si Aura pregunta, el microfono se reabre solo para no perder la respuesta.
const QUESTION_PATTERN = /[?¿]/
const AUTO_LISTEN_DELAY_MS = 320
const AUTO_LISTEN_RETRIES = 1

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
  audioLevel: ComputedRef<number>
  micPermission: Ref<MicPermissionState>
  isSecureContext: boolean
  isRecognitionSupported: boolean
  needsTextFallback: ComputedRef<boolean>
  isRequestingPermission: Ref<boolean>
  toggle: () => Promise<void>
  requestMicPermission: () => Promise<void>
  sendText: (text: string) => Promise<void>
  repeatLastReply: () => void
  canRepeat: ComputedRef<boolean>
  dismissError: () => void
  userName: ComputedRef<string | null>
  needsIdentity: ComputedRef<boolean>
  isIdentifying: Ref<boolean>
  identify: (name: string) => Promise<boolean>
  continueAnonymously: () => void
  conversations: ComputedRef<Conversation[]>
  activeConversation: ComputedRef<Conversation | null>
  activeSessionId: ComputedRef<string>
  selectConversation: (sessionId: string) => boolean
  startNewConversation: () => void
  logout: () => void
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
  const isIdentifying = ref(false)
  let interactionVersion = 0
  let autoListenRetries = 0
  let autoListenTimer: ReturnType<typeof setTimeout> | null = null

  function cancelAutoListen(): void {
    if (autoListenTimer !== null) {
      clearTimeout(autoListenTimer)
      autoListenTimer = null
    }
    autoListenRetries = 0
  }

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

  function canAutoListen(): boolean {
    return recognition.isSupported
      && permission.isSecureContext
      && permission.isGranted.value
      && store.status === 'idle'
  }

  // Se espera un momento tras el audio para que el reconocimiento no capture
  // la cola de la voz sintetizada.
  function autoListenAfterReply(reply: string, version: number): void {
    if (version !== interactionVersion || !QUESTION_PATTERN.test(reply)) return

    autoListenTimer = setTimeout(() => {
      autoListenTimer = null
      if (version !== interactionVersion || !canAutoListen()) return

      autoListenRetries = AUTO_LISTEN_RETRIES
      void startListening()
    }, AUTO_LISTEN_DELAY_MS)
  }

  function speakReply(reply: string, version: number): void {
    if (!synthesis.isSupported) {
      transition('idle')
      autoListenAfterReply(reply, version)
      return
    }

    // "speaking" tambien cubre la breve carga del audio remoto, de modo que
    // el mismo boton pueda cancelar tanto el fetch como la reproduccion.
    transition('speaking')
    synthesis.speak(reply, {
      onStart: () => {
        transition('speaking')
      },
      onEnd: () => {
        transition('idle')
        autoListenAfterReply(reply, version)
      },
      onError: () => {
        transition('idle')
      },
    })
  }

  async function exchange(text: string): Promise<void> {
    const rotated = store.rotateSessionIfExpired()
    if (rotated && !store.identityResolved) {
      return
    }

    const messageSessionId = store.sessionId
    const requestVersion = ++interactionVersion
    store.addMessage('user', text, undefined, undefined, messageSessionId)
    transition('processing')

    try {
      const response = await gateway.sendMessage(text, messageSessionId, store.userId ?? undefined)
      store.addMessage('bot', response.reply, response.action, undefined, messageSessionId)
      if (requestVersion === interactionVersion && store.sessionId === messageSessionId) {
        speakReply(response.reply, requestVersion)
      }
    } catch (error) {
      if (requestVersion === interactionVersion && store.sessionId === messageSessionId) {
        store.setError(toVoiceError(error))
        transition('error')
      }
    } finally {
      store.touchActivity()
    }
  }

  function handleFinalTranscript(transcript: string): void {
    audioMeter.stop()
    cancelAutoListen()

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
      // Tras una pregunta de Aura se concede otra ventana antes de cerrar.
      if (autoListenRetries > 0) {
        autoListenRetries -= 1
        void startListening()
      }
      return
    }

    cancelAutoListen()

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
      // Corta tambien la reapertura automatica: el gesto manda.
      interactionVersion += 1
      cancelAutoListen()
      synthesis.cancel()
      transition('idle')
      return
    }

    if (current === 'listening') {
      cancelAutoListen()
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

    cancelAutoListen()

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

  function repeatLastReply(): void {
    if (store.status === 'processing' || store.status === 'listening') {
      return
    }

    const lastBotMessage = [...store.messages].reverse().find((message) => message.role === 'bot')
    if (!lastBotMessage) {
      return
    }

    // Se invalida la interaccion en curso antes de repetir, igual que en toggle().
    interactionVersion += 1
    cancelAutoListen()
    synthesis.cancel()
    transition('idle')
    speakReply(lastBotMessage.text, interactionVersion)
  }

  function dismissError(): void {
    store.setError(null)
    transition('idle')
  }

  async function identify(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (trimmed === '' || isIdentifying.value) return false
    store.setError(null)
    isIdentifying.value = true
    try {
      const result = await gateway.identify(trimmed)
      store.setIdentity(result.userId, trimmed)
      store.loadConversations(result.conversations)
      store.touchActivity()
      return true
    } catch (error) {
      store.setError(toVoiceError(error))
      return false
    } finally {
      isIdentifying.value = false
    }
  }

  async function rehydrateIdentifiedUser(): Promise<void> {
    const name = store.userName
    if (!store.userId || !name || isIdentifying.value) {
      return
    }

    isIdentifying.value = true
    try {
      const result = await gateway.identify(name)
      if (store.userName !== name) {
        return
      }
      const shouldPreserveActiveSession = store.sessionActive && store.activeConversation !== null
      store.setIdentity(result.userId, name)
      store.loadConversations(result.conversations, shouldPreserveActiveSession)
      store.touchActivity()
    } catch {
      return
    } finally {
      isIdentifying.value = false
    }
  }

  function continueAnonymously(): void {
    store.setIdentity(null, null)
    store.touchActivity()
  }

  function stopActiveInteraction(): void {
    interactionVersion += 1
    cancelAutoListen()
    recognition.abort()
    synthesis.cancel()
    audioMeter.stop()
    store.setStatus('idle')
  }

  function selectConversation(nextSessionId: string): boolean {
    stopActiveInteraction()
    return store.selectConversation(nextSessionId)
  }

  function startNewConversation(): void {
    stopActiveInteraction()
    store.startNewConversation()
  }

  function logout(): void {
    stopActiveInteraction()
    store.logout()
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState !== 'hidden' || store.status !== 'listening') {
      return
    }

    cancelAutoListen()
    recognition.abort()
    audioMeter.stop()
    transition('idle')
  }

  onMounted(() => {
    void permission.checkOnMount()
    void rehydrateIdentifiedUser()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    cancelAutoListen()
    recognition.abort()
    synthesis.cancel()
    audioMeter.stop()
  })

  return {
    status: computed(() => store.status),
    messages: computed(() => store.messages),
    error: computed(() => store.error),
    interimTranscript: recognition.interimTranscript,
    audioLevel: computed(() => (store.status === 'speaking' ? synthesis.level.value : audioMeter.level.value)),
    micPermission: permission.state,
    isSecureContext: permission.isSecureContext,
    isRecognitionSupported: recognition.isSupported,
    needsTextFallback: computed(
      () =>
        !recognition.isSupported ||
        !permission.isSecureContext ||
        permission.state.value === 'denied' ||
        permission.state.value === 'unavailable',
    ),
    isRequestingPermission,
    toggle,
    requestMicPermission,
    sendText,
    repeatLastReply,
    canRepeat: computed(() => store.status !== 'processing' && store.messages.some((message) => message.role === 'bot')),
    dismissError,
    userName: computed(() => store.userName),
    needsIdentity: computed(() => !store.identityResolved || (!store.sessionActive && !store.userId)),
    isIdentifying,
    identify,
    continueAnonymously,
    conversations: computed(() => store.conversations),
    activeConversation: computed(() => store.activeConversation),
    activeSessionId: computed(() => store.sessionId),
    selectConversation,
    startNewConversation,
    logout,
  }
}
