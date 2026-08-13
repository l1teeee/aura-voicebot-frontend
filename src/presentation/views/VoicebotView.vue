<script setup lang="ts">
import { computed, ref } from 'vue'
import { Menu, MessageCircleMore, X } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import { useFavoriteCities } from '@/application/composables/useFavoriteCities'
import { useFavoriteCityPrompt } from '@/application/composables/useFavoriteCityPrompt'
import { useVoiceConversation } from '@/application/composables/useVoiceConversation'
import MicPermissionAlert from '@/presentation/components/MicPermissionAlert.vue'
import ErrorNotice from '@/presentation/components/ErrorNotice.vue'
import FavoriteCitiesPanel from '@/presentation/components/FavoriteCitiesPanel.vue'
import WeatherFavoriteCard from '@/presentation/components/WeatherFavoriteCard.vue'
import NeuralAccessLogin from '@/components/ui/neural-access-login.vue'
import HistorySidebar from '@/presentation/components/HistorySidebar.vue'
import VoiceStage from '@/presentation/components/VoiceStage.vue'
import VoiceActionBar from '@/presentation/components/VoiceActionBar.vue'
import VoiceTranscriptPanel from '@/presentation/components/VoiceTranscriptPanel.vue'
import { conversationTitle } from '@/presentation/utils/conversationTitle'

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
  sendImage,
  isSendingImage,
  repeatLastReply,
  canRepeat,
  dismissError,
  userId,
  userName,
  needsIdentity,
  isIdentifying,
  identify,
  conversations,
  activeSessionId,
  selectConversation,
  startNewConversation,
  removeConversation,
  logout,
} = useVoiceConversation()

const favoriteCitiesApi = useFavoriteCities()
const {
  cities: favoriteCities,
  isLoading: favoriteCitiesLoading,
  error: favoriteCitiesError,
  load: loadFavoriteCities,
  remove: removeFavoriteCity,
  dismissError: dismissFavoriteCitiesError,
} = favoriteCitiesApi

const {
  card: favoriteCityCard,
  save: saveFavoriteCity,
  dismiss: dismissFavoriteCityCard,
} = useFavoriteCityPrompt(favoriteCitiesApi)

const micBlocked = computed(() => micPermission.value !== 'granted' || !isSecureContext)
const historyOpen = ref(false)
const transcriptOpen = ref(false)
const closingDock = ref<'history' | 'transcript' | null>(null)
const pendingDock = ref<'history' | 'transcript' | null>(null)
const dockOpen = computed(() => historyOpen.value || transcriptOpen.value)
const activeConversationTitle = computed(() => messages.value.length > 0 ? conversationTitle(messages.value) : '')
const openDockLabel = computed(() => historyOpen.value ? 'Cerrar historial' : 'Cerrar mensajes')

const messageCount = computed(() => messages.value.length)
const messageBadge = computed(() => messageCount.value > 99 ? '99+' : String(messageCount.value))
const transcriptLabel = computed(() => {
  if (transcriptOpen.value) return 'Cerrar mensajes'
  if (messageCount.value === 0) return 'Ver mensajes'
  return messageCount.value === 1
    ? 'Ver mensajes, 1 mensaje'
    : `Ver mensajes, ${messageCount.value} mensajes`
})

function retryFavoriteCities(): void {
  if (userId.value) void loadFavoriteCities(userId.value)
}

function handleRemoveFavoriteCity(id: string): void {
  void removeFavoriteCity(id)
}

function handleAskFavoriteCity(city: string): void {
  void sendText(`¿Qué clima hace ahora en ${city}?`)
}

function handleAttachImage(file: File): void {
  void sendImage(file)
}

function retry(): void {
  if (needsIdentity.value) {
    dismissError()
    return
  }
  void toggle()
}

