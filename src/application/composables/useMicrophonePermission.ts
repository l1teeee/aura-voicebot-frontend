import { computed, onUnmounted, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { MicPermissionState } from '@/domain/types/mic-permission-state'

export interface UseMicrophonePermissionReturn {
  state: Ref<MicPermissionState>
  isSecureContext: boolean
  isGranted: ComputedRef<boolean>
  request: () => Promise<MicPermissionState>
  checkOnMount: () => Promise<void>
}

function detectSecureContext(): boolean {
  return window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

function mapPermissionState(value: PermissionState): MicPermissionState {
  if (value === 'granted') return 'granted'
  if (value === 'denied') return 'denied'
  return 'prompt'
}

function mapGetUserMediaError(error: unknown): MicPermissionState {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'NotReadableError':
    case 'AbortError':
      return 'unavailable'
    default:
      return 'unavailable'
  }
}

export function useMicrophonePermission(): UseMicrophonePermissionReturn {
  const state = ref<MicPermissionState>('unknown')
  const isSecureContext = detectSecureContext()
  let permissionStatus: PermissionStatus | null = null

  const handlePermissionChange = (): void => {
    if (permissionStatus) {
      state.value = mapPermissionState(permissionStatus.state)
    }
  }

  const checkOnMount = async (): Promise<void> => {
    if (!isSecureContext) {
      state.value = 'unavailable'
      return
    }
    if (!navigator.permissions?.query) {
      return
    }
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      permissionStatus = status
      state.value = mapPermissionState(status.state)
      status.addEventListener('change', handlePermissionChange)
    } catch {
      state.value = 'unknown'
    }
  }

  const request = async (): Promise<MicPermissionState> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      state.value = 'granted'
      return 'granted'
    } catch (error) {
      const next = mapGetUserMediaError(error)
      state.value = next
      return next
    }
  }

  onUnmounted(() => {
    permissionStatus?.removeEventListener('change', handlePermissionChange)
  })

  const isGranted = computed(() => state.value === 'granted')

  return {
    state,
    isSecureContext,
    isGranted,
    request,
    checkOnMount,
  }
}
