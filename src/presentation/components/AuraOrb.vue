<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { gsap } from 'gsap'
import type { ConversationStatus } from '@/domain/types'

type AuraOrbSize = number | string

const props = withDefaults(defineProps<{
  status: ConversationStatus
  audioLevel?: number
  size?: AuraOrbSize
  disabled?: boolean
  disabledReason?: string
}>(), {
  audioLevel: 0,
  size: 'clamp(9.5rem, 35vw, 13rem)',
  disabled: false,
  disabledReason: undefined,
})

const emit = defineEmits<{
  activate: []
}>()

const actionLabels: Record<ConversationStatus, string> = {
  idle: 'Hablar con Aura',
  listening: 'Terminar de escuchar',
  processing: 'Preparando respuesta',
  speaking: 'Detener respuesta',
  error: 'Intentar de nuevo',
}

const level = computed(() => Math.min(1, Math.max(0, props.audioLevel)))
const isListening = computed(() => props.status === 'listening')
const isInteractionBlocked = computed(() => props.disabled || props.status === 'processing')
const actionLabel = computed(() => actionLabels[props.status])
const accessibleLabel = computed(() =>
  props.disabled && props.disabledReason ? props.disabledReason : actionLabel.value,
)

const orbRoot = ref<HTMLButtonElement | null>(null)
const shapePath = ref<SVGPathElement | null>(null)
const cloudGradient = ref<SVGRadialGradientElement | null>(null)
const highlightGradient = ref<SVGRadialGradientElement | null>(null)
const cloudDrift = ref<SVGGElement | null>(null)
const shine = ref<SVGCircleElement | null>(null)

const ORB_CENTER = 100
const ORB_RADIUS = 94
const ORB_POINT_COUNT = 16

function random(min: number, max: number): number {
  return gsap.utils.random(min, max)
}

function createOrbPath(irregularity = 0): string {
  const phaseA = random(0, Math.PI * 2)
  const phaseB = random(0, Math.PI * 2)
  const points = Array.from({ length: ORB_POINT_COUNT }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / ORB_POINT_COUNT
    const offset = irregularity === 0
      ? 0
      : irregularity * (
          Math.sin(angle * 3 + phaseA) * 0.62
          + Math.sin(angle * 5 + phaseB) * 0.28
          + random(-0.1, 0.1)
        )
    const radius = ORB_RADIUS + offset

    return {
      x: ORB_CENTER + Math.cos(angle) * radius,
      y: ORB_CENTER + Math.sin(angle) * radius,
    }
  })

  const number = (value: number) => value.toFixed(2)
  let path = `M ${number(points[0].x)} ${number(points[0].y)}`

  for (let index = 0; index < ORB_POINT_COUNT; index += 1) {
    const previous = points[(index - 1 + ORB_POINT_COUNT) % ORB_POINT_COUNT]
    const current = points[index]
    const next = points[(index + 1) % ORB_POINT_COUNT]
    const afterNext = points[(index + 2) % ORB_POINT_COUNT]
    const controlA = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    }
    const controlB = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    }

    path += ` C ${number(controlA.x)} ${number(controlA.y)} ${number(controlB.x)} ${number(controlB.y)} ${number(next.x)} ${number(next.y)}`
  }

  return `${path} Z`
}

const baseOrbPath = createOrbPath()

const cloudGradientId = useId()
const highlightGradientId = useId()
const cloudFilterId = useId()
const clipPathId = useId()
const cloudFill = `url(#${cloudGradientId})`
const highlightFill = `url(#${highlightGradientId})`
const cloudFilter = `url(#${cloudFilterId})`
const clipPathUrl = `url(#${clipPathId})`

const orbStyle = computed(() => ({
  '--aura-energy': String(level.value),
  '--aura-size': typeof props.size === 'number' ? `${props.size}px` : props.size,
}))

function activate(): void {
  if (!isInteractionBlocked.value) emit('activate')
}

let motionMedia: ReturnType<typeof gsap.matchMedia> | null = null

