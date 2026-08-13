# Aura Frontend — Ejemplos de Código

Ejemplos listos para copiar y pegar para implementar rápidamente la integración con el backend.

---

## 1. Cliente HTTP

**`src/services/auraApi.ts`**

```typescript
interface ChatRequest {
  message: string;
  sessionId: string;
}

interface WeatherData {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  description: string;
  humidity: number;
  units: string;
}

interface ChatAction {
  type: string;
  data: WeatherData | Record<string, unknown>;
}

interface ChatResponse {
  reply: string;
  sessionId: string;
  action?: ChatAction;
}

interface ApiError {
  code: string;
  message: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const auraApi = {
  async sendMessage(message: string, sessionId: string): Promise<ChatResponse> {
    const body: ChatRequest = { message, sessionId };

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage: ApiError = error.error;
      const err = new Error(errorMessage.message);
      (err as any).code = errorMessage.code;
      (err as any).status = response.status;
      throw err;
    }

    return response.json();
  },

  async checkHealth(): Promise<{ status: string; uptime: number }> {
    const response = await fetch(`${API_BASE}/api/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }
};
```

---

## 2. Store (Pinia)

**`src/stores/chatStore.ts`**

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { auraApi } from '../services/auraApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  action?: {
    type: string;
    data: Record<string, unknown>;
  };
  timestamp: Date;
}

export const useChatStore = defineStore('chat', () => {
  const sessionId = ref<string>('');
  const messages = ref<Message[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const backendStatus = ref<'ok' | 'offline'>('offline');

  const messageCount = computed(() => messages.value.length);

  const initSession = () => {
    sessionId.value = uuidv4();
    messages.value = [];
    error.value = null;
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;
    if (userMessage.length > 1000) {
      error.value = 'El mensaje no puede superar 1000 caracteres';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      // Agregar mensaje del usuario
      messages.value.push({
        id: uuidv4(),
        role: 'user',
        text: userMessage.trim(),
        timestamp: new Date()
      });

      // Enviar al backend
      const response = await auraApi.sendMessage(userMessage.trim(), sessionId.value);

      // Agregar respuesta del asistente
      messages.value.push({
        id: uuidv4(),
        role: 'assistant',
        text: response.reply,
        action: response.action,
        timestamp: new Date()
      });

      return response;
    } catch (err) {
      const error_obj = err as any;

      // Manejo específico de errores
      if (error_obj.status === 429) {
        error.value = 'Demasiadas peticiones. Espera un momento.';
      } else if (error_obj.status === 503) {
        error.value = 'El servicio no está disponible. Intenta más tarde.';
      } else if (error_obj.code === 'VALIDATION_ERROR') {
        error.value = error_obj.message;
      } else if (error_obj.status === 400) {
        error.value = error_obj.message;
      } else {
        error.value = error_obj.message || 'Error desconocido';
      }

      // Agregar error como mensaje del asistente
      messages.value.push({
        id: uuidv4(),
        role: 'assistant',
        text: error.value,
        timestamp: new Date()
      });
    } finally {
      isLoading.value = false;
    }
  };

  const clearMessages = () => {
    messages.value = [];
    error.value = null;
  };

  const checkBackendHealth = async () => {
    try {
      await auraApi.checkHealth();
      backendStatus.value = 'ok';
    } catch {
      backendStatus.value = 'offline';
    }
  };

  return {
    sessionId,
    messages,
    isLoading,
    error,
    backendStatus,
    messageCount,
    initSession,
    sendMessage,
    clearMessages,
    checkBackendHealth
  };
});
```

---

## 3. Servicio de Síntesis de Voz

**`src/services/speechService.ts`**

```typescript
interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export const speechService = {
  isSupported(): boolean {
    return 'speechSynthesis' in window;
  },

  speak(text: string, options: SpeechOptions = {}): void {
    if (!this.isSupported()) {
      console.warn('Speech synthesis not supported');
      return;
    }

    const {
      rate = 1,
      pitch = 1,
      volume = 1,
      lang = 'es-ES'
    } = options;

    // Cancelar cualquier síntesis anterior
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => console.log('Iniciando síntesis');
    utterance.onend = () => console.log('Síntesis completada');
    utterance.onerror = (event) => console.error('Error en síntesis:', event);

    window.speechSynthesis.speak(utterance);
  },

  stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  },

  isPaused(): boolean {
    return this.isSupported() && window.speechSynthesis.paused;
  },

  pause(): void {
    if (this.isSupported() && !this.isPaused()) {
      window.speechSynthesis.pause();
    }
  },

  resume(): void {
    if (this.isSupported() && this.isPaused()) {
      window.speechSynthesis.resume();
    }
  }
};
```

---

## 4. Servicio de Reconocimiento de Voz

