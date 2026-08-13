import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConversationStatus } from '@/domain/types/conversation-status'
import type { BackendMessage, ChatAction, Conversation, Message, MessageRole } from '@/domain/types/message'
import type { VoiceError } from '@/domain/types/voice-error'

const SESSION_ID_KEY = 'aura.sessionId'
const LAST_ACTIVITY_KEY = 'aura.lastActivityAt'
const USER_ID_KEY = 'aura.userId'
const USER_NAME_KEY = 'aura.userName'
const IDENTITY_RESOLVED_KEY = 'aura.identityResolved'
const HISTORY_KEY_PREFIX = 'aura.conversations.'
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

function removeSessionValue(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    return
  }
}

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function readLastActivityAt(): number {
  const stored = readSessionValue(LAST_ACTIVITY_KEY)
  if (stored === null) {
    return 0
  }
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : 0
}

function loadSessionId(): string {
  const stored = readSessionValue(SESSION_ID_KEY)
  const lastActivityAt = readLastActivityAt()
  const active = lastActivityAt > 0 && Date.now() - lastActivityAt <= SESSION_TTL_MS
  if (stored !== null && isUuidV4(stored) && active) {
    return stored
  }
  return crypto.randomUUID()
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

function historyKey(userId: string): string {
  return `${HISTORY_KEY_PREFIX}${encodeURIComponent(userId)}`
}

function isChatAction(value: unknown): value is ChatAction {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const { type, data } = value as { type?: unknown; data?: unknown }
  if (type === 'favorite_city_added' || type === 'interaction_log') {
    return true
  }

  if (type !== 'weather_lookup') {
    return false
  }

  if (typeof data !== 'object' || data === null) {
    return false
  }

  const weather = data as Record<string, unknown>
  return (
    typeof weather.city === 'string' &&
    typeof weather.country === 'string' &&
    typeof weather.temperature === 'number' &&
    typeof weather.feelsLike === 'number' &&
    typeof weather.description === 'string' &&
    typeof weather.humidity === 'number' &&
    typeof weather.units === 'string'
  )
}

function normalizeMessage(value: unknown): BackendMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const { role, text, createdAt, action } = value as Partial<BackendMessage>
  if ((role !== 'user' && role !== 'bot') || typeof text !== 'string' || typeof createdAt !== 'string') {
    return null
  }

  if (action === undefined || isChatAction(action)) {
    return action === undefined ? { role, text, createdAt } : { role, text, createdAt, action }
  }
  return { role, text, createdAt }
}

function normalizeConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  return value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) {
      return []
    }

    const { sessionId, startedAt, messages } = candidate as Partial<Conversation>
    if (
      typeof sessionId !== 'string' ||
      !isUuidV4(sessionId) ||
      typeof startedAt !== 'string' ||
      !Array.isArray(messages) ||
      seen.has(sessionId)
    ) {
      return []
    }

    const normalizedMessages = messages.reduce<BackendMessage[]>((result, message) => {
      const normalized = normalizeMessage(message)
      if (normalized) {
        result.push(normalized)
      }
      return result
    }, [])

    seen.add(sessionId)
    return [{ sessionId, startedAt, messages: normalizedMessages }]
  })
}

function loadLocalConversations(userId: string | null): Conversation[] {
  if (!userId) {
    return []
  }

  const stored = readStoredValue(historyKey(userId))
  if (stored === null) {
    return []
  }

  try {
    return normalizeConversations(JSON.parse(stored))
  } catch {
    removeStoredValue(historyKey(userId))
    return []
  }
}

