import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConversationStatus } from '@/domain/types/conversation-status'
import type { ChatAction, Message, Speaker } from '@/domain/types/message'
import type { VoiceError } from '@/domain/types/voice-error'

const SESSION_ID_KEY = 'aura.sessionId'
const LAST_ACTIVITY_KEY = 'aura.lastActivityAt'
const SESSION_TTL_MS = 30 * 60 * 1000

function readStoredValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    return
  }
}

function loadSessionId(): string {
  const stored = readStoredValue(SESSION_ID_KEY)
  if (stored !== null && stored !== '') {
    return stored
  }
  const created = crypto.randomUUID()
  writeStoredValue(SESSION_ID_KEY, created)
  return created
}

function readLastActivityAt(): number {
  const stored = readStoredValue(LAST_ACTIVITY_KEY)
  if (stored === null) {
    return 0
  }
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : 0
}

export const useConversationStore = defineStore('conversation', () => {
  const messages = ref<Message[]>([])
  const status = ref<ConversationStatus>('idle')
  const sessionId = ref<string>(loadSessionId())
  const error = ref<VoiceError | null>(null)

  function touchActivity(): void {
    writeStoredValue(LAST_ACTIVITY_KEY, String(Date.now()))
  }

  function rotateSessionIfExpired(): boolean {
    const lastActivityAt = readLastActivityAt()
    if (lastActivityAt === 0 || Date.now() - lastActivityAt <= SESSION_TTL_MS) {
      return false
    }

    sessionId.value = crypto.randomUUID()
    writeStoredValue(SESSION_ID_KEY, sessionId.value)
    messages.value = []
    touchActivity()
    return true
  }

  function addMessage(speaker: Speaker, text: string, action?: ChatAction): Message {
    const message: Message = {
      id: crypto.randomUUID(),
      speaker,
      text,
      createdAt: Date.now(),
    }
    if (action !== undefined) {
      message.action = action
    }
    messages.value.push(message)
    return message
  }

  function setStatus(next: ConversationStatus): void {
    status.value = next
  }

  function setError(next: VoiceError | null): void {
    error.value = next
  }

  function reset(): void {
    messages.value = []
    status.value = 'idle'
    error.value = null
  }

  return {
    messages,
    status,
    sessionId,
    error,
    touchActivity,
    rotateSessionIfExpired,
    addMessage,
    setStatus,
    setError,
    reset,
  }
})