onMounted(() => {
  if (
    orbRoot.value === null
    || shapePath.value === null
    || cloudGradient.value === null
    || highlightGradient.value === null
    || cloudDrift.value === null
    || shine.value === null
  ) return

  const path = shapePath.value
  const gradient = cloudGradient.value
  const highlight = highlightGradient.value
  const cloud = cloudDrift.value
  const shineLayer = shine.value

  motionMedia = gsap.matchMedia()
  motionMedia.add('(prefers-reduced-motion: no-preference)', () => {
    let stopped = false
    let gradientTween: ReturnType<typeof gsap.to> | null = null
    let highlightTween: ReturnType<typeof gsap.to> | null = null
    let cloudTween: ReturnType<typeof gsap.to> | null = null
    let shineTween: ReturnType<typeof gsap.to> | null = null
    let shapeTween: ReturnType<typeof gsap.to> | null = null
    let shapeDelay: ReturnType<typeof gsap.delayedCall> | null = null
    let settleTween: ReturnType<typeof gsap.to> | null = null
    let shapeStep = 0

    function moveGradient(): void {
      if (stopped) return

      const cx = random(28, 68)
      const cy = random(24, 72)
      const focusAngle = random(0, Math.PI * 2)
      const focusDistance = random(4, 15)
      const fx = cx + Math.cos(focusAngle) * focusDistance
      const fy = cy + Math.sin(focusAngle) * focusDistance

      gradientTween = gsap.to(gradient, {
        attr: {
          cx: `${cx}%`,
          cy: `${cy}%`,
          fx: `${fx}%`,
          fy: `${fy}%`,
          r: `${random(70, 92)}%`,
        },
        duration: random(3.6, 5.8),
        ease: 'sine.inOut',
        overwrite: 'auto',
        onComplete: moveGradient,
      })
    }

    function moveHighlight(): void {
      if (stopped) return

      highlightTween = gsap.to(highlight, {
        attr: {
          cx: `${random(28, 70)}%`,
          cy: `${random(24, 68)}%`,
          r: `${random(34, 54)}%`,
        },
        duration: random(3.9, 6.2),
        ease: 'sine.inOut',
        overwrite: 'auto',
        onComplete: moveHighlight,
      })
    }

    gsap.set(cloud, { svgOrigin: '100 100' })

    function moveCloud(): void {
      if (stopped) return

      cloudTween = gsap.to(cloud, {
        x: random(-9, 9),
        y: random(-8, 8),
        rotation: `${random(-18, 18)}_short`,
        scaleX: random(0.96, 1.05),
        scaleY: random(0.95, 1.06),
        duration: random(3.4, 5.5),
        ease: 'sine.inOut',
        overwrite: 'auto',
        onComplete: moveCloud,
      })
    }

    function breatheShine(): void {
      if (stopped) return

      shineTween = gsap.to(shineLayer, {
        opacity: random(0.5, 0.9),
        duration: random(2.9, 4.5),
        ease: 'sine.inOut',
        overwrite: 'auto',
        onComplete: breatheShine,
      })
    }

    function moveShape(): void {
      if (stopped || props.status !== 'listening') return

      shapeStep += 1
      const isCalm = shapeStep % 3 === 0 || random(0, 1) < 0.24
      const irregularity = isCalm
        ? random(0.12, 0.42)
        : random(1.15, 2.45 + level.value * 0.8)

      shapeTween = gsap.to(path, {
        attr: { d: createOrbPath(irregularity) },
        duration: isCalm ? random(1.15, 1.75) : random(0.85, 1.35),
        ease: 'sine.inOut',
        overwrite: true,
        onComplete: () => {
          if (stopped || props.status !== 'listening') return

          if (isCalm) {
            shapeDelay = gsap.delayedCall(random(0.3, 0.75), moveShape)
            return
          }

          moveShape()
        },
      })
    }

    moveGradient()
    moveHighlight()
    moveCloud()
    breatheShine()

    const stopStatusWatch = watch(
      () => props.status,
      (status) => {
        shapeTween?.kill()
        shapeDelay?.kill()
        settleTween?.kill()
        shapeTween = null
        shapeDelay = null
        settleTween = null

        if (status === 'listening') {
          shapeStep = 0
          moveShape()
          return
        }

        settleTween = gsap.to(path, {
          attr: { d: baseOrbPath },
          duration: 0.8,
          ease: 'sine.inOut',
          overwrite: true,
        })
      },
      { immediate: true },
    )

    return () => {
      stopped = true
      stopStatusWatch()
      gradientTween?.kill()
      highlightTween?.kill()
      cloudTween?.kill()
      shineTween?.kill()
      shapeTween?.kill()
      shapeDelay?.kill()
      settleTween?.kill()
    }
  }, orbRoot.value)
})

