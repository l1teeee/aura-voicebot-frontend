const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL

export const env = {
  apiBaseUrl: (configuredApiBaseUrl ?? 'http://localhost:3000').replace(/\/+$/, ''),
  requestTimeoutMs: 20000,
} as const
