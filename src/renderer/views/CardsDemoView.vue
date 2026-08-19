<script setup lang="ts">
import { ref } from 'vue'
import { MoreHorizontal, Plus } from '@lucide/vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import PageHeader from '@renderer/components/PageHeader.vue'

const createOpen = ref(false)
const selectedWorkspace = ref<string | null>(null)
const workspaceName = ref('')

const workspaces = [
  {
    name: 'Desktop platform',
    description: 'Core shell, IPC, updater and packaging.',
    status: 'On track',
    progress: 78,
    members: 8,
    tone: 'teal',
  },
  {
    name: 'Design system',
    description: 'Shared components and interaction patterns.',
    status: 'At risk',
    progress: 54,
    members: 5,
    tone: 'amber',
  },
  {
    name: 'Import service',
    description: 'Validated data ingestion and migration.',
    status: 'On track',
    progress: 86,
    members: 4,
    tone: 'blue',
  },
  {
    name: 'Release operations',
    description: 'Build pipelines and staged deployments.',
    status: 'Planning',
    progress: 32,
    members: 6,
    tone: 'gray',
  },
  {
    name: 'Diagnostics',
    description: 'Logging, crash reports and support tooling.',
    status: 'On track',
    progress: 65,
    members: 3,
    tone: 'teal',
  },
  {
    name: 'Localization',
    description: 'Language packs and regional settings.',
    status: 'Planning',
    progress: 21,
    members: 2,
    tone: 'gray',
  },
]
</script>

<template>
  <section class="page compact-page">
    <PageHeader title="Workspaces" description="6 active workspaces">
      <template #actions>
        <button type="button" @click="createOpen = true"><Plus :size="16" />New workspace</button>
      </template>
    </PageHeader>
    <div class="workspace-card-grid">
      <article v-for="workspace in workspaces" :key="workspace.name" class="workspace-card">
        <header>
          <span class="workspace-mark" :class="workspace.tone">{{ workspace.name.charAt(0) }}</span
          ><button
            class="card-menu-button"
            type="button"
            aria-label="Workspace actions"
            @click="selectedWorkspace = workspace.name"
          >
            <MoreHorizontal :size="18" />
          </button>
        </header>
        <div>
          <h2>{{ workspace.name }}</h2>
          <p>{{ workspace.description }}</p>
        </div>
        <div class="card-progress">
          <span
            ><small>Progress</small><strong>{{ workspace.progress }}%</strong></span
          ><progress max="100" :value="workspace.progress" />
        </div>
        <footer>
          <span class="status-badge" :class="workspace.tone">{{ workspace.status }}</span
          ><small>{{ workspace.members }} members</small>
        </footer>
      </article>
    </div>

    <AppDialog
      :open="createOpen"
      title="New workspace"
      description="Create an isolated area for a team or project."
      @close="createOpen = false"
    >
      <label class="dialog-field">
        <span>Workspace name</span>
        <input v-model="workspaceName" placeholder="Enter a workspace name" />
      </label>
      <template #footer>
        <button class="secondary-button" type="button" @click="createOpen = false">Cancel</button>
        <button type="button" :disabled="!workspaceName.trim()" @click="createOpen = false">
          Create
        </button>
      </template>
    </AppDialog>

    <AppDialog
      :open="Boolean(selectedWorkspace)"
      title="Workspace actions"
      :description="selectedWorkspace ?? ''"
      @close="selectedWorkspace = null"
    >
      <div class="dialog-action-list">
        <button type="button" @click="selectedWorkspace = null">Open workspace</button>
        <button class="secondary-button" type="button" @click="selectedWorkspace = null">
          Duplicate
        </button>
      </div>
    </AppDialog>
  </section>
</template>
