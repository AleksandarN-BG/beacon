import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './assets/styles.css'

import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'

const routes = [
  { path: '/', name: 'Login', component: Login },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')

