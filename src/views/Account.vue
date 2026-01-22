<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="logo">
        <h1>Beacon</h1>
        <span>Account Management</span>
      </div>
      <div class="user-info">
        <button @click="goToDashboard" class="btn-account">Back to Dashboard</button>
      </div>
    </header>

    <main class="dashboard-content">
      <div class="account-form">
        <div v-if="user" class="modal" style="display: block; position: relative; box-shadow: none;">
          <h3>My Profile</h3>
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" v-model="user.name" placeholder="Your full name" />
          </div>
          <div class="form-group">
            <label for="phone">Phone Number</label>
            <input type="text" id="phone" v-model="user.phone" placeholder="+1234567890" />
          </div>
          <div class="modal-actions">
            <button @click="updateUser" class="btn-save" :disabled="isSaving">
              {{ isSaving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
           <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
        </div>
        <div v-else class="loading">
          Loading user data...
        </div>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  data() {
    return {
      user: null,
      isSaving: false,
      successMessage: ''
    };
  },
  async created() {
    await this.fetchUser();
  },
  methods: {
    async fetchUser() {
      try {
        // First, get the user's identity from SWA
        const meResponse = await fetch('/.auth/me');
        const meData = await meResponse.json();
        const clientPrincipal = meData.clientPrincipal;

        if (clientPrincipal) {
          // Then, fetch the detailed profile from our own API
          const response = await fetch(`/api/users?id=${clientPrincipal.userId}`);
          if (response.ok) {
            this.user = await response.json();
          } else {
             // If user doesn't exist in our DB, create a shell
            this.user = {
              id: clientPrincipal.userId,
              name: clientPrincipal.userDetails,
              phone: ''
            };
          }
        } else {
          this.$router.push('/'); // Not logged in
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    },
    async updateUser() {
      if (!this.user) return;
      this.isSaving = true;
      this.successMessage = '';
      try {
        const response = await fetch('/api/account', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: this.user.id,
            name: this.user.name,
            phone: this.user.phone,
          }),
        });
        if (response.ok) {
          this.successMessage = 'Profile updated successfully!';
        } else {
          const error = await response.json();
          alert(`Failed to update: ${error.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error updating user data:', error);
        alert('An error occurred while saving. Please check the console.');
      } finally {
        this.isSaving = false;
      }
    },
    goToDashboard() {
      this.$router.push('/dashboard');
    },
  },
};
</script>

<style scoped>
.account-form {
  max-width: 600px;
  margin: 2rem auto;
}
.success-message {
  margin-top: 1rem;
  color: #28a745;
  text-align: center;
}
</style>
