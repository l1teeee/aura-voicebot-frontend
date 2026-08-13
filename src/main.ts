import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { chatGatewayKey } from '@/config/injection'
import { HttpChatGateway } from '@/infrastructure/api/httpChatGateway'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.provide(chatGatewayKey, new HttpChatGateway())
app.mount('#app')