function openHistory(): void {
  if (historyOpen.value) {
    closeHistory()
    return
  }
  if (closingDock.value) {
    pendingDock.value = 'history'
    return
  }
  if (transcriptOpen.value) {
    pendingDock.value = 'history'
    closingDock.value = 'transcript'
    transcriptOpen.value = false
    return
  }
  pendingDock.value = null
  historyOpen.value = true
}

function toggleTranscriptPanel(): void {
  if (transcriptOpen.value) {
    closeTranscript()
    return
  }
  if (closingDock.value) {
    pendingDock.value = 'transcript'
    return
  }
  if (historyOpen.value) {
    pendingDock.value = 'transcript'
    closingDock.value = 'history'
    historyOpen.value = false
    return
  }
  pendingDock.value = null
  transcriptOpen.value = true
}

function finishDockTransition(dock: 'history' | 'transcript'): void {
  if (closingDock.value !== dock) return
  closingDock.value = null

  const nextDock = pendingDock.value
  if (!nextDock) return

  pendingDock.value = null
  if (nextDock === 'history') historyOpen.value = true
  if (nextDock === 'transcript') transcriptOpen.value = true
}

function closeHistory(): void {
  pendingDock.value = null
  closingDock.value = 'history'
  historyOpen.value = false
}

function closeTranscript(): void {
  pendingDock.value = null
  closingDock.value = 'transcript'
  transcriptOpen.value = false
}

function closeOpenDock(): void {
  pendingDock.value = null
  closingDock.value = historyOpen.value
    ? 'history'
    : transcriptOpen.value ? 'transcript' : closingDock.value
  historyOpen.value = false
  transcriptOpen.value = false
}

function chooseConversation(sessionId: string): void {
  selectConversation(sessionId)
  pendingDock.value = null
  closingDock.value = historyOpen.value ? 'history' : closingDock.value
  historyOpen.value = false
  transcriptOpen.value = false
}

function createConversation(): void {
  startNewConversation()
  pendingDock.value = null
  closingDock.value = historyOpen.value ? 'history' : closingDock.value
  historyOpen.value = false
  transcriptOpen.value = false
}

function signOut(): void {
  pendingDock.value = null
  closingDock.value = historyOpen.value
    ? 'history'
    : transcriptOpen.value ? 'transcript' : closingDock.value
  historyOpen.value = false
  transcriptOpen.value = false
  logout()
}
</script>

