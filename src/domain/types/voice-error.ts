export type VoiceErrorCode =
  | 'recognition-unsupported'
  | 'synthesis-unsupported'
  | 'insecure-context'
  | 'permission-denied'
  | 'no-microphone'
  | 'microphone-busy'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'request-timeout'
  | 'rate-limited'
  | 'service-unavailable'
  | 'validation'
  | 'unknown'

export interface VoiceError {
  code: VoiceErrorCode
  message: string
  recoverable: boolean
}
