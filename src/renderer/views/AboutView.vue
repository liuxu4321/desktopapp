<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import { useAppStore } from '@renderer/stores/app'
import { desktopAPI } from '@renderer/services/desktop-api'

const store = useAppStore()
const autoUpdateText = computed(() =>
  store.platformInfo?.canAutoUpdate
    ? 'Built-in updates are available on this platform.'
    : 'Use your app store or system package manager to update Linux builds.',
)

function openWebsite(): void {
  void desktopAPI.openExternal('https://github.com/')
}
</script>

<template>
  <section class="page">
    <PageHeader title="About" :description="`Version ${store.version}`">
      <template #actions>
        <button type="button" @click="openWebsite">Open Website</button>
      </template>
    </PageHeader>

    <article class="panel">
      <h2>Updates</h2>
      <p>{{ autoUpdateText }}</p>
      <div class="update-row">
        <button
          type="button"
          :disabled="['checking', 'downloading'].includes(store.updateState.status)"
          @click="store.checkForUpdates"
        >
          Check
        </button>
        <button
          v-if="store.updateState.status === 'downloaded'"
          type="button"
          @click="store.installUpdate"
        >
          Restart and Install
        </button>
      </div>
      <p class="status">{{ store.updateState.message }}</p>
      <progress
        v-if="store.updateState.progress"
        max="100"
        :value="store.updateState.progress.percent"
      />
    </article>
  </section>
</template>