<template>
  <div class="aura-app">
    <Transition
      name="auth-view"
      mode="out-in"
      appear
    >
      <NeuralAccessLogin
        v-if="needsIdentity"
        key="identity"
        :busy="isIdentifying"
        @identify="identify"
      >
        <ErrorNotice
          :error="error"
          @retry="retry"
          @dismiss="dismissError"
        />
      </NeuralAccessLogin>

      <div
        v-else
        key="workspace"
        class="aura-workspace"
      >
        <HistorySidebar
          trigger-id="aura-history-toggle"
          :conversations="conversations"
          :active-session-id="activeSessionId"
          :user-name="userName ?? 'Invitado'"
          :open="historyOpen"
          @select="chooseConversation"
          @remove="removeConversation"
          @new="createConversation"
          @logout="signOut"
          @close="closeHistory"
          @closed="finishDockTransition('history')"
        />

        <Transition name="sidebar-scrim">
          <button
            v-if="dockOpen"
            class="aura-sidebar-scrim"
            type="button"
            tabindex="-1"
            :aria-label="openDockLabel"
            @click="closeOpenDock"
          />
        </Transition>

        <main
          class="aura-voice-shell"
          :class="{ 'has-open-dock': dockOpen }"
        >
          <nav
            class="aura-floating-controls aura-header-nav"
            aria-label="Controles de conversación"
          >
            <button
              id="aura-history-toggle"
              class="aura-floating-button"
              type="button"
              :aria-label="historyOpen ? 'Cerrar historial' : 'Abrir historial'"
              aria-controls="aura-history-panel"
              :aria-expanded="historyOpen"
              @click="openHistory"
            >
              <MorphIcon
                :icon="historyOpen ? X : Menu"
                :size="20"
                :stroke-width="1.8"
                spring="snappy"
                reduced-motion="user"
              />
            </button>
            <Transition
              name="session-title"
              mode="out-in"
            >
              <p
                v-if="activeConversationTitle"
                :key="activeSessionId"
                class="aura-header-title"
              >
                {{ activeConversationTitle }}
              </p>
            </Transition>
          </nav>

          <nav
            class="aura-floating-controls aura-transcript-controls"
            aria-label="Controles de mensajes"
          >
            <button
              id="aura-transcript-toggle"
              class="aura-floating-button aura-transcript-button"
              type="button"
              :aria-label="transcriptLabel"
              aria-controls="aura-transcript-panel"
              :aria-expanded="transcriptOpen"
              @click="toggleTranscriptPanel"
            >
              <MorphIcon
                :icon="transcriptOpen ? X : MessageCircleMore"
                :size="20"
                :stroke-width="1.8"
                spring="snappy"
                reduced-motion="user"
              />
              <Transition name="message-badge">
                <span
                  v-if="messageCount > 0"
                  class="aura-message-badge"
                  aria-hidden="true"
                >
                  {{ messageBadge }}
                </span>
              </Transition>
            </button>
          </nav>

          <div class="aura-voice-layout">
            <div class="aura-conversation">
              <VoiceStage
                :inert="dockOpen || undefined"
                :aria-hidden="dockOpen ? 'true' : undefined"
                :session-id="activeSessionId"
                :messages="messages"
                :status="status"
                :audio-level="audioLevel"
                :mic-blocked="micBlocked"
                :needs-text-fallback="needsTextFallback"
                :interim-transcript="interimTranscript"
                @activate="toggle"
              >
                <template
                  v-if="favoriteCityCard"
                  #weather-card
                >
                  <WeatherFavoriteCard
                    :weather="favoriteCityCard.weather"
                    :can-save="favoriteCityCard.canSave"
                    :status="favoriteCityCard.status"
                    :error-message="favoriteCityCard.errorMessage"
                    @save="saveFavoriteCity"
                    @dismiss="dismissFavoriteCityCard"
                  />
                </template>
                <template
                  v-if="micBlocked"
                  #permission
                >
                  <MicPermissionAlert
                    :state="micPermission"
                    :is-secure-context="isSecureContext"
                    :busy="isRequestingPermission"
                    @request="requestMicPermission"
                  />
                </template>
                <template
                  v-if="error"
                  #error
                >
                  <ErrorNotice
                    :error="error"
                    @retry="retry"
                    @dismiss="dismissError"
                  />
                </template>
              </VoiceStage>

              <VoiceActionBar
                :inert="dockOpen || undefined"
                :aria-hidden="dockOpen ? 'true' : undefined"
                :status="status"
                :can-repeat="canRepeat"
                :force-composer="needsTextFallback"
                :image-pending="isSendingImage"
                @submit="sendText"
                @repeat="repeatLastReply"
                @end="createConversation"
                @attach-image="handleAttachImage"
              />
            </div>

            <FavoriteCitiesPanel
              v-if="userId"
              :inert="dockOpen || undefined"
              :aria-hidden="dockOpen ? 'true' : undefined"
              :cities="favoriteCities"
              :is-loading="favoriteCitiesLoading"
              :error="favoriteCitiesError"
              @remove="handleRemoveFavoriteCity"
              @ask="handleAskFavoriteCity"
              @retry="retryFavoriteCities"
              @dismiss="dismissFavoriteCitiesError"
            />
          </div>
        </main>

        <VoiceTranscriptPanel
          id="aura-transcript-panel"
          trigger-id="aura-transcript-toggle"
          :open="transcriptOpen"
          :messages="messages"
          :interim-transcript="interimTranscript"
          @close="closeTranscript"
          @closed="finishDockTransition('transcript')"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.aura-voice-layout {
  min-height: 100%;
}

