<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@renderer/components/PageHeader.vue'
import { useAppStore } from '@renderer/stores/app'
import { desktopAPI } from '@renderer/services/desktop-api'

interface FeaturePage {
  title: string
  description: string
  primaryLabel?: string
  items: Array<{ label: string; value: string }>
}

const route = useRoute()
const store = useAppStore()

const pages = computed<Record<string, FeaturePage>>(() => ({
  'workspace-overview': {
    title: 'Workspace overview',
    description: 'A summary page loaded from a nested sidebar item.',
    items: [
      { label: 'Projects', value: '6' },
      { label: 'Active tasks', value: '18' },
      { label: 'Recent files', value: '12' },
    ],
  },
  'workspace-activity': {
    title: 'Recent activity',
    description: 'Changes and events from the current workspace.',
    items: [
      { label: 'Today', value: '8 events' },
      { label: 'This week', value: '34 events' },
      { label: 'Contributors', value: '4' },
    ],
  },
  'tools-files': {
    title: 'File tools',
    description: 'Secure file access through the typed preload bridge.',
    primaryLabel: 'Choose file',
    items: [
      { label: 'Selected', value: store.selectedFile?.name ?? 'None' },
      { label: 'Access', value: 'User initiated' },
      { label: 'Bridge', value: 'Typed IPC' },
    ],
  },
  'tools-diagnostics': {
    title: 'Diagnostics',
    description: 'Runtime details for troubleshooting the desktop application.',
    primaryLabel: 'Open logs',
    items: [
      { label: 'Platform', value: store.platformInfo?.name ?? 'Loading' },
      { label: 'Architecture', value: store.platformInfo?.arch ?? 'Loading' },
      { label: 'Version', value: store.version || 'Loading' },
    ],
  },
}))

const page = computed(
  () =>
    pages.value[String(route.name)] ?? {
      title: 'Feature',
      description: 'Feature page',
      items: [],
    },
)

function runPrimaryAction(): void {
  if (route.name === 'tools-files') void store.selectFile()
  if (route.name === 'tools-diagnostics') void desktopAPI.openLogDirectory()
}
</script>

<template>
  <section class="page">
    <PageHeader :title="page.title" :description="page.description">
      <template v-if="page.primaryLabel" #actions>
        <button type="button" @click="runPrimaryAction">{{ page.primaryLabel }}</button>
      </template>
    </PageHeader>

    <div class="feature-metrics">
      <article v-for="item in page.items" :key="item.label" class="panel feature-metric">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>
  </section>
</template>
