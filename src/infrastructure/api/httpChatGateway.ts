import type { ChatGateway, ChatResponse } from '@/domain/ports/chat-gateway'
import type { VoiceError } from '@/domain/types/voice-error'
import { ApiError, request } from './httpClient'

const RETRY_STATUS = 429
const RETRY_DELAY_MS = 5000

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export class HttpChatGateway implements ChatGateway {
  async sendMessage(message: string, sessionId: string): Promise<ChatResponse> {
    try {
      return await this.postChat(message, sessionId)
    } catch (error) {
      if (error instanceof ApiError && error.status === RETRY_STATUS) {
        await wait(RETRY_DELAY_MS)
        return this.postChat(message, sessionId)
      }
      throw error
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const health = await request<{ status?: string }>('/api/health')
      return health.status === 'ok'
    } catch {
      return false
    }
  }

  private postChat(message: string, sessionId: string): Promise<ChatResponse> {
    return request<ChatResponse>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
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
        message: 'Algo en tu mensaje no era valido. Intentalo de nuevo.',
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
