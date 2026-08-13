import { computed, inject, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { chatGatewayKey } from '@/config/injection'
import type { FavoriteCity, FavoriteCityError } from '@/domain/types/favorite-city'
import type { VoiceError } from '@/domain/types/voice-error'
import { useConversationStore } from '@/application/stores/conversation.store'
import { useFavoriteCitiesStore } from '@/application/stores/favorite-cities.store'

const DUPLICATE_ERROR: VoiceError = {
  code: 'validation',
  message: 'Esa ciudad ya está en tus favoritas.',
  recoverable: true,
}

const NETWORK_ERROR: VoiceError = {
  code: 'network',
  message: 'No pude actualizar tus ciudades favoritas. Revisa tu conexion.',
  recoverable: true,
}

const TIMEOUT_ERROR: VoiceError = {
  code: 'request-timeout',
  message: 'La solicitud de ciudades favoritas tardo demasiado. Intentalo de nuevo.',
  recoverable: true,
}

const UNKNOWN_ERROR: VoiceError = {
  code: 'unknown',
  message: 'No pude actualizar tus ciudades favoritas. Intentalo de nuevo.',
  recoverable: true,
}

function favoriteCityErrorCode(error: unknown): FavoriteCityError['code'] | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const code = error.code
  return code === 'duplicate' || code === 'network' || code === 'timeout' || code === 'unknown'
    ? code
    : null
}

function toVoiceError(error: unknown): VoiceError {
  switch (favoriteCityErrorCode(error)) {
    case 'duplicate':
      return DUPLICATE_ERROR
    case 'network':
      return NETWORK_ERROR
    case 'timeout':
      return TIMEOUT_ERROR
    default:
      return UNKNOWN_ERROR
  }
}

export interface UseFavoriteCitiesReturn {
  cities: ComputedRef<FavoriteCity[]>
  isLoading: ComputedRef<boolean>
  error: ComputedRef<VoiceError | null>
  load: (userId: string) => Promise<void>
  add: (userId: string, city: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  dismissError: () => void
}

export function useFavoriteCities(): UseFavoriteCitiesReturn {
  const injectedGateway = inject(chatGatewayKey)
  if (injectedGateway === undefined) {
    throw new Error('Falta el ChatGateway: registralo con app.provide(chatGatewayKey, new HttpChatGateway())')
  }
  const gateway = injectedGateway

  const conversationStore = useConversationStore()
  const store = useFavoriteCitiesStore()

  async function load(userId: string): Promise<void> {
    const normalizedUserId = userId.trim()
    if (normalizedUserId === '') {
      store.clear()
      return
    }

    const version = store.startRequest(normalizedUserId)
    try {
      const cities = await gateway.listFavoriteCities(normalizedUserId)
      store.setCities(normalizedUserId, version, cities)
    } catch (error) {
      store.setError(normalizedUserId, version, toVoiceError(error))
    } finally {
      store.finishRequest(normalizedUserId, version)
    }
  }

  async function add(userId: string, city: string): Promise<boolean> {
    const normalizedUserId = userId.trim()
    const normalizedCity = city.trim()
    if (normalizedUserId === '' || normalizedCity === '') return false

    const version = store.startRequest(normalizedUserId)
    try {
      const favorite = await gateway.addFavoriteCity(normalizedUserId, normalizedCity)
      if (!store.isCurrentRequest(normalizedUserId, version)) return false
      store.addCity(normalizedUserId, version, favorite)
      return true
    } catch (error) {
      store.setError(normalizedUserId, version, toVoiceError(error))
      return false
    } finally {
      store.finishRequest(normalizedUserId, version)
    }
  }

  async function remove(id: string): Promise<boolean> {
    const normalizedId = id.trim()
    const userId = store.activeUserId
    if (normalizedId === '' || userId === null) return false

    const version = store.startRequest(userId)
    try {
      await gateway.removeFavoriteCity(normalizedId)
      if (!store.isCurrentRequest(userId, version)) return false
      store.removeCity(userId, version, normalizedId)
      return true
    } catch (error) {
      store.setError(userId, version, toVoiceError(error))
      return false
    } finally {
      store.finishRequest(userId, version)
    }
  }

  watch(
    () => conversationStore.userId,
    (userId) => {
      if (userId === null) {
        store.clear()
        return
      }
      if (store.activeUserId !== userId) {
        store.clear()
      }
      void load(userId)
    },
    { immediate: true },
  )

  watch(
    () => store.invalidationVersion,
    () => {
      const userId = conversationStore.userId
      if (userId !== null) {
        void load(userId)
      }
    },
  )

  return {
    cities: computed(() => store.cities),
    isLoading: computed(() => store.isLoading),
    error: computed(() => store.error),
    load,
    add,
    remove,
    dismissError: store.dismissError,
  }
}
