# Aura

**Demo en producción:** https://aura-voicebot-frontend.vercel.app/

Aura es un asistente personal conversacional por voz especializado en clima. El usuario pulsa un botón, habla, y Aura transcribe su voz localmente en el navegador, envía el texto al backend, y lee en voz alta la respuesta generada. Cuando la pregunta involucra el tiempo en una ciudad, la respuesta del backend viene acompañada de un dato estructurado (`weather_lookup`) con temperatura, sensación térmica y descripción del cielo; hoy Aura lo comunica hablado y en el texto de su respuesta, sin una tarjeta visual aparte.

Si el navegador no soporta reconocimiento de voz o el contexto no es seguro (ver más abajo), la aplicación ofrece un campo de texto como alternativa para seguir conversando con Aura sin usar el micrófono.

Los usuarios identificados también pueden guardar ciudades favoritas durante la conversación diciendo "guarda esta ciudad". Un panel plegable muestra la lista, permite quitar ciudades y ofrece reintento cuando no puede sincronizarse con el backend.

## Arquitectura

El proyecto sigue una arquitectura por capas con dependencias apuntando siempre hacia adentro (estilo hexagonal / clean architecture). Cada capa solo conoce a las capas más internas que ella misma:

```
presentation  ->  application  ->  domain  <-  infrastructure
```

- **`src/domain`**: el núcleo. Tipos (`Message`, `ConversationStatus`, `VoiceError`, `MicPermissionState`) y puertos (`ChatGateway`). No importa nada de ninguna otra capa ni depende de Vue, del navegador o de ninguna librería externa. Es código puro de negocio.
- **`src/application`**: composables y stores (Pinia) que orquestan el caso de uso "mantener una conversación por voz". Dependen solo de `domain`: reciben las implementaciones concretas (gateway HTTP, adaptadores de Web Speech API) a través de inyección de dependencias, nunca las crean directamente.
- **`src/infrastructure`**: implementaciones concretas de los puertos definidos en `domain`. Aquí vive el cliente HTTP que habla con el backend y los adaptadores sobre `SpeechRecognition` / `SpeechSynthesis`. Esta capa depende de `domain` (implementa sus interfaces) pero ninguna otra capa depende de ella directamente: se conecta mediante `src/config/injection.ts`, que registra las implementaciones detrás de una `InjectionKey` de Vue.
- **`src/presentation`**: componentes y vistas de Vue. Son en su mayoría presentacionales puros (reciben props, emiten eventos) y no conocen la API ni las Web Speech API directamente. La única excepción es `VoicebotView.vue`, que consume el composable orquestador `useVoiceConversation` y reparte su estado entre los componentes hijos.

Por qué las dependencias apuntan hacia adentro: el dominio, los tipos y contratos que describen qué es una conversación de voz, no debe romperse si mañana cambiamos de backend, cambiamos Web Speech API por otro motor de voz, o rediseñamos la interfaz por completo. Al depender siempre hacia el centro, esas tres cosas pueden cambiar de forma independiente sin tocar el núcleo del negocio.

## Requisitos de navegador y limitaciones de la Web Speech API

Aura usa la Web Speech API del navegador (`SpeechRecognition` para transcribir y `SpeechSynthesis` para leer las respuestas). El soporte no es uniforme:

- **Chrome / Edge (Chromium)**: soporte completo de `SpeechRecognition`. El reconocimiento de voz de Chrome no se procesa localmente: el audio se envía a un servicio remoto de Google para transcribirlo, lo que implica una dependencia de red y de un servicio de terceros durante el reconocimiento.
- **Firefox**: no implementa `SpeechRecognition`. Los usuarios de Firefox verán automáticamente el campo de texto alternativo en lugar del botón de voz.
- **Safari**: soporte parcial e inconsistente según versión de macOS/iOS. Puede fallar de forma silenciosa o requerir permisos adicionales.

Cuando el navegador no soporta reconocimiento de voz, la aplicación lo detecta y activa el modo de texto (`needsTextFallback`) para que la conversación siga siendo posible.

### Requisito de contexto seguro para el micrófono

El acceso al micrófono (`getUserMedia`, base de `SpeechRecognition`) solo está disponible en **contextos seguros**: páginas servidas por **HTTPS** o abiertas en **`localhost`**. Si la aplicación se sirve por HTTP en cualquier otro host, el navegador no expone el micrófono en absoluto y Aura lo señala explícitamente en la interfaz en lugar de fallar en silencio.

## Puesta en marcha local

Requisitos: Node.js 20 o superior y el backend de Aura corriendo (ver [aura-voicebot-backend](https://github.com/l1teeee/aura-voicebot-backend)).

```bash
npm install
cp .env.example .env
```

Edita `.env` y ajusta la URL del backend si no usas el valor por defecto:

```
VITE_API_BASE_URL=http://localhost:3000
```

Arranca el servidor de desarrollo:

```bash
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`, que es un contexto seguro válido para el micrófono.

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente (Vite). |
| `npm run build` | Type-check completo (`vue-tsc --noEmit`) seguido de build de producción. |
| `npm run preview` | Sirve localmente el resultado de `npm run build`. |
| `npm run typecheck` | Type-check sin emitir archivos. |
| `npm run lint` | ESLint sobre todo el proyecto. |

## Despliegue

Este proyecto está desplegado en Vercel: **https://aura-voicebot-frontend.vercel.app/**, conectado a la API en **https://backend-production-1658.up.railway.app**.

El frontend es una SPA estática: cualquier hosting de archivos estáticos con HTTPS por defecto sirve. Dos opciones habituales:

### Vercel

1. Importa el repositorio en Vercel.
2. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
3. Define la variable de entorno `VITE_API_BASE_URL` apuntando a la URL pública del backend desplegado.
4. Despliega. Vercel sirve la app por HTTPS automáticamente, requisito para el micrófono.

### Netlify

1. Importa el repositorio en Netlify.
2. Build command: `npm run build`. Publish directory: `dist`.
3. Define `VITE_API_BASE_URL` en Site settings > Environment variables.
4. Si usas rutas del lado del cliente en el futuro, añade un `_redirects` con `/* /index.html 200`; con una única vista no es necesario todavía.

### Recordatorio importante: CORS

El backend valida el origen de las peticiones mediante la variable de entorno `ALLOWED_ORIGIN`. Tras desplegar el frontend, **actualiza `ALLOWED_ORIGIN` en el backend con la URL final del frontend desplegado** (por ejemplo `https://aura.vercel.app`). Si no coincide exactamente, el navegador bloqueará las peticiones a `/api/chat` por CORS aunque el backend esté funcionando correctamente.
