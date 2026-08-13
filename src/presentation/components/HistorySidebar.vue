<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Check,
  DoorOpen,
  History,
  LogOut,
  MessageCircle,
  MessageCirclePlus,
  Plus,
  X,
} from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import type { Conversation } from '@/domain/types'
import { conversationTitle } from '@/presentation/utils/conversationTitle'

interface HistoryItem {
  conversation: Conversation
  title: string
  lastActivity: Date
}

interface HistoryGroup {
  label: string
  items: HistoryItem[]
}

const props = withDefaults(defineProps<{
  triggerId: string
  conversations: Conversation[]
  activeSessionId: string
  userName: string
  open?: boolean
}>(), {
  open: false,
})

const emit = defineEmits<{
  select: [sessionId: string]
  remove: [sessionId: string]
  new: []
  logout: []
  close: []
  closed: []
}>()

const newButton = ref<HTMLButtonElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const hoveredControl = ref<'new' | 'logout' | null>(null)
let focusReturnTarget: HTMLElement | null = null

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const userInitial = computed(() => props.userName.trim().charAt(0).toLocaleUpperCase('es-SV') || '?')

function toDate(value: string): Date {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

function getLastActivity(conversation: Conversation): Date {
  const latestMessage = conversation.messages.reduce<Date>((latest, message) => {
    const createdAt = toDate(message.createdAt)
    return createdAt > latest ? createdAt : latest
  }, toDate(conversation.startedAt))

  return latestMessage
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getGroupLabel(date: Date): string {
  const today = startOfDay(new Date())
  const activityDay = startOfDay(date)
  const dayDifference = Math.round((today.getTime() - activityDay.getTime()) / 86_400_000)

  if (dayDifference === 0) return 'Hoy'
  if (dayDifference === 1) return 'Ayer'
  if (dayDifference < 7) return 'Esta semana'
  return 'Anteriores'
}

function formatActivity(date: Date): string {
  const now = new Date()
  const isToday = startOfDay(date).getTime() === startOfDay(now).getTime()

  return isToday
    ? new Intl.DateTimeFormat('es-SV', { hour: 'numeric', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short' }).format(date)
}

const groupedConversations = computed<HistoryGroup[]>(() => {
  const groups = new Map<string, HistoryItem[]>()

  for (const conversation of [...props.conversations].sort((a, b) => getLastActivity(b).getTime() - getLastActivity(a).getTime())) {
    const item = {
      conversation,
      title: conversationTitle(conversation.messages),
      lastActivity: getLastActivity(conversation),
    }
    const label = getGroupLabel(item.lastActivity)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }

  return ['Hoy', 'Ayer', 'Esta semana', 'Anteriores']
    .map((label) => ({ label, items: groups.get(label) ?? [] }))
    .filter((group) => group.items.length > 0)
})

function selectConversation(sessionId: string): void {
  emit('select', sessionId)
  emit('close')
}

function startConversation(): void {
  emit('new')
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab' || !panelEl.value) return

  const focusable = Array.from(
    panelEl.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.getClientRects().length > 0)
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const focusIsOutside = !(active instanceof Node) || !panelEl.value.contains(active)

  if (event.shiftKey && (active === first || focusIsOutside)) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && (active === last || focusIsOutside)) {
    event.preventDefault()
    first?.focus()
  }
}

watch(() => props.open, async (open) => {
  if (open) {
    const trigger = document.getElementById(props.triggerId)
    focusReturnTarget = trigger instanceof HTMLElement
      ? trigger
      : document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    newButton.value?.focus()
  }
})

function restoreFocus(): void {
  if (focusReturnTarget?.isConnected) {
    focusReturnTarget.focus()
  }
  focusReturnTarget = null
}

function handleAfterLeave(): void {
  restoreFocus()
  emit('closed')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Transition
    name="history-drawer"
    appear
    @after-leave="handleAfterLeave"
  >
    <div
      v-if="open"
      class="history-drawer"
    >
      <aside
        id="aura-history-panel"
        ref="panelEl"
        class="history-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Historial de conversaciones"
      >
        <header class="history-panel__header">
          <div class="history-panel__brand">
            <span
              class="history-panel__brand-mark"
              aria-hidden="true"
            >
              <img
                src="/aura-sidebar-icon.svg"
                alt=""
              >
            </span>
            <div class="history-panel__title">
              <p>Aura</p>
              <h2>Tu historial</h2>
            </div>
          </div>

          <button
            class="history-panel__close"
            type="button"
            aria-label="Cerrar historial"
            @click="emit('close')"
          >
            <MorphIcon
              :icon="X"
              :size="18"
              :stroke-width="1.9"
              spring="snappy"
              reduced-motion="user"
            />
          </button>
        </header>

        <div class="history-panel__new-wrap">
          <button
            ref="newButton"
            class="history-panel__new"
            type="button"
            @mouseenter="hoveredControl = 'new'"
            @mouseleave="hoveredControl = null"
            @focus="hoveredControl = 'new'"
            @blur="hoveredControl = null"
            @click="startConversation"
          >
            <span aria-hidden="true">
              <MorphIcon
                :icon="hoveredControl === 'new' ? MessageCirclePlus : Plus"
                :size="17"
                :stroke-width="2"
                spring="snappy"
                reduced-motion="user"
              />
            </span>
            Nueva conversación
          </button>
        </div>

        <nav
          class="history-panel__nav"
          aria-label="Conversaciones anteriores"
        >
          <div
            v-if="groupedConversations.length === 0"
            class="history-panel__empty"
          >
            <span aria-hidden="true">
              <MorphIcon
                :icon="History"
                :size="22"
                :stroke-width="1.7"
                reduced-motion="user"
              />
            </span>
            <p>Tus conversaciones aparecerán aquí.</p>
          </div>
          <section
            v-for="group in groupedConversations"
            :key="group.label"
            class="history-panel__group"
          >
            <div class="history-panel__group-title">
              <h3>{{ group.label }}</h3>
            </div>
            <ul role="list">
              <li
                v-for="item in group.items"
                :key="item.conversation.sessionId"
                class="history-panel__row"
              >
                <button
                  class="history-panel__item"
                  :class="{ 'is-active': item.conversation.sessionId === activeSessionId }"
                  type="button"
                  :title="item.title"
                  :aria-current="item.conversation.sessionId === activeSessionId ? 'page' : undefined"
                  @click="selectConversation(item.conversation.sessionId)"
                >
                  <span
                    class="history-panel__item-icon"
                    aria-hidden="true"
                  >
                    <MorphIcon
                      :icon="item.conversation.sessionId === activeSessionId ? Check : MessageCircle"
                      :size="15"
                      :stroke-width="1.8"
                      spring="smooth"
                      reduced-motion="user"
                    />
                  </span>
                  <span class="history-panel__item-copy">
                    <strong>{{ item.title }}</strong>
                    <span>{{ formatActivity(item.lastActivity) }}</span>
                  </span>
                </button>
                <button
                  class="history-panel__item-remove"
                  type="button"
                  :aria-label="`Eliminar conversación ${item.title}`"
                  @click="emit('remove', item.conversation.sessionId)"
                >
                  <MorphIcon
                    :icon="X"
                    :size="13"
                    :stroke-width="1.8"
                    spring="snappy"
                    reduced-motion="user"
                  />
                </button>
              </li>
            </ul>
          </section>
        </nav>

        <footer class="history-panel__footer">
          <div class="history-panel__profile">
            <span
              class="history-panel__avatar"
              role="img"
              :aria-label="`Usuario ${userName}`"
            >{{ userInitial }}</span>
            <div class="history-panel__profile-copy">
              <strong>{{ userName }}</strong>
              <span>Sesión activa</span>
            </div>
            <button
              class="history-panel__logout"
              type="button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              @mouseenter="hoveredControl = 'logout'"
              @mouseleave="hoveredControl = null"
              @focus="hoveredControl = 'logout'"
              @blur="hoveredControl = null"
              @click="emit('logout')"
            >
              <MorphIcon
                :icon="hoveredControl === 'logout' ? DoorOpen : LogOut"
                :size="19"
                :stroke-width="1.9"
                spring="snappy"
                reduced-motion="user"
              />
            </button>
          </div>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.history-drawer {
  position: relative;
  z-index: 50;
  width: min(88vw, 360px);
  height: 100%;
  flex: none;
  overflow: hidden;
}

.history-panel {
  position: relative;
  display: flex;
  width: min(88vw, 360px);
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--aura-sidebar-border);
  background: var(--aura-sidebar-surface);
  color: var(--aura-sidebar-ink);
  transform: translate3d(0, 0, 0);
}

.history-panel__header {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 0.9rem 0.5rem;
}

/* En movil el panel cubre casi toda la pantalla y el scrim queda tapado, asi
   que la salida tiene que estar dentro del panel. */
.history-panel__close {
  display: inline-grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--aura-sidebar-muted);
  transition: background-color var(--aura-duration-hover) var(--aura-ease-soft);
}

.history-panel__close:hover {
  background: var(--aura-sidebar-hover);
  color: var(--aura-sidebar-ink);
}

.history-panel__brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
}

.history-panel__brand-mark {
  display: block;
  width: 30px;
  height: 30px;
  flex: none;
  overflow: hidden;
  border-radius: 9px;
}

.history-panel__brand-mark img {
  display: block;
  width: 100%;
  height: 100%;
}

.history-panel__title {
  min-width: 0;
}

.history-panel__title p,
.history-panel__title h2 {
  margin: 0;
}

.history-panel__title p {
  color: var(--aura-sidebar-faint);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.history-panel__title h2 {
  margin-top: 0.08rem;
  color: var(--aura-sidebar-ink);
  font-size: 0.95rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.history-panel__new-wrap {
  padding: 0.35rem 0.9rem 0.7rem;
}

.history-panel__new {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-radius: 10px;
  background: var(--aura-forest);
  color: var(--aura-white);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: left;
  transition: background-color var(--aura-duration-hover) var(--aura-ease-soft);
}

.history-panel__new:hover {
  background: #0a5f49;
}

.history-panel__new > span {
  display: grid;
  width: 18px;
  height: 18px;
  flex: none;
  place-items: center;
}

.history-panel__new svg {
  width: 1rem;
  height: 1rem;
}

.history-panel__nav {
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.15rem 0.6rem 1rem;
  scrollbar-color: rgb(5 52 56 / 0.18) transparent;
  scrollbar-width: thin;
}

.history-panel__empty {
  display: grid;
  min-height: 11rem;
  place-items: center;
  align-content: center;
  gap: 0.65rem;
  padding: 1.5rem;
  color: var(--aura-sidebar-muted);
  text-align: center;
}

.history-panel__empty span {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
  background: var(--aura-sidebar-hover);
  color: var(--aura-sidebar-faint);
}

.history-panel__empty svg {
  width: 1.25rem;
  height: 1.25rem;
}

.history-panel__empty p {
  max-width: 14rem;
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.55;
}

.history-panel__group + .history-panel__group {
  margin-top: 1rem;
}

.history-panel__group-title {
  padding: 0.5rem 0.55rem 0.3rem;
}

.history-panel__group-title h3 {
  margin: 0;
  color: var(--aura-sidebar-faint);
  font-size: 0.67rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.history-panel__group,
.history-panel__group li {
  min-width: 0;
  max-width: 100%;
}

.history-panel__group ul {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.12rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.history-panel__row {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 0.1rem;
}

.history-panel__item {
  position: relative;
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex: 1;
  min-height: 42px;
  align-items: center;
  gap: 0.55rem;
  overflow: hidden;
  padding: 0.4rem 0.55rem;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--aura-sidebar-ink);
  text-align: left;
  transition:
    background-color var(--aura-duration-hover) var(--aura-ease-soft),
    color var(--aura-duration-hover) var(--aura-ease-soft);
}

.history-panel__item-remove {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--aura-sidebar-faint);
  transition:
    background-color var(--aura-duration-hover) var(--aura-ease-soft),
    color var(--aura-duration-hover) var(--aura-ease-soft);
}

.history-panel__item-remove:hover {
  background: var(--aura-sidebar-hover);
  color: var(--aura-sidebar-muted);
}

.history-panel__item-remove svg {
  width: 0.85rem;
  height: 0.85rem;
}

.history-panel__item:hover {
  background: var(--aura-sidebar-hover);
}

.history-panel__item.is-active {
  background: var(--aura-sidebar-active);
  color: var(--aura-forest);
}

.history-panel__item-icon {
  display: grid;
  width: 18px;
  height: 18px;
  flex: none;
  place-items: center;
  color: var(--aura-sidebar-faint);
  transition: color var(--aura-duration-hover) var(--aura-ease-soft);
}

.history-panel__item:hover .history-panel__item-icon {
  color: var(--aura-sidebar-muted);
}

.history-panel__item.is-active .history-panel__item-icon {
  color: var(--aura-teal);
}

.history-panel__item-icon svg {
  width: 0.95rem;
  height: 0.95rem;
}

.history-panel__item-copy {
  display: block;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.history-panel__item-copy strong,
.history-panel__item-copy > span {
  display: block;
}

.history-panel__item-copy strong {
  overflow: hidden;
  font-size: 0.81rem;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-panel__item-copy > span {
  margin-top: 0.1rem;
  color: var(--aura-sidebar-faint);
  font-size: 0.68rem;
  font-weight: 500;
}

.history-panel__footer {
  padding: 0.55rem 0.7rem 0.7rem;
  border-top: 1px solid var(--aura-sidebar-divider);
  background: var(--aura-sidebar-surface);
}

.history-panel__profile {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.25rem 0.35rem 0.35rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
}

.history-panel__avatar {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--aura-forest);
  color: var(--aura-white);
  font-size: 0.78rem;
  font-weight: 650;
}

.history-panel__profile-copy {
  display: block;
  min-width: 0;
  flex: 1;
}

.history-panel__profile-copy strong,
.history-panel__profile-copy span {
  display: block;
}

.history-panel__profile-copy strong {
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-panel__profile-copy span {
  margin-top: 0.1rem;
  color: var(--aura-sidebar-faint);
  font-size: 0.68rem;
}

.history-panel__logout {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--aura-sidebar-faint);
  transition:
    background-color var(--aura-duration-hover) var(--aura-ease-soft),
    color var(--aura-duration-hover) var(--aura-ease-soft);
}

.history-panel__logout:hover {
  background: rgb(185 28 28 / 0.08);
  color: #b91c1c;
}

.history-panel__logout svg {
  width: 1.05rem;
  height: 1.05rem;
}

.history-panel__new:focus-visible,
.history-panel__item:focus-visible,
.history-panel__item-remove:focus-visible,
.history-panel__logout:focus-visible {
  outline: 3px solid var(--aura-sky);
  outline-offset: 2px;
}

.history-drawer-enter-active,
.history-drawer-leave-active {
  overflow: hidden;
  transition: width var(--aura-duration-drawer) var(--aura-ease-drawer);
  will-change: width;
}

.history-drawer-leave-active {
  pointer-events: none;
}

.history-drawer-enter-active .history-panel,
.history-drawer-leave-active .history-panel {
  transition:
    transform var(--aura-duration-drawer) var(--aura-ease-drawer),
    opacity var(--aura-duration-drawer) var(--aura-ease-soft);
  will-change: transform, opacity;
}

.history-drawer-enter-from,
.history-drawer-leave-to {
  width: 0;
}

.history-drawer-enter-from .history-panel,
.history-drawer-leave-to .history-panel {
  opacity: 0;
  transform: translate3d(-100%, 0, 0);
}

@media (max-width: 380px) {
  .history-panel__header,
  .history-panel__new-wrap {
    padding-right: 0.7rem;
    padding-left: 0.7rem;
  }

  .history-panel__nav,
  .history-panel__footer {
    padding-right: 0.5rem;
    padding-left: 0.5rem;
  }
}

@media (min-width: 641px) {
  .history-panel__close {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-drawer-enter-active,
  .history-drawer-leave-active,
  .history-drawer-enter-active .history-panel,
  .history-drawer-leave-active .history-panel {
    transition-duration: 0.01ms;
  }
}
</style>
