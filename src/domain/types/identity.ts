import type { Conversation } from './message'

export interface IdentifyResponse {
  userId: string
  isReturning: boolean
  conversations: Conversation[]
}
