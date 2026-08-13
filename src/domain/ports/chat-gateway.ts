import type { ChatAction } from '../types/message'

export interface ChatResponse {
  reply: string
  sessionId: string
  action?: ChatAction
}

export interface ChatGateway {
  sendMessage(message: string, sessionId: string): Promise<ChatResponse>
  checkHealth(): Promise<boolean>
}
