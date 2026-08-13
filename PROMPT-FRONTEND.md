# PROMPT — FRONTEND VOICEBOT

Copia todo el contenido bajo la línea y pégalo como instrucción única. No requiere sustituciones.

---

## Rol y contexto

Actúa como un ingeniero frontend senior con criterio de diseño. Vas a construir la interfaz de **Aura**, un asistente personal por voz con especialidad en clima. El usuario pulsa un botón, habla, y Aura responde por voz.

Toda la inteligencia vive en un backend propio: **este frontend no contiene API keys, no conoce OpenAI, y no llama a ningún servicio de terceros.**

Es un proyecto nuevo desde cero. Este código será evaluado por su calidad arquitectónica y por su acabado visual. La prioridad es: **funcionalidad de voz > claridad arquitectónica > acabado visual > casos borde**.

## Alcance — lo que SÍ y lo que NO

**SÍ construyes:**
- Captura de voz en vivo y síntesis de voz en el navegador
- Una única vista con botón "Hablar", transcripción del diálogo e indicador de estado
- Gestión completa de permisos de micrófono, con alertas visibles
- Consumo de la API del backend

**NO construyes:**
- Login, registro, autenticación, Firebase, rutas protegidas ni navegación multipágina
- Llamadas directas a LLMs o APIs externas
- Backend de ningún tipo

## Stack obligatorio

- Vue 3 con Composition API y `<script setup>`
- Vite + TypeScript en modo `strict`
- Pinia
- Vue Router **no** es necesario: una sola vista
- Tailwind CSS, con uso moderado
- Sin librerías de componentes (nada de Vuetify, PrimeVue, Element)
- Sin librerías de animación (nada de GSAP, Motion, Lottie)

## Arquitectura — capas con dependencias hacia adentro

```
src/
  domain/
    types/          Message, ConversationStatus, VoiceError,
                    MicPermissionState
    ports/          ChatGateway  (interfaz)
  application/
    composables/    useVoiceConversation  (orquestador principal)
                    useSpeechRecognition
                    useSpeechSynthesis
                    useAudioLevel
                    useMicrophonePermission
    stores/         conversation.store.ts
  infrastructure/
    api/            HttpChatGateway  (implementa ChatGateway)
                    httpClient.ts
    speech/         Wrappers tipados de las Web APIs
  presentation/
    components/     VoiceButton, TranscriptList, TranscriptEntry,
                    StatusIndicator, AudioVisualizer,
                    MicPermissionAlert, ErrorNotice,
                    TextFallbackInput
    views/          VoicebotView
  config/           env.ts
  main.ts
```

### Reglas arquitectónicas no negociables

1. **`ChatGateway` es una interfaz en `domain/ports`.** `HttpChatGateway` la implementa. El composable orquestador depende de la interfaz, inyectada vía `provide`/`inject` desde `main.ts`. Así el gateway es sustituible por un stub sin tocar la lógica.
2. **Los componentes son presentacionales.** Reciben props, emiten eventos, no llaman a la API ni tocan las Web Speech APIs directamente. Toda la lógica vive en composables.
3. **`useVoiceConversation` es el único orquestador.** Compone reconocimiento, síntesis, permisos, store y gateway. La vista lo consume y no coordina nada por su cuenta.
4. **Los wrappers de `infrastructure/speech` aíslan las APIs del navegador** detrás de una interfaz propia y tipada, incluyendo la detección de soporte. Ningún composable de aplicación toca `window.webkitSpeechRecognition` directamente.
5. **Estado como máquina de estados, no como booleanos sueltos.**

## Permisos de micrófono — requisito destacado

Esta es una parte crítica de la experiencia y debe estar resuelta con detalle, no como un `catch` genérico.

**`useMicrophonePermission()`**

Composable dedicado que expone `state: MicPermissionState`, `request()` y `checkOnMount()`.

`MicPermissionState` es una unión discriminada:
```
'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable'
```

Comportamiento:
- Al montar la app, consultar `navigator.permissions.query({ name: 'microphone' })` cuando esté disponible, y suscribirse a su evento `change` para reaccionar si el usuario cambia el permiso desde la barra del navegador sin recargar.
- Si la Permissions API no está disponible (Safari), el estado inicial es `'unknown'` y se resuelve en el primer intento de uso.
- `request()` invoca `getUserMedia({ audio: true })`, y **libera inmediatamente** el stream con `getTracks().forEach(t => t.stop())` si solo se estaba comprobando el permiso.
- Mapear los errores de `getUserMedia` a estados concretos: `NotAllowedError` → `'denied'`, `NotFoundError` → `'unavailable'`, `NotReadableError` → `'unavailable'` (micrófono ocupado por otra app).

**`MicPermissionAlert.vue`**

Componente de alerta visible, no un toast que desaparece. Se muestra de forma persistente sobre la zona de control mientras el permiso no esté concedido, y desaparece en cuanto pasa a `'granted'`.

Contenido según el estado:

