<script setup lang="ts">
import { computed } from 'vue'
import { useVoiceConversation } from '@/application/composables/useVoiceConversation'
import MicPermissionAlert from '@/presentation/components/MicPermissionAlert.vue'
import ErrorNotice from '@/presentation/components/ErrorNotice.vue'
import StatusIndicator from '@/presentation/components/StatusIndicator.vue'
import AudioVisualizer from '@/presentation/components/AudioVisualizer.vue'
import VoiceButton from '@/presentation/components/VoiceButton.vue'
import TextFallbackInput from '@/presentation/components/TextFallbackInput.vue'
import TranscriptList from '@/presentation/components/TranscriptList.vue'
import EmptyState from '@/presentation/components/EmptyState.vue'

const {
  status,
  messages,
  error,
  interimTranscript,
  audioLevel,
  micPermission,
  isSecureContext,
  isRequestingPermission,
  needsTextFallback,
  toggle,
  requestMicPermission,
  sendText,
  dismissError,
} = useVoiceConversation()

const isEmpty = computed(() => messages.value.length === 0 && interimTranscript.value.length === 0)
const micBlocked = computed(() => micPermission.value !== 'granted' || !isSecureContext)
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-[640px] flex-col">
    <header class="px-6 pb-4 pt-8">
      <h1 class="font-serif text-xl font-medium text-ink">
        Aura
      </h1>
      <p class="mt-1 text-sm text-muted">
        Tu asistente de voz para el clima y mucho más.
      </p>
    </header>

    <main class="min-h-0 flex-1 overflow-hidden px-6 py-4">
      <EmptyState v-if="isEmpty" />
      <TranscriptList
        v-else
        :messages="messages"
        :interim-transcript="interimTranscript"
      />
    </main>

    <div class="sticky bottom-0 space-y-3 bg-canvas px-6 pb-6 pt-3">
      <MicPermissionAlert
        v-if="micBlocked"
        :state="micPermission"
        :is-secure-context="isSecureContext"
        :busy="isRequestingPermission"
        @request="requestMicPermission"
      />
      <ErrorNotice
        :error="error"
        @retry="toggle"
        @dismiss="dismissError"
      />
      <StatusIndicator
        :status="status"
        :error-message="error?.message"
      />
      <div class="flex items-center justify-center gap-4">
        <AudioVisualizer
          :level="audioLevel"
          :active="status === 'listening'"
        />
        <VoiceButton
          :status="status"
          :disabled="micBlocked"
          disabled-reason="Concede el acceso al micrófono para poder hablar"
          @activate="toggle"
        />
      </div>
      <TextFallbackInput
        v-if="needsTextFallback"
        @submit="sendText"
      />
    </div>
  </div>
</template>
