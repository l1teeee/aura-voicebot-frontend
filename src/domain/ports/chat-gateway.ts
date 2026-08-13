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

export interface ChatGateway {
  identify(name: string): Promise<IdentifyResponse>
  sendMessage(message: string, sessionId: string, userId?: string): Promise<ChatResponse>
  addFavoriteCity(userId: string, city: string): Promise<AddFavoriteCityResponse>
  listFavoriteCities(userId: string): Promise<FavoriteCity[]>
  removeFavoriteCity(id: string): Promise<RemoveFavoriteCityResponse>
  checkHealth(): Promise<boolean>
}
