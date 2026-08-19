<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import { useAppStore } from '@renderer/stores/app'

const store = useAppStore()
const fileSize = computed(() =>
  store.selectedFile ? `${(store.selectedFile.size / 1024).toFixed(1)} KB` : '',
)

function chooseFile(): void {
  void store.selectFile()
}
</script>

<template>
  <section class="page">
    <PageHeader title="Home" description="Secure desktop integration through typed preload APIs.">
      <template #actions>
        <button type="button" :disabled="store.selectingFile" @click="chooseFile">
          {{ store.selectingFile ? 'Selecting...' : 'Choose File' }}
        </button>
      </template>
    </PageHeader>

    <div class="grid">
      <article class="panel">
        <h2>Runtime</h2>
        <dl v-if="store.platformInfo">
          <dt>Platform</dt>
          <dd>{{ store.platformInfo.name }} {{ store.platformInfo.arch }}</dd>
          <dt>Electron</dt>
          <dd>{{ store.platformInfo.versions.electron }}</dd>
          <dt>Chrome</dt>
          <dd>{{ store.platformInfo.versions.chrome }}</dd>
        </dl>
      </article>

      <article class="panel">
        <h2>Selected File</h2>
        <div v-if="store.selectedFile" class="file-details">
          <strong>{{ store.selectedFile.name }}</strong>
          <span>{{ store.selectedFile.path }}</span>
          <small>{{ fileSize }}</small>
        </div>
        <p v-else class="empty">No file selected yet.</p>
      </article>
    </div>
  </section>
</template>
