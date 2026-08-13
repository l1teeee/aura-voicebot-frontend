<script setup lang="ts">
import { computed } from 'vue'
import type { MicPermissionState } from '@/domain/types/mic-permission-state'

const props = defineProps<{ state: MicPermissionState; isSecureContext: boolean; busy?: boolean }>()
const emit = defineEmits<{ (e: 'request'): void }>()

const isVisible = computed<boolean>(() => !(props.isSecureContext && props.state === 'granted'))

const message = computed<string>(() => {
  if (!props.isSecureContext) {
    return 'El microfono solo funciona en conexiones seguras. Abre Aura con https o desde localhost.'
  }
  if (props.state === 'denied') {
    return 'El acceso al microfono esta bloqueado. Activalo desde el icono de la barra de direcciones y vuelve a intentarlo.'
  }
  if (props.state === 'unavailable') {
    return 'No detectamos ningun microfono disponible. Revisa que este conectado y que ninguna otra aplicacion lo este usando.'
  }
  if (props.state === 'granted') {
    return ''
  }
  return 'Aura necesita acceso a tu microfono para escucharte.'
})

const actionLabel = computed<string>(() => {
  if (!props.isSecureContext || props.state === 'granted') {
    return ''
  }
  if (props.busy) {
    return 'Comprobando…'
  }
  return props.state === 'denied' || props.state === 'unavailable' ? 'Reintentar' : 'Permitir microfono'
})

const showDeniedHelp = computed<boolean>(() => props.isSecureContext && props.state === 'denied')
</script>

<template>
  <div
    v-if="isVisible"
    role="alert"
    aria-live="assertive"
    class="flex items-start gap-3 rounded-card border border-alert-edge bg-alert-surface p-4 shadow-subtle"
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-5 w-5 shrink-0 text-accent"
    >
      <rect
        x="9"
        y="2"
        width="6"
        height="11"
        rx="3"
      />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1" />
      <line
        x1="12"
        y1="18"
        x2="12"
        y2="22"
      />
      <line
        x1="8"
        y1="22"
        x2="16"
        y2="22"
      />
      <line
        x1="3"
        y1="3"
        x2="21"
        y2="21"
      />
    </svg>
    <div class="flex flex-1 flex-col gap-3">
      <p class="text-sm text-ink">
        {{ message }}
      </p>
      <details
        v-if="showDeniedHelp"
        class="text-xs text-muted"
      >
        <summary class="cursor-pointer select-none font-medium">
          Como reactivarlo
        </summary>
        <ul class="mt-2 space-y-1">
          <li>Chrome: toca el candado o el icono de microfono junto a la barra de direcciones, elige Permitir y recarga la pagina.</li>
          <li>Edge: toca el candado junto a la barra de direcciones, activa el permiso de microfono y recarga la pagina.</li>
          <li>Safari: abre los ajustes de este sitio (icono aA o menu Safari) y activa el permiso de microfono.</li>
        </ul>
      </details>
      <button
        v-if="actionLabel"
        type="button"
        :disabled="busy"
        class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-alert-edge bg-canvas px-4 text-sm font-medium text-ink shadow-subtle transition-[background-color,opacity,transform] duration-200 hover:bg-surface active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        @click="emit('request')"
      >
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>