onUnmounted(() => {
  motionMedia?.revert()
})
</script>

<template>
  <button
    ref="orbRoot"
    type="button"
    class="aura-orb"
    :class="`is-${status}`"
    :style="orbStyle"
    :disabled="disabled"
    :aria-disabled="isInteractionBlocked"
    :aria-pressed="isListening"
    :aria-label="accessibleLabel"
    aria-describedby="aura-voice-status"
    :title="disabled ? disabledReason : undefined"
    @click="activate"
  >
    <span
      class="aura-orb__visual"
      aria-hidden="true"
    >
      <svg
        class="aura-orb__art"
        viewBox="0 0 200 200"
        fill="none"
      >
        <defs>
          <radialGradient
            :id="cloudGradientId"
            ref="cloudGradient"
            cx="34%"
            cy="28%"
            fx="30%"
            fy="24%"
            r="78%"
          >
            <stop
              class="aura-orb__stop aura-orb__stop--glow"
              offset="0%"
            />
            <stop
              class="aura-orb__stop aura-orb__stop--lime"
              offset="35%"
            />
            <stop
              class="aura-orb__stop aura-orb__stop--teal"
              offset="68%"
            />
            <stop
              class="aura-orb__stop aura-orb__stop--forest"
              offset="100%"
            />
          </radialGradient>

          <radialGradient
            :id="highlightGradientId"
            ref="highlightGradient"
            cx="30%"
            cy="24%"
            r="42%"
          >
            <stop
              class="aura-orb__stop aura-orb__stop--highlight"
              offset="0%"
              stop-opacity="0.55"
            />
            <stop
              class="aura-orb__stop aura-orb__stop--highlight"
              offset="100%"
              stop-opacity="0"
            />
          </radialGradient>

          <filter
            :id="cloudFilterId"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
            color-interpolation-filters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014"
              numOctaves="4"
              seed="7"
              stitchTiles="stitch"
              result="noise"
            />
            <feGaussianBlur
              in="noise"
              stdDeviation="3"
              result="softNoise"
            />
            <feColorMatrix
              in="softNoise"
              type="luminanceToAlpha"
              result="noiseAlpha"
            />
            <feComponentTransfer
              in="noiseAlpha"
              result="cloudAlpha"
            >
              <feFuncA
                type="linear"
                slope="1.6"
                intercept="-0.15"
              />
            </feComponentTransfer>
            <feFlood
              flood-color="#FFFFFF"
              flood-opacity="0.9"
              result="white"
            />
            <feComposite
              in="white"
              in2="cloudAlpha"
              operator="in"
              result="cloudMask"
            />
            <feComposite
              in="cloudMask"
              in2="SourceGraphic"
              operator="in"
              result="cloudOnShape"
            />
            <feBlend
              in="cloudOnShape"
              in2="SourceGraphic"
              mode="soft-light"
              result="clouded"
            />
            <feGaussianBlur
              in="clouded"
              stdDeviation="1.2"
            />
          </filter>

          <clipPath :id="clipPathId">
            <path
              ref="shapePath"
              :d="baseOrbPath"
            />
          </clipPath>
        </defs>

        <g :clip-path="clipPathUrl">
          <g
            ref="cloudDrift"
            class="aura-orb__cloud-drift"
          >
            <circle
              cx="100"
              cy="100"
              r="130"
              :fill="cloudFill"
              :filter="cloudFilter"
            />
          </g>
          <circle
            ref="shine"
            cx="100"
            cy="100"
            r="94"
            :fill="highlightFill"
            class="aura-orb__shine"
          />
        </g>
      </svg>
    </span>

    <span
      class="aura-orb__indicator"
      aria-hidden="true"
    >
      <svg
        class="aura-orb__mic-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.35"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect
          x="9.4"
          y="3.2"
          width="5.2"
          height="10"
          rx="2.6"
        />
        <path d="M6.9 11.4v.8a5.1 5.1 0 0 0 10.2 0v-.8" />
        <path d="M12 17.3v3.5" />
      </svg>

      <Transition name="aura-waves">
        <span
          v-if="isListening"
          class="aura-orb__waves"
        >
          <span
            v-for="bar in 3"
            :key="bar"
            class="aura-orb__wave"
          />
        </span>
      </Transition>
    </span>
  </button>
