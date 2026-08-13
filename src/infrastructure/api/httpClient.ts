import { env } from '@/config/env'

const DEFAULT_ERROR_CODE = 'INTERNAL_ERROR'
const DEFAULT_ERROR_MESSAGE = 'El servidor devolvio una respuesta inesperada'

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

async function readApiError(response: Response): Promise<ApiError> {
  let code = DEFAULT_ERROR_CODE
  let message = DEFAULT_ERROR_MESSAGE

  try {
    const payload = asRecord(await response.json())
    const detail = payload === null ? null : asRecord(payload.error)
    if (detail !== null) {
      if (typeof detail.code === 'string') {
        code = detail.code
      }
      if (typeof detail.message === 'string') {
        message = detail.message
      }
    }
  } catch {
    return new ApiError(DEFAULT_ERROR_CODE, response.status, DEFAULT_ERROR_MESSAGE)
  }

  return new ApiError(code, response.status, message)
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, env.requestTimeoutMs)

  try {
    let response: Response

    try {
      response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, signal: controller.signal })
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError('TIMEOUT', 0, 'La peticion supero el tiempo de espera')
      }
      throw new ApiError('NETWORK', 0, 'No se pudo conectar con el servidor')
    }

    if (!response.ok) {
      throw await readApiError(response)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}