| Estado | Mensaje | Acción |
|---|---|---|
| `prompt` / `unknown` | "Aura necesita acceso a tu micrófono para escucharte." | Botón "Permitir micrófono" |
| `denied` | "El acceso al micrófono está bloqueado. Actívalo desde el ícono de la barra de direcciones y vuelve a intentarlo." | Botón "Reintentar" + enlace a instrucciones |
| `unavailable` | "No detectamos ningún micrófono disponible. Revisa que esté conectado y que ninguna otra aplicación lo esté usando." | Botón "Reintentar" |

Requisitos de la alerta:
- Estilo cálido y no alarmista: fondo `#FDF3EC`, borde `#E8C4AC`, texto grafito, ícono de micrófono tachado en el acento. **Nada de rojo de error.**
- `role="alert"` y `aria-live="assertive"`
- El botón "Hablar" queda **deshabilitado** mientras el permiso no esté concedido, con `aria-disabled` y un `title` explicativo
- Si el permiso está denegado, incluir un texto plegable con los pasos concretos para reactivarlo en Chrome, Edge y Safari
- Si el usuario pulsa "Hablar" sin permiso resuelto, disparar `request()` en lugar de fallar en silencio

## Máquina de estados

Tipo unión discriminada, no flags independientes:

```
'idle' | 'listening' | 'processing' | 'speaking' | 'error'
```

Transiciones válidas, cualquier otra se ignora:

- `idle` → `listening` (el usuario pulsa Hablar **y** el permiso está concedido)
- `listening` → `processing` (hay transcripción final no vacía)
- `listening` → `idle` (el usuario cancela, o la transcripción está vacía)
- `processing` → `speaking` (llegó la respuesta)
- `processing` → `error` (falló la petición)
- `speaking` → `idle` (terminó, o el usuario interrumpió)
- `error` → `idle` (el usuario reintenta)

Cada estado se refleja en tres lugares: label del botón, color del botón, y texto del indicador.

| Estado | Botón | Indicador |
|---|---|---|
| `idle` | "Hablar", acento terracota | vacío |
| `listening` | "Detener", estado activo + visualizador | "escuchando…" |
| `processing` | deshabilitado | "pensando…" |
| `speaking` | "Detener respuesta" | "respondiendo…" |
| `error` | "Reintentar" | mensaje inline |

## Dirección visual

Cálido pero minimalista. Contenido, no decorado.

**Paleta**
- Fondo: `#FAF7F2`
- Superficie elevada: `#F3EDE4`
- Borde: `#E4DACC`
- Texto principal: `#2E2B29`
- Texto secundario: `#7A716A`
- Acento: `#C4714E`
- Acento activo: `#A85B3C`
- Fondo de alerta: `#FDF3EC`
- Borde de alerta: `#E8C4AC`

**Tipografía**
- Títulos: serif suave (Fraunces o Instrument Serif), peso medio
- Cuerpo e interfaz: Inter
- Etiquetas de hablante: Inter, tamaño pequeño, mayúsculas, tracking amplio

**Reglas de restricción visual — respétalas literalmente**
- Sin degradados llamativos, sin glow, sin partículas, sin fondos animados, sin blobs difuminados
- Sin sombras marcadas: como máximo una sombra apenas perceptible en el botón
- Bordes redondeados entre 12 y 16px
- Transiciones únicamente de `opacity`, `color`, `background-color` y `transform: scale`, con duración máxima de 250ms y easing suave
- Respeta `prefers-reduced-motion`
- La **única** animación más visible permitida es el visualizador de audio: de 3 a 5 barras finas reaccionando al volumen del micrófono, visibles solo durante `listening`

## Layout

Una sola vista, centrada, ancho máximo 640px, distribución vertical:

1. **Encabezado** — "Aura" y una línea describiendo su propósito. Discreto, no protagonista.
2. **Transcripción** — ocupa el espacio central, scroll interno, auto-scroll al último turno. **No uses burbujas de chat genéricas**: alinea todo a la izquierda, distingue al hablante con una etiqueta pequeña en mayúsculas y color diferenciado, separación generosa entre turnos, y una línea divisoria muy sutil. Cuando una respuesta usó la herramienta de clima, mostrar bajo el turno una línea discreta con el dato consultado.
3. **Zona de control** — alerta de permisos (si aplica), indicador de estado y, debajo, el botón "Hablar". Fijo en la parte inferior en móvil, cómodo para el pulgar.

Estado vacío inicial: una frase breve invitando a pulsar el botón, con dos ejemplos de lo que se le puede pedir. Nada de ilustraciones.

## Composables

**`useSpeechRecognition()`**
Envuelve `SpeechRecognition` / `webkitSpeechRecognition` con `lang: 'es-MX'`, `continuous: false`, `interimResults: true`. Expone `start()`, `stop()`, `finalTranscript`, `interimTranscript`, `isListening`, `isSupported`, `error`. Limpia listeners en `onUnmounted`. Distingue los errores `not-allowed`, `no-speech`, `audio-capture` y `network`, y mapea cada uno a un `VoiceError` tipado del dominio. Un error `not-allowed` debe propagarse al estado de permisos, no tratarse como error genérico.

