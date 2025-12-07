<template>
  <div class="container" ref="container">
    <!-- Circle emitters will be added here -->
    <div
      v-for="emitter in emitters"
      :key="emitter.id"
      class="circle-emitter"
      :style="{ left: emitter.x + '%', top: emitter.y + '%' }"
    >
      <div class="circle"></div>
      <div class="circle"></div>
    </div>

    <!-- Branding -->
    <div class="branding">
      <h1>Beacon</h1>
      <p>When downtime isn't an option.</p>
    </div>

    <!-- Login Form -->
    <div class="login-form">
      <h2>Let's fix this.</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            v-model="email"
            placeholder="Enter your email"
            required
          />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="Enter your password"
            required
          />
        </div>
        <button type="submit" class="btn-login" :disabled="isLoading">
          {{ isLoading ? 'Signing in...' : 'Sign In' }}
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

const emitters = ref([])
const emitterIdCounter = ref(0)
const timeouts = ref([])

const NUM_EMITTERS = 3
const ANIMATION_DURATION = 6000

function createEmitter() {
  const id = emitterIdCounter.value++
  const emitter = {
    id,
    x: Math.random() * 100,
    y: Math.random() * 100
  }
  emitters.value.push(emitter)

  const timeout = setTimeout(() => {
    emitters.value = emitters.value.filter(e => e.id !== id)
    createEmitter()
  }, ANIMATION_DURATION)

  timeouts.value.push(timeout)
}

async function handleLogin() {
  isLoading.value = true
  error.value = ''

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/dashboard')
    } else {
      error.value = data.error || 'Invalid credentials'
    }
  } catch (err) {
    error.value = 'Unable to connect to server'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  for (let i = 0; i < NUM_EMITTERS; i++) {
    const timeout = setTimeout(() => createEmitter(), i * 2000)
    timeouts.value.push(timeout)
  }
})

onUnmounted(() => {
  timeouts.value.forEach(t => clearTimeout(t))
})
</script>

