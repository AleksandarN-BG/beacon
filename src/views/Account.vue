<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Account Management</h1>
    <div v-if="user" class="space-y-4">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700">Name</label>
        <input type="text" id="name" v-model="user.name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
      </div>
      <div>
        <label for="phone" class="block text-sm font-medium text-gray-700">Phone Number</label>
        <input type="text" id="phone" v-model="user.phone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
      </div>
      <button @click="updateUser" class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
        Save Changes
      </button>
    </div>
    <div v-else>
      <p>Loading user data...</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      user: null,
    };
  },
  async created() {
    await this.fetchUser();
  },
  methods: {
    async fetchUser() {
      try {
        const response = await fetch('/api/account');
        if (response.ok) {
          this.user = await response.json();
        } else {
          console.error('Failed to fetch user data');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    },
    async updateUser() {
      try {
        const response = await fetch('/api/account', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.user),
        });
        if (response.ok) {
          alert('User data updated successfully');
        } else {
          console.error('Failed to update user data');
        }
      } catch (error) {
        console.error('Error updating user data:', error);
      }
    },
  },
};
</script>