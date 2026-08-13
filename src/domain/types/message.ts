export type Speaker = 'user' | 'assistant'

export interface WeatherData {
  city: string
  country: string
  temperature: number
  feelsLike: number
  description: string
  humidity: number
  units: string
}

export interface WeatherAction {
  type: 'weather_lookup'
  data: WeatherData
}

export type ChatAction = WeatherAction

export interface Message {
  id: string
  speaker: Speaker
  text: string
  action?: ChatAction
  createdAt: number
}
