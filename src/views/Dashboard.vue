<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="logo">
        <h1>Beacon</h1>
        <span>When downtime isn't an option.</span>
      </div>
      <div class="user-info">
        <span class="user-role role-admin" v-if="isAdmin">Admin</span>
        <span class="user-role role-engineer" v-else-if="isEngineer">Engineer</span>
        <span>{{ user?.name || user?.email }}</span>
        <button @click="goToAccount" class="btn-account">Account</button>
        <button @click="logout" class="btn-logout">Sign Out</button>
      </div>
    </header>

    <main class="dashboard-content">
      <!-- On-Call Banner -->
      <div class="oncall-banner" v-if="currentOnCall">
        <span class="oncall-label">Currently On-Call:</span>
        <span class="oncall-name">{{ currentOnCall.name }}</span>
        <span class="oncall-until">until {{ formatDate(currentOnCall.endTime) }}</span>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-value">{{ incidents.length }}</span>
          <span class="stat-label">Total Incidents</span>
        </div>
        <div class="stat stat-critical">
          <span class="stat-value">{{ criticalCount }}</span>
          <span class="stat-label">Critical</span>
        </div>
        <div class="stat stat-warning">
          <span class="stat-value">{{ warningCount }}</span>
          <span class="stat-label">Warning</span>
        </div>
        <div class="stat stat-up">
          <span class="stat-value">{{ resolvedCount }}</span>
          <span class="stat-label">Resolved</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          :class="{ active: activeTab === 'incidents' }"
          @click="activeTab = 'incidents'"
        >Incidents</button>
        <button
          :class="{ active: activeTab === 'schedule' }"
          @click="activeTab = 'schedule'"
        >On-Call Schedule</button>
      </div>

      <!-- Incidents Tab -->
      <div v-if="activeTab === 'incidents'" class="incidents-section">
        <div class="section-header">
          <h2>Incidents</h2>
          <button @click="showIncidentModal = true" class="btn-add">+ Report Incident</button>
        </div>

        <div v-if="isLoading" class="loading">Loading incidents...</div>

        <div v-else-if="incidents.length === 0" class="empty-state">
          No incidents reported. That's a good thing!
        </div>

        <div v-else class="incidents-list">
          <div
            v-for="incident in incidents"
            :key="incident.id"
            class="incident-card"
            :class="[`severity-${incident.severity}`, { resolved: incident.status === 'resolved' }]"
          >
            <div class="incident-header">
              <span class="severity-badge" :class="incident.severity">
                {{ incident.severity.toUpperCase() }}
              </span>
              <span class="incident-time">{{ formatDate(incident.createdAt) }}</span>
            </div>
            <h3>{{ incident.title }}</h3>
            <p class="incident-description">{{ incident.description }}</p>
            <div class="incident-meta">
              <span>Reported by: {{ incident.reportedBy }}</span>
              <span v-if="incident.assignedTo">Assigned to: {{ incident.assignedTo }}</span>
            </div>
            <div class="incident-actions">
              <button
                v-if="(isEngineer || isAdmin) && incident.status !== 'resolved'"
                @click="acknowledgeIncident(incident)"
                class="btn-ack"
                :disabled="incident.status === 'acknowledged'"
              >
                {{ incident.status === 'acknowledged' ? 'Acknowledged' : 'Acknowledge' }}
              </button>
              <button
                v-if="incident.status !== 'resolved'"
                @click="resolveIncident(incident)"
                class="btn-resolve"
              >
                Resolve
              </button>
              <button
                v-if="isAdmin && incident.status !== 'resolved'"
                @click="escalateIncident(incident)"
                class="btn-escalate"
              >
                Escalate
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Schedule Tab -->
      <div v-if="activeTab === 'schedule'" class="schedule-section">
        <div class="section-header">
          <h2>On-Call Schedule</h2>
          <button v-if="isAdmin || isEngineer" @click="showScheduleModal = true" class="btn-add">+ Add Shift</button>
        </div>

        <div class="schedule-list">
          <div
            v-for="shift in schedule"
            :key="shift.id"
            class="schedule-card"
            :class="{ 'current-shift': isCurrentShift(shift) }"
          >
            <div class="shift-person">{{ shift.name }}</div>
            <div class="shift-time">
              {{ formatDate(shift.startTime) }} - {{ formatDate(shift.endTime) }}
            </div>
            <div class="shift-contact">{{ shift.phone }}</div>
            <button
              v-if="isAdmin || (isEngineer && canManageShift(shift))"
              @click="deleteShift(shift.id)"
              class="btn-delete-small"
            >Remove</button>
          </div>
        </div>
      </div>
    </main>

    <!-- Report Incident Modal -->
    <div v-if="showIncidentModal" class="modal-overlay" @click.self="showIncidentModal = false">
      <div class="modal">
        <h3>Report Incident</h3>
        <form @submit.prevent="reportIncident">
          <div class="form-group">
            <label>Title</label>
            <input v-model="newIncident.title" placeholder="Brief description of the issue" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="newIncident.description" placeholder="Detailed description..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Severity</label>
            <select v-model="newIncident.severity" required>
              <option value="low">Low - Minor issue, no immediate action needed</option>
              <option value="medium">Medium - Degraded service, needs attention</option>
              <option value="high">High - Major issue, urgent response needed</option>
              <option value="critical">Critical - Complete outage, immediate action required</option>
            </select>
          </div>
          <div class="severity-actions" v-if="newIncident.severity">
            <p class="action-label">Actions that will be taken:</p>
            <ul>
              <li v-if="newIncident.severity === 'low'">Log incident for review</li>
              <li v-if="newIncident.severity === 'medium'">Notify on-call via email</li>
              <li v-if="newIncident.severity === 'high'">Send SMS to on-call engineer</li>
              <li v-if="newIncident.severity === 'critical'">Call on-call engineer immediately</li>
              <li v-if="newIncident.severity === 'critical'">Notify backup on-call if no response</li>
            </ul>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showIncidentModal = false" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">Report</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Schedule Modal -->
    <div v-if="showScheduleModal" class="modal-overlay" @click.self="showScheduleModal = false">
      <div class="modal">
        <h3>Add On-Call Shift</h3>
        <form @submit.prevent="addShift">
          <div class="form-group">
            <label>Name</label>
            <input v-model="newShift.name" placeholder="John Doe" required />
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input v-model="newShift.phone" placeholder="+1234567890" required />
          </div>
          <div class="form-group">
            <label>Start Time</label>
            <input type="datetime-local" v-model="newShift.startTime" required />
          </div>
          <div class="form-group">
            <label>End Time</label>
            <input type="datetime-local" v-model="newShift.endTime" required />
          </div>
          <div class="modal-actions">
            <button type="button" @click="showScheduleModal = false" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">Add Shift</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const user = ref(null)
