# Aura VoiceBot Backend — Guía para Frontend

## 1. Descripción del Proyecto

**Aura** es un asistente personal conversacional por voz especializado en clima. El frontend (Vue 3) captura la voz del usuario, la transcribe localmente y envía **texto plano** a esta API backend.

### Flujo completo:
1. Usuario habla → Frontend transcribe localmente a texto
2. Frontend envía texto a `/api/chat` con sesión
3. Backend consulta el historial de conversación
4. Envía el mensaje a OpenAI (gpt-4o-mini) con herramientas disponibles
5. Si el modelo solicita una herramienta, la ejecuta (máximo 3 iteraciones)
6. Devuelve una respuesta en lenguaje natural pensada para leer en voz alta (sin markdown, emojis, URLs)
7. Frontend sintetiza la voz y la reproduce

---

## 2. Endpoints Disponibles

### GET `/api/health`
**Propósito:** Health check para plataformas de despliegue.

**Response 200:**
```json
{
  "status": "ok",
  "uptime": 1234
}
```

**Uso:** Llama periódicamente desde el frontend para verificar que el backend está activo.

---

### POST `/api/chat`
**Propósito:** Procesar mensajes del usuario y obtener respuestas del asistente.

**Request Body:**
```json
{
  "message": "¿Qué tiempo hace en Valencia?",
  "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31"
}
```

**Validaciones obligatorias:**
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `message` | string | Obligatorio. Entre 1 y 1000 caracteres. Sin trim automático en frontend (el backend lo hace). |
| `sessionId` | string | Obligatorio. UUID v4. **Lo genera el frontend al iniciar la conversación y lo mantiene durante toda la sesión.** |

**Response 200 OK:**
```json
{
  "reply": "En Valencia hay 24 grados y cielo despejado. Se siente como 25. Buen día para salir.",
  "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31",
  "action": {
    "type": "weather_lookup",
    "data": {
      "city": "Valencia",
      "country": "ES",
      "temperature": 24,
      "feelsLike": 25,
      "description": "cielo despejado",
      "humidity": 55,
      "units": "metric"
    }
  }
}
```

**Notas:**
- El campo `action` **se omite del JSON** si el modelo no invocó ninguna herramienta.
- Cuando aparece, sirve para mostrar contexto visual (ej. tarjeta de clima con `type: "weather_lookup"`).
- El `reply` ya está formateado para leer en voz alta: frases cortas, sin markdown, sin viñetas, sin emojis, en español neutro, ~60 palabras máximo.

---

## 3. Códigos de Error

Todos los errores comparten la misma estructura:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El mensaje no puede estar vacío."
  }
}
```

| Código | HTTP | Cuándo ocurre | Qué hacer en el frontend |
|--------|------|---------------|-------------------------|
| `VALIDATION_ERROR` | 400 | Body mal formado, `sessionId` no es UUID v4, `message` fuera de 1–1000 caracteres. | Mostrar al usuario: "Por favor, revisa tu mensaje". No reintentes automáticamente. |
| `CITY_NOT_FOUND` | 400 | La ciudad solicitada no existe en OpenWeatherMap. | Mostrar al usuario: "No encontré esa ciudad, ¿puedes repetirla?". El backend ya lo comunica en el `reply`. |
| `RATE_LIMIT_EXCEEDED` | 429 | Se superó el límite de 30 peticiones por minuto por IP. | Mostrar al usuario: "Espera un momento y vuelve a intentar". Espera 5-10 segundos antes de reintentar. |
| `LLM_UNAVAILABLE` | 503 | OpenAI no responde, agota el timeout o devuelve un error irrecuperable. | Mostrar al usuario: "El servicio no está disponible. Intenta más tarde.". No reintentes en el frontend. |
| `EXTERNAL_SERVICE_ERROR` | 503 | Un servicio externo (clima, webhook) falló tras reintentos. | Mostrar al usuario: "Hubo un problema técnico. Intenta de nuevo.". |
| `NOT_FOUND` | 404 | La ruta solicitada no existe. | Nunca debería ocurrir si usas las rutas correctas. |
| `INTERNAL_ERROR` | 500 | Error no previsto en el backend. | Mostrar al usuario: "Algo salió mal. Intenta de nuevo.". |

**Regla de oro:** El backend **nunca expone** stack traces, claves de API ni texto crudo de servicios externos en la respuesta.

---

## 4. Límites Operativos

| Límite | Valor | Impacto en el frontend |
|--------|-------|------------------------|
| **Peticiones por IP a `/api/chat`** | 30 por minuto | Muestra un mensaje si el usuario intenta hablar más rápido de lo permitido. No hagas polling automático. |
| **Iteraciones de herramientas por turno** | 3 | El backend maneja esto internamente. El usuario nunca lo ve. |
| **Turnos guardados por conversación** | 20 | Cada sesión guarda máximo 20 turnos de conversación. Después de 20, el histórico se poda. |
| **TTL de una sesión inactiva** | 30 minutos | Si el usuario no envía mensajes por 30 minutos, el histórico se pierde. Debes generar un nuevo `sessionId`. |
| **Tamaño máximo del body JSON** | 16 kB | El mensaje más largo válido son 1000 caracteres; sobra espacio. |
| **Timeout de peticiones salientes** | Configurable (default ~10s) | El backend reintentar con backoff exponencial solo para errores transitorios. En el frontend, espera la respuesta. |

---

## 5. Cómo Generar el `sessionId`

El frontend debe generar un **UUID v4** al iniciar la conversación y mantenerlo durante toda la sesión.

**JavaScript/Vue 3:**
```javascript
import { v4 as uuidv4 } from 'uuid';