.aura-conversation {
  position: relative;
  height: 100dvh;
  min-width: 0;
}

.aura-header-nav {
  align-items: center;
  max-width: calc(100% - 4.75rem);
}

/* En escritorio el titulo se centra en la barra superior, dejando el menu
   a la izquierda y los mensajes a la derecha. En movil no se toca. */
@media (min-width: 641px) {
  .aura-header-nav {
    right: 0.75rem;
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
    max-width: none;
    gap: 0;
    pointer-events: none;
  }

  .aura-header-nav > * {
    pointer-events: auto;
  }

  .aura-header-title {
    grid-column: 2;
    max-width: 100%;
    justify-self: center;
    text-align: center;
  }
}

.aura-transcript-controls {
  right: 0.75rem;
  left: auto;
}

.aura-transcript-button {
  position: relative;
  overflow: visible;
}

/* Contador de mensajes de la conversacion activa, sobre el icono */
.aura-message-badge {
  position: absolute;
  top: -1px;
  right: -1px;
  display: grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--aura-forest);
  box-shadow: 0 0 0 2px rgb(232 250 240 / 0.92);
  color: var(--aura-white);
  font-size: 0.63rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  pointer-events: none;
}

.message-badge-enter-active {
  transition: opacity 180ms ease-out, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.message-badge-leave-active {
  transition: opacity 140ms ease-in, transform 160ms ease-in;
}

.message-badge-enter-from,
.message-badge-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

.aura-floating-button[aria-expanded="true"] {
  background: var(--aura-sidebar-active);
  box-shadow: none;
  color: var(--aura-forest);
}

.aura-sidebar-scrim {
  position: absolute;
  z-index: 30;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: rgb(5 52 56 / 0.16);
}

.has-open-dock .aura-floating-controls {
  z-index: 31;
}

.has-open-dock .aura-header-title {
  pointer-events: none;
}

.aura-sidebar-scrim:hover,
.aura-sidebar-scrim:active {
  background: rgb(5 52 56 / 0.16);
  box-shadow: none;
  transform: none !important;
}

.sidebar-scrim-enter-active,
.sidebar-scrim-leave-active {
  transition: opacity var(--aura-duration-drawer) var(--aura-ease-soft);
}

.sidebar-scrim-enter-from,
.sidebar-scrim-leave-to {
  opacity: 0;
}

.aura-header-title {
  overflow: hidden;
  max-width: clamp(8rem, 40vw, 22rem);
  margin: 0;
  padding: 0.2rem 0.4rem;
  border-radius: 8px;
  color: var(--aura-sidebar-muted);
  cursor: default;
  font-size: 0.875rem;
  font-weight: 550;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition:
    color var(--aura-duration-hover) var(--aura-ease-soft),
    background-color var(--aura-duration-hover) var(--aura-ease-soft);
}

.aura-header-title:hover {
  background: rgb(5 52 56 / 0.05);
  color: var(--aura-sidebar-ink);
  font-weight: 650;
}

.session-title-enter-active {
  transition: opacity 220ms ease-out, transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.session-title-leave-active {
  transition: opacity 150ms ease-in, transform 180ms ease-in;
}

.session-title-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.session-title-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .session-title-enter-active,
  .session-title-leave-active {
    transition: none;
  }
}

@media (max-width: 640px) {
  .aura-transcript-controls {
    right: 0.5rem;
  }

  /* En movil el panel deja una franja minima de scrim: si es casi invisible
     nadie la reconoce como salida. */
  .aura-sidebar-scrim,
  .aura-sidebar-scrim:hover,
  .aura-sidebar-scrim:active {
    background: rgb(5 52 56 / 0.34);
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-badge-enter-active,
  .message-badge-leave-active {
    transition: none;
  }
}
</style>
