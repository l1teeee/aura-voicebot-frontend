import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type { Message, WeatherData } from '@/domain/types/message'
import { useConversationStore } from '@/application/stores/conversation.store'
import type { UseFavoriteCitiesReturn } from './useFavoriteCities'

export type SaveFavoriteCityStatus = 'idle' | 'pending' | 'saved'

export interface FavoriteCityCard {
  weather: WeatherData
  canSave: boolean
  status: SaveFavoriteCityStatus
  errorMessage: string | null
}

export interface UseFavoriteCityPromptReturn {
  card: ComputedRef<FavoriteCityCard | null>
  save: () => Promise<void>
  dismiss: () => void
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase()
}

export function useFavoriteCityPrompt(favorites: UseFavoriteCitiesReturn): UseFavoriteCityPromptReturn {
  const conversationStore = useConversationStore()

  const dismissedMessageId = ref<string | null>(null)
  const pendingMessageId = ref<string | null>(null)
  const savedMessageId = ref<string | null>(null)
  const saveFailedMessageId = ref<string | null>(null)

  const latestWeatherMessage = computed<Message | null>(() => {
    const latest = conversationStore.messages.at(-1)
    return latest && latest.role === 'bot' && latest.action?.type === 'weather_lookup' ? latest : null
  })

  watch(latestWeatherMessage, (message, previous) => {
    if (message?.id === previous?.id) return
    dismissedMessageId.value = null
    saveFailedMessageId.value = null
  })

  const card = computed<FavoriteCityCard | null>(() => {
    const message = latestWeatherMessage.value
    if (!message || !message.action || message.action.type !== 'weather_lookup') {
      return null
    }

    const weather = message.action.data
    const alreadyFavorite = favorites.cities.value.some(
      (favorite) => normalizeCity(favorite.city) === normalizeCity(weather.city),
    )
    const status: SaveFavoriteCityStatus =
      savedMessageId.value === message.id
        ? 'saved'
        : pendingMessageId.value === message.id
          ? 'pending'
          : 'idle'

    return {
      weather,
      canSave:
        conversationStore.userId !== null &&
        !alreadyFavorite &&
        dismissedMessageId.value !== message.id &&
        status !== 'saved',
      status,
      errorMessage:
        saveFailedMessageId.value === message.id ? favorites.error.value?.message ?? null : null,
    }
  })

  async function save(): Promise<void> {
    const message = latestWeatherMessage.value
    const userId = conversationStore.userId
    if (!message || !message.action || message.action.type !== 'weather_lookup' || userId === null) {
      return
    }

    saveFailedMessageId.value = null
    pendingMessageId.value = message.id
    const success = await favorites.add(userId, message.action.data.city)
    pendingMessageId.value = null

    if (success) {
      savedMessageId.value = message.id
    } else {
      saveFailedMessageId.value = message.id
    }
  }

  function dismiss(): void {
    const message = latestWeatherMessage.value
    if (message) {
      dismissedMessageId.value = message.id
    }
  }

  return { card, save, dismiss }
}
