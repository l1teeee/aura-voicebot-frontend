export type MessageRole = 'user' | 'bot'
export type Speaker = MessageRole

export type BackendMessageRole = 'user' | 'bot'

export interface BackendMessage {
  role: BackendMessageRole
  text: string
  createdAt: string
}

export interface Conversation {
  sessionId: string
  startedAt: string
  messages: BackendMessage[]
}

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
  role: MessageRole
  sessionId: string
  text: string
  action?: ChatAction
  createdAt: string
}