const sessionId = uuidv4(); // Guardar en una variable reactive o en localStorage
```

**O sin librería (crypto global):**
```javascript
function generateUUIDv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const sessionId = generateUUIDv4();
```

**Dónde guardar:**
- En una variable `ref` de Vue que se mantenga durante toda la sesión
- En `sessionStorage` para persistencia entre pestañas en la misma sesión
- En `localStorage` si quieres mantener la conversación entre días (pero el backend la olvida a los 30 minutos de inactividad)

---

## 6. Variables de Entorno para el Frontend

```env
# URL base del backend
VITE_API_BASE_URL=http://localhost:3000

# En producción, la URL real del backend
# VITE_API_BASE_URL=https://aura-backend.onrender.com
```

**Uso en Vue 3:**
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const response = await fetch(`${API_BASE}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId })
});
```

---

## 7. Implementación Frontend — Paso a Paso

### 7.1 Estructura básica del componente

```vue
<script setup lang="ts">
import { ref, reactive } from 'vue';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  action?: {
    type: string;
    data: Record<string, unknown>;
  };
}

interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  humidity: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const sessionId = ref(uuidv4());
const messages = ref<ChatMessage[]>([]);
const isLoading = ref(false);
const userInput = ref('');
const error = ref<string | null>(null);

const sendMessage = async () => {
  if (!userInput.value.trim()) return;

  const message = userInput.value.trim();
  userInput.value = '';
  isLoading.value = true;
  error.value = null;

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId: sessionId.value })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message);
    }

    const data = await response.json();

    // Agregar mensaje del usuario
    messages.value.push({ role: 'user', text: message });

    // Agregar respuesta del asistente
    messages.value.push({
      role: 'assistant',
      text: data.reply,
      action: data.action
    });

    // Si hay acción (ej. clima), mostrar tarjeta visual
    if (data.action?.type === 'weather_lookup') {
      handleWeatherAction(data.action.data);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error desconocido';
    messages.value.push({
      role: 'assistant',
      text: error.value
    });
  } finally {
    isLoading.value = false;
  }
};

const handleWeatherAction = (weather: WeatherData) => {
  console.log('Mostrar tarjeta de clima:', weather);
  // Lógica para mostrar tarjeta visual del clima
};
</script>

<template>
  <div class="chat-container">
    <div class="messages">
      <div v-for="msg in messages" :key="msg" class="message" :class="msg.role">
        <p>{{ msg.text }}</p>
        <div v-if="msg.action?.type === 'weather_lookup'" class="weather-card">
          <p><strong>{{ msg.action.data.city }}</strong></p>
          <p>🌡️ {{ msg.action.data.temperature }}°C (siente {{ msg.action.data.temperature }}°C)</p>
          <p>{{ msg.action.data.description }}</p>
          <p>Humedad: {{ msg.action.data.humidity }}%</p>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>

    <div class="input-area">
      <input
        v-model="userInput"
        type="text"
        placeholder="Escribe tu mensaje..."
        @keyup.enter="sendMessage"
        :disabled="isLoading"
      />
      <button @click="sendMessage" :disabled="isLoading || !userInput.trim()">
        {{ isLoading ? 'Cargando...' : 'Enviar' }}
      </button>
    </div>
  </div>
