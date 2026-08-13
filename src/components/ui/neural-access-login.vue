<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import AuraBrand from '@/presentation/components/AuraBrand.vue'
import IdentityPrompt from '@/presentation/components/IdentityPrompt.vue'

defineProps<{ busy?: boolean }>()

const emit = defineEmits<{
  identify: [name: string]
}>()

const blobs = [
  { size: 360, left: -8, top: -12, delay: -7, duration: 25, depth: 18 },
  { size: 300, left: 70, top: -8, delay: -14, duration: 29, depth: 24 },
  { size: 260, left: 12, top: 62, delay: -3, duration: 23, depth: 30 },
  { size: 340, left: 72, top: 65, delay: -18, duration: 31, depth: 20 },
  { size: 210, left: 42, top: 8, delay: -11, duration: 27, depth: 36 },
  { size: 180, left: 48, top: 72, delay: -5, duration: 21, depth: 42 },
] as const

const blobElements: Array<HTMLDivElement | undefined> = []
let animationFrame: number | null = null
let pointerX = 0
let pointerY = 0

function setBlobRef(element: Element | ComponentPublicInstance | null, index: number): void {
  if (element instanceof HTMLDivElement) {
    blobElements[index] = element
  }
}

function updateParallax(): void {
  blobs.forEach((blob, index) => {
    const element = blobElements[index]
    if (!element) return
    element.style.transform = `translate3d(${pointerX * blob.depth}px, ${pointerY * blob.depth}px, 0)`
  })
  animationFrame = null
}

function handlePointerMove(event: PointerEvent): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const target = event.currentTarget as HTMLElement
  const bounds = target.getBoundingClientRect()
  pointerX = (event.clientX - bounds.left) / bounds.width - 0.5
  pointerY = (event.clientY - bounds.top) / bounds.height - 0.5

  if (animationFrame === null) {
    animationFrame = requestAnimationFrame(updateParallax)
  }
}

function resetParallax(): void {
  pointerX = 0
  pointerY = 0
  if (animationFrame === null) {
    animationFrame = requestAnimationFrame(updateParallax)
  }
}

onBeforeUnmount(() => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <section
    class="neural-access-login"
    aria-labelledby="aura-login-title"
    @pointermove="handlePointerMove"
    @pointerleave="resetParallax"
  >
    <svg
      class="neural-filter"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="aura-login-goo">
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation="18"
            result="blur"
          />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
            result="goo"
          />
          <feComposite
            in="SourceGraphic"
            in2="goo"
            operator="atop"
          />
        </filter>
      </defs>
    </svg>

    <div
      class="neural-stage"
      aria-hidden="true"
    >
      <div
        v-for="(blob, index) in blobs"
        :key="index"
        :ref="(element) => setBlobRef(element, index)"
        class="neural-blob-track"
        :style="{
          width: `${blob.size}px`,
          height: `${blob.size}px`,
          left: `${blob.left}%`,
          top: `${blob.top}%`,
        }"
      >
        <span
          class="neural-blob"
          :style="{
            animationDelay: `${blob.delay}s`,
            animationDuration: `${blob.duration}s`,
          }"
        />
      </div>
    </div>

    <div
      class="neural-grid"
      aria-hidden="true"
    />

    <main class="neural-panel">
      <header class="neural-header">
        <span class="neural-system-id">Acceso personal / Aura</span>
        <AuraBrand />
      </header>

      <div class="neural-divider" />

      <IdentityPrompt
        :busy="busy"
        @identify="emit('identify', $event)"
      />

      <div class="neural-feedback">
        <slot />
      </div>
    </main>
  </section>
</template>

<style scoped>
.neural-access-login {
  position: relative;
  display: grid;
  width: 100%;
  height: 100dvh;
  min-height: 100dvh;
  place-items: center;
  overflow: hidden auto;
  padding: 2rem 1.25rem;
  background:
    radial-gradient(circle at 16% 12%, rgb(203 243 157 / 0.9), transparent 30rem),
    radial-gradient(circle at 88% 88%, rgb(30 169 123 / 0.28), transparent 34rem),
    var(--aura-aqua);
  isolation: isolate;
}

.neural-filter {
  position: absolute;
  width: 0;
  height: 0;
}

.neural-stage {
  position: absolute;
  z-index: -2;
  inset: -8%;
  overflow: hidden;
  filter: url('#aura-login-goo');
  opacity: 0.66;
  pointer-events: none;
}

.neural-blob-track {
  position: absolute;
  will-change: transform;
  transition: transform 180ms ease-out;
}

.neural-blob {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 46% 54% 58% 42% / 52% 42% 58% 48%;
  background: linear-gradient(135deg, var(--aura-lime-soft), var(--aura-teal) 62%, var(--aura-forest));
  box-shadow:
    inset -22px -20px 40px rgb(4 75 57 / 0.28),
    inset 16px 14px 30px rgb(255 255 255 / 0.46),
    18px 24px 48px rgb(4 75 57 / 0.18);
  filter: blur(12px);
  animation: neural-float infinite alternate ease-in-out;
}

.neural-blob-track:nth-child(2n) .neural-blob {
  background: linear-gradient(145deg, var(--aura-aqua), var(--aura-mint) 48%, var(--aura-teal));
}

.neural-grid {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image:
    linear-gradient(rgb(4 75 57 / 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgb(4 75 57 / 0.045) 1px, transparent 1px);
  background-size: 72px 72px;
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 88%);
  mask-image: linear-gradient(to bottom, black, transparent 88%);
  pointer-events: none;
}

.neural-panel {
  position: relative;
  z-index: 1;
  width: min(100%, 31rem);
  padding: 2rem;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.72);
  border-radius: 30px;
  background: rgb(255 255 255 / 0.76);
  box-shadow:
    0 30px 80px rgb(4 75 57 / 0.2),
    inset 0 1px 0 rgb(255 255 255 / 0.92);
  backdrop-filter: blur(26px) saturate(1.15);
}

.neural-panel::before {
  position: absolute;
  top: -6rem;
  right: -5rem;
  width: 13rem;
  height: 13rem;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(203 243 157 / 0.56), transparent 68%);
  content: '';
  pointer-events: none;
}

.neural-header {
  position: relative;
}

.neural-system-id {
  display: block;
  margin-bottom: 1rem;
  color: rgb(5 52 56 / 0.58);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

.neural-divider {
  height: 1px;
  margin: 1.75rem 0;
  background: linear-gradient(90deg, rgb(4 75 57 / 0.2), transparent);
}

.neural-feedback:empty {
  display: none;
}

.neural-feedback:not(:empty) {
  margin-top: 1rem;
}

@keyframes neural-float {
  0% { transform: translate3d(0, 0, 0) rotate(-5deg) scale(0.92); }
  34% { transform: translate3d(8vw, 12vh, 0) rotate(8deg) scale(1.08); }
  68% { transform: translate3d(-6vw, 7vh, 0) rotate(-3deg) scale(0.88); }
  100% { transform: translate3d(5vw, -8vh, 0) rotate(6deg) scale(1.04); }
}

@media (max-width: 640px) {
  .neural-access-login {
    align-items: center;
    padding: 1rem;
  }

  .neural-panel {
    padding: 1.5rem;
    border-radius: 24px;
  }

  .neural-stage {
    opacity: 0.52;
  }
}

@media (prefers-reduced-motion: reduce) {
  .neural-blob-track {
    transform: none !important;
  }

  .neural-blob {
    animation: none;
  }
}
</style>