export const useConversationStore = defineStore('conversation', () => {
  const status = ref<ConversationStatus>('idle')
  const sessionId = ref<string>(loadSessionId())
  const error = ref<VoiceError | null>(null)
  const userId = ref<string | null>(readStoredValue(USER_ID_KEY))
  const userName = ref<string | null>(readStoredValue(USER_NAME_KEY))
  const sessionActive = ref(hasActiveSession())
  const identityResolved = ref(
    (sessionActive.value && readSessionValue(IDENTITY_RESOLVED_KEY) === 'true') ||
      Boolean(userId.value && userName.value),
  )
  const conversations = ref<Conversation[]>(loadLocalConversations(userId.value))
  const activeConversation = computed(
    () => conversations.value.find((conversation) => conversation.sessionId === sessionId.value) ?? null,
  )
  const messages = computed<Message[]>(() =>
    (activeConversation.value?.messages ?? []).map((message, index) => {
      const normalized: Message = {
        id: `${sessionId.value}:${index}:${message.createdAt}`,
        role: message.role,
        sessionId: sessionId.value,
        text: message.text,
        createdAt: message.createdAt,
      }
      if (message.action !== undefined) {
        normalized.action = message.action
      }
      return normalized
    }),
  )

  function persistLocalHistory(): void {
    if (userId.value) {
      writeStoredValue(historyKey(userId.value), JSON.stringify(conversations.value))
    }
  }

  function touchActivity(): void {
    writeSessionValue(SESSION_ID_KEY, sessionId.value)
    writeSessionValue(LAST_ACTIVITY_KEY, String(Date.now()))
    writeSessionValue(IDENTITY_RESOLVED_KEY, String(identityResolved.value))
    sessionActive.value = true
  }

  function rotateSessionIfExpired(): boolean {
    const lastActivityAt = readLastActivityAt()
    if (lastActivityAt === 0 || Date.now() - lastActivityAt <= SESSION_TTL_MS) {
      return false
    }

    sessionId.value = crypto.randomUUID()
    writeSessionValue(SESSION_ID_KEY, sessionId.value)
    sessionActive.value = false
    identityResolved.value = Boolean(userId.value && userName.value)
    writeSessionValue(IDENTITY_RESOLVED_KEY, String(identityResolved.value))
    return true
  }

  function addMessage(
    role: MessageRole,
    text: string,
    action?: ChatAction,
    createdAt = new Date().toISOString(),
    messageSessionId = sessionId.value,
  ): Message {
    const message: BackendMessage = { role, text, createdAt }
    if (action !== undefined) {
      message.action = action
    }

    const conversation = conversations.value.find((entry) => entry.sessionId === messageSessionId)
    if (conversation) {
      conversation.messages.push(message)
    } else {
      conversations.value.push({ sessionId: messageSessionId, startedAt: createdAt, messages: [message] })
    }
    persistLocalHistory()

    const result: Message = {
      id: `${messageSessionId}:${conversations.value.length}:${createdAt}`,
      role,
      sessionId: messageSessionId,
      text,
      createdAt,
    }
    if (action !== undefined) {
      result.action = action
    }
    return result
  }

  function loadConversations(nextConversations: Conversation[]): void {
    conversations.value = normalizeConversations(nextConversations)
    persistLocalHistory()
  }

  function selectConversation(nextSessionId: string): boolean {
    if (!conversations.value.some((conversation) => conversation.sessionId === nextSessionId)) {
      return false
    }

    sessionId.value = nextSessionId
    touchActivity()
    return true
  }

  function setIdentity(id: string | null, name: string | null): void {
    const normalizedId = id?.trim() || null
    const normalizedName = name?.trim() || null
    if (userId.value && userId.value !== normalizedId) {
      conversations.value = []
    }

    userId.value = normalizedId
    userName.value = normalizedName
    if (userId.value) writeStoredValue(USER_ID_KEY, userId.value)
    else removeStoredValue(USER_ID_KEY)
    if (userName.value) writeStoredValue(USER_NAME_KEY, userName.value)
    else removeStoredValue(USER_NAME_KEY)
    identityResolved.value = true
    touchActivity()
  }

  function startNewConversation(): void {
    sessionId.value = crypto.randomUUID()
    writeSessionValue(SESSION_ID_KEY, sessionId.value)
    status.value = 'idle'
    error.value = null
    touchActivity()
  }

  function removeConversation(targetSessionId: string): void {
    const exists = conversations.value.some((conversation) => conversation.sessionId === targetSessionId)
    if (!exists) return

    const wasActive = sessionId.value === targetSessionId
    conversations.value = conversations.value.filter(
      (conversation) => conversation.sessionId !== targetSessionId,
    )
    persistLocalHistory()

    if (wasActive) {
      startNewConversation()
    }
  }

  function setStatus(next: ConversationStatus): void {
    status.value = next
  }

  function setError(next: VoiceError | null): void {
    error.value = next
  }

  function reset(): void {
    status.value = 'idle'
    error.value = null
  }

  function logout(): void {
    if (userId.value) {
      removeStoredValue(historyKey(userId.value))
    }
    removeStoredValue(USER_ID_KEY)
    removeStoredValue(USER_NAME_KEY)
    removeStoredValue(IDENTITY_RESOLVED_KEY)
    removeSessionValue(SESSION_ID_KEY)
    removeSessionValue(LAST_ACTIVITY_KEY)
    removeSessionValue(IDENTITY_RESOLVED_KEY)
    userId.value = null
    userName.value = null
    conversations.value = []
    sessionId.value = crypto.randomUUID()
    sessionActive.value = false
    identityResolved.value = false
    status.value = 'idle'
    error.value = null
  }

  return {
    messages,
    conversations,
    activeConversation,
    status,
    sessionId,
    error,
    touchActivity,
    rotateSessionIfExpired,
    addMessage,
    loadConversations,
    selectConversation,
    setStatus,
    setError,
    userId,
    userName,
    sessionActive,
    identityResolved,
    setIdentity,
    startNewConversation,
    removeConversation,
    reset,
    logout,
  }
})
