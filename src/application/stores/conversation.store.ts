import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConversationStatus } from '@/domain/types/conversation-status'
import type { ChatAction, Conversation, Message, MessageRole } from '@/domain/types/message'
import type { VoiceError } from '@/domain/types/voice-error'

const SESSION_ID_KEY = 'aura.sessionId'
const LAST_ACTIVITY_KEY = 'aura.lastActivityAt'
const USER_ID_KEY = 'aura.userId'
const USER_NAME_KEY = 'aura.userName'
const IDENTITY_RESOLVED_KEY = 'aura.identityResolved'
const SESSION_TTL_MS = 30 * 60 * 1000

function readStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    return
  }
}

function removeStoredValue(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}

function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    return
  }
}

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function loadSessionId(): string {
  const stored = readSessionValue(SESSION_ID_KEY)
  const lastActivityAt = readLastActivityAt()
  const active = lastActivityAt > 0 && Date.now() - lastActivityAt <= SESSION_TTL_MS
  if (stored !== null && isUuidV4(stored) && active) {
    return stored
  }
  const created = crypto.randomUUID()
  writeSessionValue(SESSION_ID_KEY, created)
  return created
}

function readLastActivityAt(): number {
  const stored = readSessionValue(LAST_ACTIVITY_KEY)
  if (stored === null) {
    return 0
  }
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : 0
}

function hasActiveSession(): boolean {
  const storedSessionId = readSessionValue(SESSION_ID_KEY)
  const lastActivityAt = readLastActivityAt()
  return (
    storedSessionId !== null &&
    isUuidV4(storedSessionId) &&
    lastActivityAt > 0 &&
    Date.now() - lastActivityAt <= SESSION_TTL_MS
  )
}

export const useConversationStore = defineStore('conversation', () => {
  const messages = ref<Message[]>([])
  const status = ref<ConversationStatus>('idle')
  const sessionId = ref<string>(loadSessionId())
  const error = ref<VoiceError | null>(null)
  const userId = ref<string | null>(readStoredValue(USER_ID_KEY))
  const userName = ref<string | null>(readStoredValue(USER_NAME_KEY))
  const sessionActive = ref(hasActiveSession())
  const identityResolved = ref(
    sessionActive.value && readStoredValue(IDENTITY_RESOLVED_KEY) === 'true',
  )

  function touchActivity(): void {
    writeSessionValue(LAST_ACTIVITY_KEY, String(Date.now()))
    sessionActive.value = true
  }

  function rotateSessionIfExpired(): boolean {
    const lastActivityAt = readLastActivityAt()
    if (lastActivityAt === 0 || Date.now() - lastActivityAt <= SESSION_TTL_MS) {
      return false
    }

    sessionId.value = crypto.randomUUID()
    writeSessionValue(SESSION_ID_KEY, sessionId.value)
    messages.value = []
    sessionActive.value = false
    identityResolved.value = false
    writeStoredValue(IDENTITY_RESOLVED_KEY, 'false')
    return true
  }

  function addMessage(role: MessageRole, text: string, action?: ChatAction, createdAt = new Date().toISOString(), messageSessionId = sessionId.value): Message {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      sessionId: messageSessionId,
      text,
      createdAt,
    }
    if (action !== undefined) {
      message.action = action
    }
    messages.value.push(message)
    return message
  }

  function loadConversations(conversations: Conversation[]): void {
    messages.value = conversations.flatMap((conversation) =>
      conversation.messages.map((message) => addMessage(message.role, message.text, undefined, message.createdAt, conversation.sessionId)),
    )
    const latest = conversations[conversations.length - 1]
    if (latest && isUuidV4(latest.sessionId)) {
      sessionId.value = latest.sessionId
      writeSessionValue(SESSION_ID_KEY, latest.sessionId)
    }
  }

  function setIdentity(id: string | null, name: string | null): void {
    userId.value = id || null
    userName.value = name?.trim() || null
    if (userId.value) writeStoredValue(USER_ID_KEY, userId.value)
    else removeStoredValue(USER_ID_KEY)
    if (userName.value) writeStoredValue(USER_NAME_KEY, userName.value)
    else removeStoredValue(USER_NAME_KEY)
    identityResolved.value = true
    sessionActive.value = true
    writeStoredValue(IDENTITY_RESOLVED_KEY, 'true')
  }

  function startNewConversation(): void {
    sessionId.value = crypto.randomUUID()
    writeSessionValue(SESSION_ID_KEY, sessionId.value)
    messages.value = []
    status.value = 'idle'
    error.value = null
    touchActivity()
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
    loadConversations,
    setStatus,
    setError,
    userId,
    userName,
    sessionActive,
    identityResolved,
    setIdentity,
    startNewConversation,
    reset,
  }
})