const userRoles = ref([])
const incidents = ref([])
const schedule = ref([])
const isLoading = ref(true)
const activeTab = ref('incidents')
const lastLogTimestamp = ref(new Date().toISOString())
const showIncidentModal = ref(false)
const showScheduleModal = ref(false)

const newIncident = ref({ title: '', description: '', severity: 'medium' })
const newShift = ref({ name: '', phone: '', startTime: '', endTime: '' })

const isAdmin = computed(() => userRoles.value.includes('admin'))
const isEngineer = computed(() => userRoles.value.includes('engineer'))
const criticalCount = computed(() => incidents.value.filter(i => i.severity === 'critical' && i.status !== 'resolved').length)
const warningCount = computed(() => incidents.value.filter(i => (i.severity === 'high' || i.severity === 'medium') && i.status !== 'resolved').length)
const resolvedCount = computed(() => incidents.value.filter(i => i.status === 'resolved').length)

const currentOnCall = computed(() => {
  const now = new Date()
  return schedule.value.find(s => new Date(s.startTime) <= now && new Date(s.endTime) >= now)
})

function canManageShift(shift) {
  // Engineers can only manage their own shifts
  return shift.userId === user.value?.id || shift.name === user.value?.name
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString()
}

function isCurrentShift(shift) {
  const now = new Date()
  return new Date(shift.startTime) <= now && new Date(shift.endTime) >= now
}

async function fetchIncidents() {
  try {
    const response = await fetch('/api/incidents')
    if (response.ok) {
      const data = await response.json()
      incidents.value = data.incidents || []
    }
  } catch (err) {
    console.error('Failed to fetch incidents:', err)
    // Mock data for demo
    incidents.value = [
      { id: '1', title: 'Database connection timeout', description: 'Users experiencing slow queries', severity: 'high', status: 'open', reportedBy: 'System', createdAt: new Date().toISOString() },
      { id: '2', title: 'SSL certificate expiring', description: 'Certificate expires in 7 days', severity: 'medium', status: 'acknowledged', reportedBy: 'Monitor', assignedTo: 'John', createdAt: new Date().toISOString() }
    ]
  } finally {
    isLoading.value = false
  }
}

async function fetchSchedule() {
  try {
    const response = await fetch('/api/schedule')
    if (response.ok) {
      const data = await response.json()
      schedule.value = data.schedule || []
    }
  } catch (err) {
    console.error('Failed to fetch schedule:', err)
    // Mock data for demo
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    schedule.value = [
      { id: '1', name: 'Alice Smith', phone: '+1234567890', startTime: now.toISOString(), endTime: tomorrow.toISOString() }
    ]
  }
}

async function reportIncident() {
  try {
    const incident = {
      ...newIncident.value,
      reportedBy: user.value?.name || 'Unknown',
      status: 'open',
      createdAt: new Date().toISOString()
    }

    const response = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident)
    })

    if (response.ok) {
      const created = await response.json()
      incidents.value.unshift(created)
    } else {
      // Add locally for demo
      incidents.value.unshift({ ...incident, id: Date.now().toString() })
    }

    showIncidentModal.value = false
    newIncident.value = { title: '', description: '', severity: 'medium' }
  } catch (err) {
    console.error('Failed to report incident:', err)
  }
}