**`src/services/voiceRecognitionService.ts`**

```typescript
type RecognitionCallback = (text: string) => void;
type ErrorCallback = (error: string) => void;

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const voiceRecognitionService = {
  recognition: null as any,
  isListening: false,

  init(): boolean {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.interimResults = true;
    this.recognition.continuous = false;

    return true;
  },

  start(
    onResult: RecognitionCallback,
    onError: ErrorCallback
  ): void {
    if (!this.recognition) {
      if (!this.init()) {
        onError('Reconocimiento de voz no soportado');
        return;
      }
    }

    this.isListening = true;
    let finalTranscript = '';

    this.recognition.onstart = () => {
      console.log('Escuchando...');
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onResult(finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event: any) => {
      const errorMap: Record<string, string> = {
        'no-speech': 'No se detectó voz. Intenta de nuevo.',
        'audio-capture': 'No hay micrófono disponible.',
        'network': 'Problema de red.',
        'permission-denied': 'Permiso de micrófono denegado.',
        'service-not-allowed': 'Servicio de voz no disponible.'
      };
      onError(errorMap[event.error] || `Error: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Detuvo de escuchar');
    };

    this.recognition.start();
  },

  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  },

  abort(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.isListening = false;
    }
  }
};
```

---

## 5. Componente Principal

**`src/components/ChatWidget.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useChatStore } from '../stores/chatStore';
import { speechService } from '../services/speechService';
import { voiceRecognitionService } from '../services/voiceRecognitionService';

const chatStore = useChatStore();
const userInput = ref('');
const isRecording = ref(false);
const messagesContainer = ref<HTMLDivElement>();
let rateLimitRetryTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  chatStore.initSession();
  chatStore.checkBackendHealth();
  voiceRecognitionService.init();
  scrollToBottom();
});

onUnmounted(() => {
  if (rateLimitRetryTimer) clearTimeout(rateLimitRetryTimer);
  speechService.stop();
  voiceRecognitionService.abort();
});

watch(() => chatStore.messages.length, () => {
  scrollToBottom();
});

const scrollToBottom = () => {
  if (messagesContainer.value) {
    setTimeout(() => {
      messagesContainer.value!.scrollTop = messagesContainer.value!.scrollHeight;
    }, 0);
  }
};

const handleSendMessage = async (e?: Event) => {
  if (e) e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  userInput.value = '';
  const response = await chatStore.sendMessage(message);

  if (response && !chatStore.error) {
    speechService.speak(response.reply);
  }
};

const handleVoiceInput = () => {
  if (isRecording.value) {
    voiceRecognitionService.stop();
    isRecording.value = false;
    return;
  }

  isRecording.value = true;
  voiceRecognitionService.start(
    (text) => {
      userInput.value = text;
      isRecording.value = false;
      handleSendMessage();
    },
    (error) => {
      chatStore.error = error;
      isRecording.value = false;
    }
  );
};

const handleClearChat = () => {
  chatStore.clearMessages();
  chatStore.initSession();
  speechService.stop();
};
</script>

<template>
  <div class="chat-widget">
    <!-- Status -->
    <div class="status-bar">
      <span class="backend-status" :class="chatStore.backendStatus">
        {{ chatStore.backendStatus === 'ok' ? '✓ Conectado' : '✗ Desconectado' }}
      </span>
      <span class="session-id">Sesión: {{ chatStore.sessionId.slice(0, 8) }}...</span>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="messages-container">
      <div
        v-for="message in chatStore.messages"
        :key="message.id"
        class="message"
        :class="`message-${message.role}`"
      >
        <p class="message-text">{{ message.text }}</p>

        <!-- Weather Action Card -->
        <div
          v-if="message.action?.type === 'weather_lookup'"
          class="action-card weather-card"
        >
          <div class="weather-header">
            <h4>{{ message.action.data.city }}, {{ message.action.data.country }}</h4>
          </div>
          <div class="weather-body">
            <div class="temp-main">
              <span class="temperature">{{ message.action.data.temperature }}°C</span>
              <span class="description">{{ message.action.data.description }}</span>
            </div>
            <div class="weather-details">
              <div class="detail">
                <span class="label">Sensación térmica:</span>
                <span class="value">{{ message.action.data.feelsLike }}°C</span>
              </div>
              <div class="detail">
                <span class="label">Humedad:</span>
                <span class="value">{{ message.action.data.humidity }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="chatStore.isLoading" class="message message-assistant">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="chatStore.error" class="error-banner">
      {{ chatStore.error }}
    </div>

    <!-- Input Form -->
    <form @submit="handleSendMessage" class="input-form">
      <input
        v-model="userInput"
        type="text"
        placeholder="Escribe o habla..."
        class="message-input"
        maxlength="1000"
        :disabled="chatStore.isLoading || isRecording"
      />

      <button
        type="button"
        class="voice-button"
        :class="{ recording: isRecording }"
        @click="handleVoiceInput"
        :disabled="chatStore.isLoading"
        title="Haz clic para hablar"
      >
        🎤
      </button>

      <button
        type="submit"
        class="send-button"
        :disabled="!userInput.trim() || chatStore.isLoading"
      >
        {{ chatStore.isLoading ? 'Cargando...' : 'Enviar' }}
      </button>

      <button
        type="button"
        class="clear-button"
        @click="handleClearChat"
        :disabled="chatStore.isLoading"
        title="Limpiar conversación"
      >
        ✕
      </button>
    </form>

    <!-- Character Count -->
    <div class="char-count">
      {{ userInput.length }}/1000
    </div>
  </div>
</template>

<style scoped>
.chat-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
  font-size: 12px;
  color: #666;
}

