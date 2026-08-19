<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@renderer/components/PageHeader.vue'

const displayName = ref('Desktop User')
const email = ref('desktop.user@example.com')
const saved = ref(false)

function saveProfile(): void {
  saved.value = true
  window.setTimeout(() => {
    saved.value = false
  }, 2000)
}
</script>

<template>
  <section class="page">
    <PageHeader title="Profile" description="Manage your personal information." />

    <form class="panel profile-form" @submit.prevent="saveProfile">
      <h2>Personal information</h2>
      <label>
        <span>Display name</span>
        <input v-model="displayName" autocomplete="name" />
      </label>
      <label>
        <span>Email</span>
        <input v-model="email" type="email" autocomplete="email" />
      </label>
      <div class="form-actions">
        <span v-if="saved" class="save-status" role="status">Changes saved</span>
        <button type="submit">Save changes</button>
      </div>
    </form>
  </section>
</template>
