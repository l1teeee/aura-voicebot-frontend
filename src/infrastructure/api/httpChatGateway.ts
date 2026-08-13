import type { ChatGateway, ChatResponse } from '@/domain/ports/chat-gateway'
import {
  FavoriteCityError,
  type AddFavoriteCityResponse,
  type FavoriteCity,
  type ListFavoriteCitiesResponse,
  type RemoveFavoriteCityResponse,
} from '@/domain/types/favorite-city'
import type { IdentifyResponse } from '@/domain/types/identity'
import type { VoiceError } from '@/domain/types/voice-error'
import { ApiError, request } from './httpClient'

const RETRY_STATUS = 429
const RETRY_DELAY_MS = 5000
const CONFLICT_STATUS = 409
const UNKNOWN_FAVORITE_CITY_ERROR_MESSAGE = 'No se pudo completar la operacion de ciudades favoritas'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function toFavoriteCityError(error: unknown): FavoriteCityError {
  if (error instanceof FavoriteCityError) {
    return error
  }

  if (error instanceof ApiError) {
    if (error.status === CONFLICT_STATUS) {
      return new FavoriteCityError('duplicate', error.message)
    }
    if (error.code === 'NETWORK') {
      return new FavoriteCityError('network', error.message)
    }
    if (error.code === 'TIMEOUT') {
      return new FavoriteCityError('timeout', error.message)
    }
    return new FavoriteCityError('unknown', error.message)
  }

  const message = error instanceof Error ? error.message : UNKNOWN_FAVORITE_CITY_ERROR_MESSAGE
  return new FavoriteCityError('unknown', message)
}

async function favoriteCityRequest<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toFavoriteCityError(error)
  }
}

export class HttpChatGateway implements ChatGateway {
  async identify(name: string): Promise<IdentifyResponse> {
    return request<IdentifyResponse>('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  async sendMessage(message: string, sessionId: string, userId?: string): Promise<ChatResponse> {
    try {
      return await this.postChat(message, sessionId, userId)
    } catch (error) {
      if (error instanceof ApiError && error.status === RETRY_STATUS) {
        await wait(RETRY_DELAY_MS)
        return this.postChat(message, sessionId, userId)
      }
      throw error
    }
  }

  async addFavoriteCity(userId: string, city: string): Promise<AddFavoriteCityResponse> {
    return favoriteCityRequest(() =>
      request<AddFavoriteCityResponse>('/api/favorite-cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, city }),
      }),
    )
  }

  async listFavoriteCities(userId: string): Promise<FavoriteCity[]> {
    return favoriteCityRequest(async () => {
      const response = await request<ListFavoriteCitiesResponse>(
        `/api/favorite-cities/${encodeURIComponent(userId)}`,
      )
      return response.cities
    })
  }

  async removeFavoriteCity(id: string): Promise<RemoveFavoriteCityResponse> {
    return favoriteCityRequest(() =>
      request<RemoveFavoriteCityResponse>(`/api/favorite-cities/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    )
  }

  async checkHealth(): Promise<boolean> {
    try {
      const health = await request<{ status?: string }>('/api/health')
      return health.status === 'ok'
    } catch {
      return false
    }
  }

  private postChat(message: string, sessionId: string, userId?: string): Promise<ChatResponse> {
    const body: { message: string; sessionId: string; userId?: string } = { message, sessionId }
    if (userId) {
      body.userId = userId
    }

    return request<ChatResponse>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
}

export function toVoiceError(error: unknown): VoiceError {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return {
        code: 'rate-limited',
        message: 'Estas hablando muy rapido. Espera unos segundos y vuelve a intentarlo.',
        recoverable: true,
      }
    }
    if (error.status === 503) {
      return {
        code: 'service-unavailable',
        message: 'El servicio no esta disponible ahora mismo. Intentalo mas tarde.',
        recoverable: true,
      }
    }
    if (error.code === 'TIMEOUT') {
      return {
        code: 'request-timeout',
        message: 'Aura tardo demasiado en responder. Intentalo de nuevo.',
        recoverable: true,
      }
    }
    if (error.code === 'NETWORK') {
      return {
        code: 'network',
        message: 'No pude conectar con Aura. Revisa tu conexion.',
        recoverable: true,
      }
    }
    if (error.code === 'VALIDATION_ERROR' || error.status === 400) {
      return {
        code: 'validation',
        message: error.message,
        recoverable: true,
      }
    }
  }

  return {
    code: 'unknown',
    message: 'Algo salio mal. Intentalo de nuevo.',
    recoverable: true,
  }
}
