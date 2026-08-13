export interface FavoriteCity {
  id: string
  city: string
  createdAt: string
}

export type AddFavoriteCityResponse = FavoriteCity

export interface ListFavoriteCitiesResponse {
  cities: FavoriteCity[]
}

export type RemoveFavoriteCityResponse = void

export type FavoriteCityErrorCode = 'duplicate' | 'network' | 'timeout' | 'unknown'

export class FavoriteCityError extends Error {
  readonly code: FavoriteCityErrorCode

  constructor(code: FavoriteCityErrorCode, message: string) {
    super(message)
    this.name = 'FavoriteCityError'
    this.code = code
  }
}