**`useSpeechSynthesis()`**
Envuelve `speechSynthesis`. Expone `speak(text)`, `cancel()`, `isSpeaking`, `isSupported`. Selecciona una voz en español si existe. Maneja el comportamiento conocido de `getVoices()` devolviendo un array vacío en el primer tick, esperando el evento `voiceschanged`. Cancela cualquier locución pendiente al desmontar.

**`useAudioLevel()`**
`AudioContext` + `AnalyserNode` para alimentar el visualizador. Devuelve un nivel normalizado de 0 a 1. Libera el `MediaStream` y cierra el `AudioContext` al detenerse. Nunca dejar el micrófono abierto.

**`useMicrophonePermission()`**
Descrito en detalle en la sección de permisos.

**`useVoiceConversation()`**
Orquestador. Gestiona las transiciones de la máquina de estados, coordina los composables anteriores, envía al gateway y persiste en el store. Antes de iniciar la escucha, verifica el permiso; si no está concedido, lo solicita en lugar de intentar grabar.

## Capa de API

`httpClient.ts`: cliente sobre `fetch` con `VITE_API_BASE_URL`, timeout vía `AbortController`, tipado de respuestas y normalización de errores.

`HttpChatGateway` implementa `ChatGateway`:
- `sendMessage(message, sessionId): Promise<ChatResponse>` → `POST /api/chat`
- `checkHealth(): Promise<boolean>` → `GET /api/health`

`ChatResponse` incluye `reply`, `sessionId` y un `action` opcional con los datos de la herramienta invocada.

## Store (Pinia)

`useConversationStore`:
- Estado: `messages: Message[]`, `status: ConversationStatus`, `sessionId: string`, `error: VoiceError | null`
- `sessionId` generado con `crypto.randomUUID()` y persistido en `sessionStorage`
- Acciones: `addMessage`, `setStatus`, `setError`, `reset`
- El store **no** hace peticiones HTTP; solo guarda estado

## Casos borde obligatorios

Cada uno con un mensaje claro y humano, nunca un error técnico crudo:

- **Permiso de micrófono no concedido, denegado o revocado en caliente** — resuelto por `MicPermissionAlert` según la tabla anterior
- **Micrófono ocupado por otra aplicación** (`NotReadableError`) → estado `unavailable` con mensaje específico
- **Sin soporte de `SpeechRecognition`** (Firefox, Safari antiguo): aviso explicando la limitación y activación automática del `TextFallbackInput`, para que la app siga siendo usable
- **Sin voz detectada**: volver a `idle` sin mostrar error
- **Transcripción vacía**: no enviar la petición
- **Backend caído o timeout**: mensaje amable con acción de reintento
- **Usuario interrumpe la respuesta**: `speechSynthesis.cancel()` y vuelta a `idle`
- **Pestaña oculta durante la escucha**: detener el reconocimiento y liberar el micrófono
- **Contexto no seguro (HTTP sin TLS)**: `getUserMedia` no existe fuera de HTTPS o localhost; detectarlo y avisar de forma explícita

## Accesibilidad

- Contraste mínimo AA en todos los pares de color
- Navegación completa por teclado, con foco visible y coherente con el acento
- `aria-live="polite"` en la transcripción y en el indicador de estado
- `role="alert"` y `aria-live="assertive"` en la alerta de permisos
- El botón declara `aria-pressed` y su label cambia con el estado
- Área táctil mínima de 44×44px
- Respeto de `prefers-reduced-motion`

## Entregables

- Código completo y ejecutable
- `.env.example` con `VITE_API_BASE_URL`
- `README.md` con: descripción del producto, arquitectura en texto, requisitos de navegador y limitaciones conocidas de la Web Speech API, nota sobre el requisito de HTTPS para el micrófono, instrucciones locales, y guía de despliegue en Vercel o Netlify
- `package.json` con scripts `dev`, `build`, `preview`, `typecheck`, `lint`

## Restricciones de estilo de código

- **Sin comentarios en el código.** Nombres precisos en lugar de explicaciones.
- Nombres en inglés para el código; textos de cara al usuario en español.
- Sin `any`. Props y emits siempre tipados.
- Componentes por debajo de 150 líneas; si crecen, extraer.
- Sin lógica en el template más allá de expresiones triviales.
- Sin valores hardcodeados de color en los componentes: todo vía tokens de Tailwind configurados en `tailwind.config`.
- Un archivo, una responsabilidad.

---

## Orden de ejecución sugerido

1. Backend primero — el contrato de la API define lo que el frontend consume
2. Verificar `/api/chat` con curl o Postman antes de tocar la interfaz
3. Frontend contra el backend ya funcionando
4. Despliegue: backend en Render o Railway, frontend en Vercel, y ajustar `ALLOWED_ORIGIN`
