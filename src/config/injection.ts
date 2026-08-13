import type { InjectionKey } from 'vue'
import type { ChatGateway } from '@/domain/ports/chat-gateway'

export const chatGatewayKey: InjectionKey<ChatGateway> = Symbol('ChatGateway')
