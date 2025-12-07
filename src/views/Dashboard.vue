<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="logo">
        <h1>Beacon</h1>
        <span>When downtime isn't an option.</span>
      </div>
      <div class="user-info">
        <span>{{ user?.name || user?.email }}</span>
        <button @click="logout" class="btn-logout">Sign Out</button>
      </div>
    </header>

    <main class="dashboard-content">
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-value">{{ monitors.length }}</span>
          <span class="stat-label">Monitors</span>
        </div>
        <div class="stat stat-up">
          <span class="stat-value">{{ upCount }}</span>
          <span class="stat-label">Online</span>
        </div>
        <div class="stat stat-down">
          <span class="stat-value">{{ downCount }}</span>
          <span class="stat-label">Offline</span>
        </div>
      </div>

      <div class="monitors-section">
        <div class="section-header">
          <h2>Monitors</h2>
          <button @click="showAddModal = true" class="btn-add">+ Add Monitor</button>
        </div>

        <div v-if="isLoading" class="loading">Loading monitors...</div>

        <div v-else class="monitors-grid">
          <div
            v-for="monitor in monitors"
            :key="monitor.id"
            class="monitor-card"
            :class="{ 'monitor-down': monitor.status === 'down' }"
          >
            <div class="monitor-status">
              <span class="status-dot" :class="monitor.status"></span>
              <span class="status-text">{{ monitor.status.toUpperCase() }}</span>
            </div>
            <h3>{{ monitor.name }}</h3>
            <p class="monitor-url">{{ monitor.url }}</p>
            <div class="monitor-uptime">
              <span>Uptime: {{ monitor.uptime }}%</span>
            </div>
            <div class="monitor-actions">
              <button @click="testAlert(monitor)" class="btn-test">Test Alert</button>
              <button @click="deleteMonitor(monitor.id)" class="btn-delete">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Add Monitor Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>Add Monitor</h3>
        <form @submit.prevent="addMonitor">
          <div class="form-group">
            <label>Name</label>
            <input v-model="newMonitor.name" placeholder="My API Server" required />
          </div>
          <div class="form-group">
            <label>URL</label>
            <input v-model="newMonitor.url" placeholder="https://api.example.com" required />
          </div>
          <div class="form-group">
            <label>Alert Phone (optional)</label>
            <input v-model="newMonitor.alertPhone" placeholder="+1234567890" />
          </div>
          <div class="modal-actions">
            <button type="button" @click="showAddModal = false" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const user = ref(null)
const monitors = ref([])
const isLoading = ref(true)
const showAddModal = ref(false)
const newMonitor = ref({ name: '', url: '', alertPhone: '' })

const upCount = computed(() => monitors.value.filter(m => m.status === 'up').length)
const downCount = computed(() => monitors.value.filter(m => m.status === 'down').length)

async function fetchMonitors() {
  try {
    const response = await fetch('/api/status')
    const data = await response.json()
    monitors.value = data.monitors || []
  } catch (err) {
    console.error('Failed to fetch monitors:', err)
  } finally {
    isLoading.value = false
  }
}

async function addMonitor() {
  try {
    const response = await fetch('/api/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMonitor.value)
    })

    if (response.ok) {
      const created = await response.json()
      monitors.value.push(created)
      showAddModal.value = false
      newMonitor.value = { name: '', url: '', alertPhone: '' }
    }
  } catch (err) {
    console.error('Failed to add monitor:', err)
  }
}

async function deleteMonitor(id) {
  if (!confirm('Are you sure you want to delete this monitor?')) return

  try {
    const response = await fetch(`/api/monitors?id=${id}`, { method: 'DELETE' })
    if (response.ok) {
      monitors.value = monitors.value.filter(m => m.id !== id)
    }
  } catch (err) {
    console.error('Failed to delete monitor:', err)
  }
}

async function testAlert(monitor) {
  if (!monitor.alertPhone) {
    alert('No phone number configured for this monitor')
    return
  }

  try {
    await fetch('/api/alert-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: monitor.alertPhone,
        service: monitor.name,
        status: 'down'
      })
    })
    alert('Test alert sent!')
  } catch (err) {
    console.error('Failed to send test alert:', err)
  }
}

function logout() {
  localStorage.removeItem('user')
  router.push('/')
}

onMounted(() => {
  const stored = localStorage.getItem('user')
  if (!stored) {
    router.push('/')
    return
  }
  user.value = JSON.parse(stored)
  fetchMonitors()
})
</script>