</template>
```

### 7.2 Integración con síntesis de voz

```javascript
const speakReply = (text: string) => {
  if (!('speechSynthesis' in window)) {
    console.warn('Síntesis de voz no soportada');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.cancel(); // Cancela cualquier síntesis anterior
  window.speechSynthesis.speak(utterance);
};

// En el envío de mensaje:
const data = await response.json();
speakReply(data.reply); // Leer en voz alta la respuesta
```

### 7.3 Manejo de errores de rate limit

```javascript
const sendMessage = async () => {
  // ... validaciones ...

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId: sessionId.value })
    });

    if (response.status === 429) {
      error.value = 'Demasiadas peticiones. Espera unos segundos y vuelve a intentar.';
      // Deshabilitar input por 5 segundos
      isLoading.value = true;
      setTimeout(() => {
        isLoading.value = false;
      }, 5000);
      return;
    }

    if (response.status === 503) {
      error.value = 'El servicio no está disponible. Intenta más tarde.';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message);
    }

    // ... resto del flujo ...
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error desconocido';
  } finally {
    isLoading.value = false;
  }
};
```

---

## 8. Tips de Implementación

### 8.1 Gestión de sesiones
- **Genera un `sessionId` único** cuando el usuario abre la app (no en cada mensaje)
- **Guarda el `sessionId` en sessionStorage** para permitir recarga sin perder contexto dentro de la sesma sesión
- **Si la sesión caduca (30 minutos)**, el usuario pierde el historial. Muestra un aviso: "Se perdió el historial de la conversación. Empezando nueva sesión."

### 8.2 UX para transcripción local
- El frontend transcribe localmente (sin enviar audio al servidor)
- Muestra un indicador visual mientras escucha (micrófono activo)
- Si el navegador no tiene Web Speech API, ofrece input de texto como fallback

### 8.3 Respuestas
- El `reply` ya viene formateado para leer en voz alta
- **No añadas markdown, viñetas ni emojis** al reproducir vocalmente
- Muestra la respuesta en texto en la interfaz
- Reproduce la voz inmediatamente después de recibir el `reply`

### 8.4 Acciones (action)
- Si la respuesta incluye `action`, úsalo para mostrar contexto visual
- Hoy solo existe `type: "weather_lookup"`, pero el backend puede agregar más tipos
- Implementa un patrón extensible: `if (action.type === 'weather_lookup') { ... }`

### 8.5 Errores y reintentos
- **No reintentes automáticamente** en errores `400`, `404`, `500`
- **Reintenta una sola vez** en errores `429` (rate limit) y `503` (servicio no disponible)
- Muestra mensajes de error amigables al usuario (ya están en español en la respuesta del backend)

### 8.6 Testing local
```bash
# Terminal 1: Backend
cd aura-backend
npm install
cp .env.example .env    # Rellena las claves
npm run dev            # http://localhost:3000

# Terminal 2: Frontend
npm run dev            # http://localhost:5173
```

**Prueba con curl:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Qué tiempo hace en Madrid?",
    "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31"
  }'
```

---

## 9. Variables de Entorno que Necesita el Backend

El frontend **no necesita configurar** estas, pero es bueno saber qué está corriendo:

| Variable | Ejemplo | Nota |
|----------|---------|------|
| `PORT` | 3000 | El backend corre aquí |
| `OPENAI_API_KEY` | sk-... | Clave de OpenAI (no expongas al frontend) |
| `OPENWEATHER_API_KEY` | ... | Clave de OpenWeatherMap (no expongas) |
| `ALLOWED_ORIGIN` | http://localhost:5173 | CORS: debe coincidir con tu frontend |
| `NODE_ENV` | development | En desarrollo no en producción |

---

## 10. Checklist de Implementación

- [ ] Generar `sessionId` con UUID v4 al iniciar la app
- [ ] Guardar `sessionId` en sessionStorage o variable reactiva
- [ ] Crear formulario con input de texto y botón "Enviar"
- [ ] Implementar fetch a `/api/chat` con validación de response
- [ ] Mostrar lista de mensajes (usuario arriba, asistente abajo)
- [ ] Manejar errores con mensajes amigables en español
- [ ] Implementar rate limit: esperar 5s en `429`
- [ ] Integrar Web Speech API para capturar audio y transcribir localmente
- [ ] Implementar síntesis de voz para reproducir el `reply`
- [ ] Mostrar tarjeta visual si hay `action.type === "weather_lookup"`
- [ ] Probar con backend en http://localhost:3000
- [ ] Probar contra backend desplegado en producción
- [ ] Configurar `VITE_API_BASE_URL` correctamente en build de producción

---

## 11. Contacto y Soporte

**Backend:** https://github.com/l1teeee/aura-voicebot-backend

Si algo no está claro, revisa el README del backend o abre un issue en el repositorio.
