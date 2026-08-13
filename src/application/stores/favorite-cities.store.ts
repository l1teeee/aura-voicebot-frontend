import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { FavoriteCity } from '@/domain/types/favorite-city'
import type { VoiceError } from '@/domain/types/voice-error'

export const useFavoriteCitiesStore = defineStore('favorite-cities', () => {
  const cities = ref<FavoriteCity[]>([])
  const isLoading = ref(false)
  const error = ref<VoiceError | null>(null)
  const activeUserId = ref<string | null>(null)
  const invalidationVersion = ref(0)
  let requestVersion = 0

  function startRequest(userId: string): number {
    requestVersion += 1
    if (activeUserId.value !== userId) {
      cities.value = []
    }
    activeUserId.value = userId
    isLoading.value = true
    error.value = null
    return requestVersion
  }

  function isCurrentRequest(userId: string, version: number): boolean {
    return activeUserId.value === userId && requestVersion === version
  }

  function setCities(userId: string, version: number, nextCities: FavoriteCity[]): void {
    if (isCurrentRequest(userId, version)) {
      cities.value = nextCities
    }
  }

  function addCity(userId: string, version: number, city: FavoriteCity): void {
    if (!isCurrentRequest(userId, version)) return
    cities.value = [...cities.value.filter((candidate) => candidate.id !== city.id), city]
  }

  function removeCity(userId: string, version: number, id: string): void {
    if (!isCurrentRequest(userId, version)) return
    cities.value = cities.value.filter((city) => city.id !== id)
  }

  function setError(userId: string, version: number, nextError: VoiceError): void {
    if (isCurrentRequest(userId, version)) {
      error.value = nextError
    }
  }

  function finishRequest(userId: string, version: number): void {
    if (isCurrentRequest(userId, version)) {
      isLoading.value = false
    }
  }

  function dismissError(): void {
    error.value = null
  }

  function invalidate(): void {
    if (activeUserId.value === null) return
    invalidationVersion.value += 1
  }

  function clear(): void {
    requestVersion += 1
    cities.value = []
    isLoading.value = false
    error.value = null
    activeUserId.value = null
  }

  return {
    cities,
    isLoading,
    error,
    activeUserId,
    invalidationVersion,
    startRequest,
    isCurrentRequest,
    setCities,
    addCity,
    removeCity,
    setError,
    finishRequest,
    dismissError,
    invalidate,
    clear,
  }
})
