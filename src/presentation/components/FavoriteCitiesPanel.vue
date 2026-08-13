<script setup lang="ts">
import { computed, ref } from 'vue'
import { MapPin, X } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import type { FavoriteCity, VoiceError } from '@/domain/types'
import ErrorNotice from './ErrorNotice.vue'

const props = withDefaults(defineProps<{
  cities: readonly FavoriteCity[]
  isLoading?: boolean
  error?: VoiceError | null
}>(), {
  isLoading: false,
  error: null,
})

const emit = defineEmits<{
  remove: [id: string]
  ask: [city: string]
  retry: []
  dismiss: []
}>()

const isOpen = ref(false)

const triggerLabel = computed(() => {
  if (isOpen.value) return 'Cerrar ciudades favoritas'
  return props.cities.length > 0
    ? `Ver ciudades favoritas, ${props.cities.length}`
    : 'Ver ciudades favoritas'
})

function formatTemperature(favorite: FavoriteCity): string | null {
  if (favorite.temperature === null) return null
  const unitSuffix = favorite.units === 'metric' ? 'C' : 'F'
  return `${Math.round(favorite.temperature)}°${unitSuffix}`
}

function handleAsk(city: string): void {
  isOpen.value = false
  emit('ask', city)
}
</script>

<template>
  <div class="fixed bottom-24 right-4 z-20 sm:bottom-6 sm:right-6">
    <button
      type="button"
      class="grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-subtle transition-colors hover:bg-accent-active"
      :aria-label="triggerLabel"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      aria-controls="favorite-cities-panel"
      @click="isOpen = !isOpen"
    >
      <MorphIcon
        :icon="isOpen ? X : MapPin"
        :size="22"
        :stroke-width="2"
        spring="snappy"
        reduced-motion="user"
      />
    </button>

    <Transition name="favorite-cities-panel">
      <div
        v-if="isOpen"
        id="favorite-cities-panel"
        class="absolute bottom-16 right-0 w-72 overflow-hidden rounded-card border border-edge bg-canvas shadow-subtle"
        role="region"
        aria-label="Ciudades favoritas"
        :aria-busy="isLoading"
      >
        <div class="max-h-[60vh] overflow-y-auto p-3">
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
              <button
                type="button"
                class="flex min-w-0 flex-1 items-baseline gap-1.5 text-left text-sm font-medium text-ink hover:text-accent-active"
                :aria-label="`Preguntar el clima en ${favorite.city}`"
                @click="handleAsk(favorite.city)"
              >
                <span class="min-w-0 truncate">{{ favorite.city }}</span>
                <span
                  v-if="formatTemperature(favorite)"
                  class="shrink-0 text-xs font-normal text-muted"
                >
                  {{ formatTemperature(favorite) }}
                </span>
              </button>
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
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.favorite-cities-panel-enter-active,
.favorite-cities-panel-leave-active {
  transition:
    opacity 220ms var(--aura-ease-soft),
    transform 220ms var(--aura-ease-drawer);
  transform-origin: bottom right;
}

.favorite-cities-panel-leave-active {
  transition-duration: 160ms;
}

.favorite-cities-panel-enter-from,
.favorite-cities-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  .favorite-cities-panel-enter-active,
  .favorite-cities-panel-leave-active {
    transition: none;
  }
}
</style>
