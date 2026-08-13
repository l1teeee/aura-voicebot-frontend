import type { ChatAction } from '../types/message'
import type { IdentifyResponse } from '../types/identity'
import type {
  AddFavoriteCityResponse,
  FavoriteCity,
  RemoveFavoriteCityResponse,
} from '../types/favorite-city'

export interface ChatResponse {
  reply: string
  sessionId: string
  action?: ChatAction
}

export interface ChatImagePayload {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  data: string
}

export interface ChatGateway {
  identify(name: string): Promise<IdentifyResponse>
  sendMessage(
    message: string,
    sessionId: string,
    userId?: string,
    image?: ChatImagePayload,
  ): Promise<ChatResponse>
  addFavoriteCity(userId: string, city: string): Promise<AddFavoriteCityResponse>
  listFavoriteCities(userId: string): Promise<FavoriteCity[]>
  removeFavoriteCity(id: string): Promise<RemoveFavoriteCityResponse>
  checkHealth(): Promise<boolean>
}
