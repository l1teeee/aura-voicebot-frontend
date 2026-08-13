<script setup lang="ts"></script>

<template>
  <div
    class="aura-empty-state flex h-full flex-col items-center justify-center px-6 text-center font-sans"
  >
    <span
      class="mb-4 inline-flex items-center gap-2 rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
    >
      <span
        class="h-2 w-2 rounded-full bg-accent"
        aria-hidden="true"
      />
      Disponible para escucharte
    </span>
    <p class="text-lg font-semibold tracking-tight text-ink">
      ¿Qué quieres saber hoy?
    </p>
    <p class="mt-2 max-w-sm text-sm leading-relaxed text-muted">
      Pregúntame por el clima, pídeme una idea o cuéntame lo que tienes en mente.
    </p>
  </div>
</template>