</template>

<style scoped>
.aura-orb {
  --aura-energy: 0;
  align-items: center;
  background: transparent;
  border: 0;
  color: #053438;
  display: inline-flex;
  flex-direction: column;
  gap: calc(var(--aura-size) * 0.07);
  justify-content: center;
  max-width: 100%;
  padding: 0.25rem;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

/* El estado (escuchar/hablar) y el hover se componen en variables para que
   ninguna regla congele a la otra. */
.aura-orb__visual {
  --orb-scale: 1;
  --orb-brightness: 1;
  --orb-saturation: 1;
  --orb-hover: 1;
  --orb-white: 0;
  align-items: center;
  aspect-ratio: 1;
  background: transparent;
  border: 0;
  border-radius: 999px;
  display: inline-flex;
  filter:
    brightness(calc(var(--orb-brightness) + var(--orb-white) * 0.2))
    saturate(calc(var(--orb-saturation) - var(--orb-white) * 0.42));
  justify-content: center;
  max-width: min(100%, calc(100vw - 5rem));
  position: relative;
  transform: scale(calc(var(--orb-scale) * var(--orb-hover)));
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 280ms ease,
    opacity 220ms ease;
  width: var(--aura-size);
}

.aura-orb:hover:not(:disabled):not(.is-processing) .aura-orb__visual,
.aura-orb:focus-visible .aura-orb__visual {
  --orb-hover: 1.07;
  --orb-white: 1;
}

.aura-orb:active:not(:disabled):not(.is-processing) .aura-orb__visual {
  --orb-hover: 1.01;
}

.aura-orb:focus-visible {
  outline: none;
}

.aura-orb:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.aura-orb.is-processing {
  cursor: wait;
}

.aura-orb__art {
  height: 100%;
  overflow: visible;
  transform-origin: 50% 50%;
  width: 100%;
}

.aura-orb__cloud-drift {
  transform-box: fill-box;
}

.aura-orb__shine {
  opacity: 0.9;
}

/* La respiracion vive en el SVG interno para no pisar el transform del wrapper. */
.is-idle .aura-orb__art {
  animation: orb-breathe 8s ease-in-out infinite alternate;
}

/* Hablando el usuario: la esfera se aclara hacia blanco, mas cuanto mas fuerte
   sea la voz. Hablando Aura: crece al ritmo de la envolvente de la sintesis. */
.is-listening .aura-orb__visual {
  --orb-scale: calc(1.04 + var(--aura-energy) * 0.15);
  --orb-brightness: calc(1.05 + var(--aura-energy) * 0.16);
  --orb-saturation: calc(0.84 - var(--aura-energy) * 0.22);
}

.is-speaking .aura-orb__visual {
  --orb-scale: calc(1.01 + var(--aura-energy) * 0.3);
  --orb-brightness: calc(1 + var(--aura-energy) * 0.1);
  --orb-saturation: calc(1.3 + var(--aura-energy) * 0.3);
}

/* La paleta de la esfera vive en CSS para poder virarla por estado. */
.aura-orb__stop {
  transition: stop-color 420ms ease;
}

.aura-orb__stop--glow { stop-color: #cbf39d; }
.aura-orb__stop--lime { stop-color: #72c613; }
.aura-orb__stop--teal { stop-color: #1ea97b; }
.aura-orb__stop--forest { stop-color: #044b39; }
.aura-orb__stop--highlight { stop-color: #bdf0ec; }

/* Hablando Aura: los tonos se corren de lima/aqua a verdes mas puros. */
.is-speaking .aura-orb__stop--glow { stop-color: #a9ec72; }
.is-speaking .aura-orb__stop--lime { stop-color: #43c22a; }
.is-speaking .aura-orb__stop--teal { stop-color: #0fa46b; }
.is-speaking .aura-orb__stop--forest { stop-color: #033c2c; }
.is-speaking .aura-orb__stop--highlight { stop-color: #d6f7b4; }

.is-listening .aura-orb__visual,
.is-speaking .aura-orb__visual {
  transition: transform 110ms ease-out, filter 150ms ease-out;
}

.is-processing .aura-orb__visual {
  opacity: 0.78;
}

.is-error .aura-orb__visual {
  filter: saturate(0.35);
  opacity: 0.5;
}

.is-error .aura-orb__indicator {
  opacity: 0.4;
}

/* Indicador: microfono de trazo fino + tres ondas, fuera de la esfera */
.aura-orb__indicator {
  align-items: center;
  color: rgb(5 52 56 / 0.5);
  display: inline-flex;
  gap: calc(var(--aura-size) * 0.045);
  height: calc(var(--aura-size) * 0.18);
  justify-content: center;
  transition: color 240ms ease;
}

.aura-orb:hover:not(:disabled):not(.is-processing) .aura-orb__indicator,
.is-listening .aura-orb__indicator {
  color: rgb(5 52 56 / 0.78);
}

.aura-orb__mic-icon {
  flex-shrink: 0;
  height: calc(var(--aura-size) * 0.115);
  width: calc(var(--aura-size) * 0.115);
}

.aura-orb__waves {
  align-items: center;
  display: inline-flex;
  gap: calc(var(--aura-size) * 0.026);
  height: calc(var(--aura-size) * 0.18);
}

.aura-orb__wave {
  background: currentColor;
  border-radius: 999px;
  height: calc(var(--aura-size) * 0.062);
  opacity: calc(0.45 + var(--aura-energy) * 0.5);
  transform-origin: center;
  transition: transform 110ms ease-out, opacity 160ms ease-out;
  width: 3px;
}

.aura-orb__wave:nth-child(1) { transform: scaleY(calc(0.55 + var(--aura-energy) * 1.5)); }
.aura-orb__wave:nth-child(2) { transform: scaleY(calc(0.7 + var(--aura-energy) * 2.4)); }
.aura-orb__wave:nth-child(3) { transform: scaleY(calc(0.55 + var(--aura-energy) * 1.7)); }

.aura-waves-enter-active,
.aura-waves-leave-active {
  transition: opacity 200ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.aura-waves-enter-from,
.aura-waves-leave-to {
  opacity: 0;
  transform: translateX(calc(var(--aura-size) * -0.03)) scale(0.85);
}

@keyframes orb-breathe {
  from { transform: scale(1); }
  to { transform: scale(1.025); }
}

@media (prefers-reduced-motion: reduce) {
  .aura-orb *,
  .aura-orb__visual {
    animation: none !important;
    transition: none !important;
  }

  .is-listening .aura-orb__visual {
    --orb-scale: 1.05;
  }

  .is-speaking .aura-orb__visual {
    --orb-scale: 1.1;
  }

  .aura-orb .aura-orb__wave {
    opacity: 0.75;
    transform: scaleY(1);
  }
}
</style>
