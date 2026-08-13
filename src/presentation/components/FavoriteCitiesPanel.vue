<script setup lang="ts">
import { ChevronDown, MapPin, X } from 'lucide'
import type { FavoriteCity, VoiceError } from '@/domain/types'
import ErrorNotice from './ErrorNotice.vue'

withDefaults(defineProps<{
  cities: readonly FavoriteCity[]
  isLoading?: boolean
  error?: VoiceError | null
}>(), {
  isLoading: false,
  error: null,
})

const emit = defineEmits<{
  remove: [id: string]
  retry: []
  dismiss: []
}>()
</script>

<template>
  <details class="group overflow-hidden rounded-control border border-edge bg-canvas">
    <summary class="flex min-h-[44px] list-none items-center justify-between gap-2 px-3 py-2 text-ink marker:hidden">
      <span class="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <MapPin
          :size="17"
          :stroke-width="1.8"
          aria-hidden="true"
          class="shrink-0 text-accent"
        />
        <span class="truncate">Ciudades favoritas</span>
        <span class="rounded-chip bg-surface px-2 py-0.5 text-xs text-muted">
          {{ cities.length }}
        </span>
      </span>
      <ChevronDown
        :size="17"
        :stroke-width="1.8"
        aria-hidden="true"
        class="shrink-0 text-muted transition-transform group-open:rotate-180"
      />
    </summary>

    <div
      class="border-t border-edge p-3"
      :aria-busy="isLoading"
    >
      <ErrorNotice
        class="mb-3"
        :error="error"
        @retry="emit('retry')"
        @dismiss="emit('dismiss')"
      />

      <p
        v-if="isLoading"
        role="status"
        class="py-3 text-center text-sm text-muted"
      >
        Cargando ciudades...
      </p>

      <ul
        v-else-if="cities.length"
        class="space-y-1.5"
        aria-label="Ciudades favoritas guardadas"
      >
        <li
          v-for="favorite in cities"
          :key="favorite.id"
          class="flex min-h-[40px] items-center justify-between gap-2 rounded-control border border-edge bg-surface py-1 pl-3 pr-1"
        >
          <span class="min-w-0 truncate text-sm font-medium text-ink">
            {{ favorite.city }}
          </span>
          <button
            type="button"
            class="grid h-9 w-9 shrink-0 place-items-center rounded-control text-muted hover:bg-canvas hover:text-accent-active disabled:cursor-not-allowed disabled:opacity-50"
            :aria-label="`Quitar ${favorite.city} de ciudades favoritas`"
            :disabled="isLoading"
            @click="emit('remove', favorite.id)"
          >
            <X
              :size="16"
              :stroke-width="1.8"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>

      <p
        v-else
        class="py-3 text-center text-sm leading-relaxed text-muted"
      >
        Di "guarda esta ciudad" durante la conversación para verla aquí.
      </p>
    </div>
  </details>
</template>
