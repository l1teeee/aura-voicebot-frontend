# Aura Backend — Prompt para el Frontend

Usa este prompt para darle contexto al equipo de frontend sobre los endpoints y cómo integrar la API.

---

## Prompt para LLM del Frontend

Eres desarrollador frontend de una app de voz llamada **Aura** — un asistente personal conversacional. Tu tarea es implementar la integración con el backend según estas especificaciones:

### Contexto
- **Backend:** Node.js + Express + OpenAI (gpt-4o-mini)
- **Frontend:** Vue 3
- **Flujo:** Usuario habla → Frontend transcribe localmente a texto → Envía a backend → Recibe respuesta preparada para leer en voz alta → Reproduce con síntesis de voz

El usuario **nunca envía audio al servidor**; la transcripción ocurre en el navegador usando Web Speech API.

### Endpoints disponibles

#### GET `/api/health`
Health check. Respuesta:
```json
{ "status": "ok", "uptime": 1234 }
```

#### POST `/api/chat`
Procesa un mensaje y devuelve la respuesta del asistente.

**Request:**
```json
{
  "message": "¿Qué tiempo hace en Valencia?",
  "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31"
}
```

**Validaciones:**
- `message`: string, 1-1000 caracteres (obligatorio)
- `sessionId`: UUID v4 (obligatorio, lo generas en el frontend y lo mantienes durante toda la sesión)

**Response 200:**
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

**Notas importantes:**
- El campo `action` solo aparece si el modelo invocó una herramienta. Úsalo para mostrar contexto visual (ej. tarjeta de clima).
- El `reply` ya viene formateado para leer en voz alta: frases cortas, sin markdown, sin emojis, en español neutro, ~60 palabras.
- El historial se mantiene por `sessionId`. Máximo 20 turnos. TTL: 30 minutos de inactividad.

### Códigos de error

Todos los errores tienen esta estructura:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

| Código | HTTP | Acción en frontend |
|--------|------|-------------------|
| `VALIDATION_ERROR` | 400 | Mostrar error al usuario, no reintentar |
| `CITY_NOT_FOUND` | 400 | El backend ya lo comunica en el `reply`; el usuario lo escucha |
| `RATE_LIMIT_EXCEEDED` | 429 | Esperar 5-10s y reintentar una sola vez |
| `LLM_UNAVAILABLE` | 503 | Mostrar "Servicio no disponible", no reintentar |
| `EXTERNAL_SERVICE_ERROR` | 503 | Mostrar "Problema técnico", no reintentar |
| `NOT_FOUND` | 404 | Nunca debería ocurrir |
| `INTERNAL_ERROR` | 500 | Mostrar error genérico, no reintentar |

### Límites operativos

- **30 peticiones por minuto por IP** → Si superás, recibirás `429`. Espera y reintenta.
- **20 turnos máximo por sesión** → Después se poda el histórico automáticamente.
- **30 minutos TTL** → Si el usuario no envía mensajes por 30 minutos, pierde el histórico. Muestra aviso y genera nuevo `sessionId`.
- **1000 caracteres máximo en mensaje** → Valida en el frontend antes de enviar.

### Cómo implementar

#### 1. Generar sessionId
```javascript
import { v4 as uuidv4 } from 'uuid';
const sessionId = ref(uuidv4());
```

#### 2. Enviar mensaje
```javascript
const sendMessage = async (message) => {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId: sessionId.value })
  });
  
  if (response.status === 429) {
    // Esperar 5s y reintentar
    setTimeout(() => sendMessage(message), 5000);
    return;
  }
  
  const data = await response.json();
  // data.reply → reproducir con síntesis de voz
  // data.action → mostrar tarjeta visual si existe
};
```

#### 3. Reproducir voz
```javascript
const speakReply = (text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  window.speechSynthesis.speak(utterance);
};
```

#### 4. Mostrar tarjeta de clima (opcional)
```javascript
if (data.action?.type === 'weather_lookup') {
  console.log(`${data.action.data.city}: ${data.action.data.temperature}°C`);
  // Mostrar UI con los datos
}
```

### Configuración del proyecto

**`.env` (variables del frontend):**
```
VITE_API_BASE_URL=http://localhost:3000
# En producción: https://aura-backend.onrender.com (o tu dominio real)
```

**Uso:**
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
```

### Testing local

**Backend:**
```bash
cd aura-backend
npm install
cp .env.example .env      # Rellena claves de OpenAI, OpenWeatherMap, webhook, origin
npm run dev              # http://localhost:3000
```

**Frontend:**
```bash
npm run dev              # http://localhost:5173
# Asegúrate que VITE_API_BASE_URL=http://localhost:3000
```

**Prueba rápida con curl:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, ¿cómo estás?",
    "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31"
  }'
```

### Arquitectura esperada en el frontend

```
src/
  components/
    ChatWidget.vue          ← Componente principal
  services/
    apiClient.ts            ← Funciones fetch a /api/chat
  stores/
    chatStore.ts (Pinia)    ← Estado de sesión, mensajes, sessionId
  utils/
    speechSynthesis.ts      ← Wrapper de Web Speech API
    voiceRecognition.ts     ← Web Speech API para grabar audio
```

### Checklist de implementación

- [ ] Generar UUID v4 para `sessionId` al abrir la app
- [ ] Crear input de texto + botón "Enviar"
- [ ] Implementar POST a `/api/chat`
- [ ] Mostrar lista de mensajes (usuario | asistente)
- [ ] Manejar errores con mensajes amigables en español
- [ ] Implementar rate limit: esperar 5s en `429`, reintentar
- [ ] Integrar Web Speech API: grabar audio localmente
- [ ] Transcribir audio a texto con Web Speech API
- [ ] Implementar síntesis de voz: reproducir `reply` en español
- [ ] Mostrar tarjeta visual si `action.type === "weather_lookup"`
- [ ] Probar contra backend local
- [ ] Probar contra backend en producción
- [ ] Configurar `VITE_API_BASE_URL` en build de producción

### Información importante

- **El backend NO transcribe ni sintetiza voz.** El frontend lo hace con APIs del navegador (Web Speech API).
- **No expongas claves de API al frontend.** Las claves (OpenAI, OpenWeatherMap) viven en el backend.
- **El CORS está configurado.** Asegúrate que `ALLOWED_ORIGIN` en el backend coincida con tu URL del frontend.
- **La sesión expira en 30 minutos.** Si el usuario no escribe nada durante 30 minutos, se pierde el historial. Esto es correcto para una demo con memoria en RAM.
- **El reply es solo texto.** No incluye markdown, emojis, URLs ni viñetas. Es pensado para leer en voz alta.

### Documentación completa

Para más detalles, consulta el **README del backend**: https://github.com/l1teeee/aura-voicebot-backend

---

Eso es todo lo que necesitas para implementar el frontend correctamente. ¡Adelante!
