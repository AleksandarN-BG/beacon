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
      <p class="login-subtitle">Sign in to report an incident</p>
      <div class="auth-buttons">
        <a href="/.auth/login/aad?post_login_redirect_uri=/dashboard" class="btn-login btn-microsoft">
          Sign in with Microsoft
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

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

async function checkAuth() {
  try {
    const response = await fetch('/.auth/me')
    const data = await response.json()
    if (data.clientPrincipal) {
      router.push('/dashboard')
    }
  } catch (err) {
    // Not authenticated, stay on login page
  }
}

onMounted(() => {
  checkAuth()

  for (let i = 0; i < NUM_EMITTERS; i++) {
    const timeout = setTimeout(() => createEmitter(), i * 2000)
    timeouts.value.push(timeout)
  }
})

onUnmounted(() => {
  timeouts.value.forEach(t => clearTimeout(t))
})
</script>