.backend-status {
  font-weight: bold;
}

.backend-status.ok {
  color: #4caf50;
}

.backend-status.offline {
  color: #f44336;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-user {
  align-items: flex-end;
}

.message-user .message-text {
  background: #007bff;
  color: white;
  border-radius: 12px 0 12px 12px;
  padding: 8px 12px;
  max-width: 70%;
}

.message-assistant {
  align-items: flex-start;
}

.message-assistant .message-text {
  background: #f0f0f0;
  color: #333;
  border-radius: 0 12px 12px 12px;
  padding: 8px 12px;
  max-width: 90%;
}

.message-text {
  margin: 0;
  word-wrap: break-word;
  line-height: 1.4;
}

.action-card {
  max-width: 90%;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  border: 1px solid #ddd;
}

.weather-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.weather-header {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.weather-header h4 {
  margin: 0;
  font-size: 16px;
}

.weather-body {
  padding: 12px;
}

.temp-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

.temperature {
  font-size: 28px;
  font-weight: bold;
}

.description {
  font-size: 14px;
  opacity: 0.9;
  text-transform: capitalize;
}

.weather-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 13px;
}

.detail {
  display: flex;
  justify-content: space-between;
}

.detail .label {
  opacity: 0.8;
}

.detail .value {
  font-weight: bold;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  height: 20px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: typing 0.6s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.1s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.2s;
}

@keyframes typing {
  0%, 60%, 100% { opacity: 0.5; }
  30% { opacity: 1; }
}

.error-banner {
  padding: 12px;
  background: #f44336;
  color: white;
  font-size: 14px;
  border-bottom: 1px solid #d32f2f;
}

.input-form {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #f9f9f9;
  border-top: 1px solid #eee;
}

.message-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.message-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.message-input:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.send-button,
.voice-button,
.clear-button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.send-button {
  background: #007bff;
  color: white;
}

.send-button:hover:not(:disabled) {
  background: #0056b3;
}

.send-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.voice-button {
  background: #fff;
  border: 1px solid #ddd;
  font-size: 16px;
}

.voice-button:hover:not(:disabled) {
  background: #f0f0f0;
}

.voice-button.recording {
  background: #f44336;
  color: white;
  border-color: #f44336;
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.clear-button {
  background: #fff;
  border: 1px solid #ddd;
  color: #666;
}

.clear-button:hover:not(:disabled) {
  background: #f0f0f0;
}

.clear-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.char-count {
  padding: 4px 12px;
  font-size: 12px;
  color: #999;
  text-align: right;
}
</style>
```

---

## 6. Instalación de Dependencias

```bash
# Pinia (state management)
npm install pinia

# UUID
npm install uuid
npm install -D @types/uuid

# Vue 3 (ya debe estar instalado)
npm install vue
```

---

## 7. Configuración en `main.ts`

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

---

## 8. Variables de Entorno (`.env` y `.env.local`)

```env
# .env
VITE_API_BASE_URL=http://localhost:3000

# En producción:
# VITE_API_BASE_URL=https://aura-backend.onrender.com
```

---

## 9. Uso en tu App principal

**`src/App.vue`**

```vue
<template>
  <div id="app">
    <ChatWidget />
  </div>
</template>

<script setup lang="ts">
import ChatWidget from './components/ChatWidget.vue'
</script>

<style scoped>
#app {
  width: 100%;
  max-width: 600px;
  height: 600px;
  margin: 0 auto;
}
</style>
```

---

## 10. Testing

```bash
# Verificar que el backend está funcionando
curl http://localhost:3000/api/health

# Enviar un mensaje de prueba
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, ¿cómo estás?",
    "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31"
  }'
```

---

¡Listo! Copia y pega estos ejemplos en tu proyecto Vue 3 y tendrás una integración completa funcional.