async function acknowledgeIncident(incident) {
  try {
    const response = await fetch(`/api/incidents?id=${incident.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' })
    })
    
    if (response.ok) {
      const updated = await response.json()
      // Update local state with response from server
      Object.assign(incident, updated)
    } else {
      const error = await response.json()
      alert(`Failed to acknowledge: ${error.error || 'Unknown error'}`)
    }
  } catch (err) {
    console.error('Failed to acknowledge incident:', err)
    alert('Failed to acknowledge incident. Check console for details.')
  }
}

async function resolveIncident(incident) {
  try {
    const response = await fetch(`/api/incidents?id=${incident.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' })
    })
    
    if (response.ok) {
      const updated = await response.json()
      // Update local state
      Object.assign(incident, updated)
    } else {
      const error = await response.json()
      alert(`Failed to resolve: ${error.error || 'Unknown error'}`)
    }
  } catch (err) {
    console.error('Failed to resolve incident:', err)
    alert('Failed to resolve incident. Check console for details.')
  }
}

async function escalateIncident(incident) {
  if (currentOnCall.value) {
    try {
      await fetch('/api/alert-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: currentOnCall.value.phone,
          service: incident.title,
          incidentId: incident.id
        })
      })
      alert('Escalation call initiated to ' + currentOnCall.value.name)
    } catch (err) {
      console.error('Failed to escalate:', err)
    }
  } else {
    alert('No one is currently on-call')
  }
}

async function addShift() {
  try {
    const shift = { ...newShift.value }

    const response = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shift)
    })

    if (response.ok) {
      const created = await response.json()
      schedule.value.push(created)
    } else {
      schedule.value.push({ ...shift, id: Date.now().toString() })
    }

    showScheduleModal.value = false
    newShift.value = { name: '', phone: '', startTime: '', endTime: '' }
  } catch (err) {
    console.error('Failed to add shift:', err)
  }
}

async function deleteShift(id) {
  if (!confirm('Remove this shift?')) return
  
  try {
    const response = await fetch(`/api/schedule?id=${id}`, {
      method: 'DELETE'
    })
    
    if (response.ok) {
      schedule.value = schedule.value.filter(s => s.id !== id)
    } else {
      const error = await response.json()
      alert(`Failed to delete shift: ${error.error || 'Unknown error'}`)
    }
  } catch (err) {
    console.error('Failed to delete shift:', err)
    alert('Failed to delete shift. Check console for details.')
  }
}

function logout() {
  window.location.href = '/.auth/logout?post_logout_redirect_uri=/'
}

function goToAccount() {
  router.push('/account')
}

async function fetchUser() {
  try {
    const response = await fetch('/.auth/me')
    const data = await response.json()
    if (data.clientPrincipal) {
      user.value = {
        id: data.clientPrincipal.userId,
        name: data.clientPrincipal.userDetails,
        provider: data.clientPrincipal.identityProvider
      }
      
      // Initially use roles from SWA (Standard Plan)
      userRoles.value = data.clientPrincipal.userRoles || []
      
      // Then supplement with roles from our API (Free Plan support)
      try {
        const apiResponse = await fetch('/api/users?me=true')
        if (apiResponse.ok) {
          const apiUser = await apiResponse.json()
          if (apiUser && apiUser.roles) {
            userRoles.value = apiUser.roles
          }
        }
      } catch (apiErr) {
        console.warn('Failed to fetch augmented roles from API:', apiErr)
      }

      // Start log polling for admins/engineers
      if (isAdmin.value || isEngineer.value) {
        startLogPolling()
      }
    } else {
      router.push('/')
    }
  } catch (err) {
    router.push('/')
  }
}

let logPollingInterval = null;
function startLogPolling() {
  if (logPollingInterval) return;
  
  // Poll every 10 seconds
  logPollingInterval = setInterval(fetchLogs, 10000);
  fetchLogs(); // Initial fetch
}

async function fetchLogs() {
  try {
    const response = await fetch('/api/logs')
    if (response.ok) {
      const data = await response.json()
      const newLogs = data.logs.filter(log => log.timestamp > lastLogTimestamp.value)
      
      if (newLogs.length > 0) {
        newLogs.reverse().forEach(log => {
          const time = new Date(log.timestamp).toLocaleTimeString()
          const msg = `[${log.source}] ${log.message}`
          
          if (log.level === 'error') {
            console.error(`BEACON ERROR [${time}]: ${msg}`, log.details || '')
          } else if (log.level === 'warn') {
            console.warn(`BEACON WARN [${time}]: ${msg}`, log.details || '')
          } else {
            console.log(`BEACON INFO [${time}]: ${msg}`)
          }
        })
        
        lastLogTimestamp.value = data.logs[0].timestamp
      }
    }
  } catch (err) {
    // Quietly fail log polling
  }
}

onMounted(() => {
  fetchUser()
  fetchIncidents()
  fetchSchedule()
})

onUnmounted(() => {
  if (logPollingInterval) {
    clearInterval(logPollingInterval)
  }
})
</script>
