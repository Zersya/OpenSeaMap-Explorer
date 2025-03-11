import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'

const app = createApp(App)

// Register global components
app.component('ErrorBoundary', ErrorBoundary)

// Use Pinia for state management
app.use(createPinia())

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err)
  console.error('Error info:', info)
}

// Mount the app
app.mount('#app')
