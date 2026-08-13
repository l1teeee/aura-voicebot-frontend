import type { ChatAction } from '../types/message'
import type { IdentifyResponse } from '../types/identity'

export interface ChatResponse {
  reply: string
  sessionId: string
  action?: ChatAction
}

export interface ChatGateway {
  identify(name: string): Promise<IdentifyResponse>
  sendMessage(message: string, sessionId: string, userId?: string): Promise<ChatResponse>
  checkHealth(): Promise<boolean>
}
