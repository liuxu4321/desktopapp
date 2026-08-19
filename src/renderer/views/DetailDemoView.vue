<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Pencil } from '@lucide/vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import PageHeader from '@renderer/components/PageHeader.vue'

const router = useRouter()
const editOpen = ref(false)
const projectName = ref('Desktop shell modernization')
</script>

<template>
  <section class="page compact-page detail-page">
    <button class="inline-back-button" type="button" @click="router.push('/examples/list')">
      <ArrowLeft :size="16" />Projects
    </button>
    <PageHeader
      title="Desktop shell modernization"
      description="PRJ-1042 · Updated 2 minutes ago"
      title-class="detail-title-row"
    >
      <template #title>
        <div class="detail-title-heading">
          <span class="status-badge active">Active</span>
          <h1>Desktop shell modernization</h1>
        </div>
      </template>
      <template #actions>
        <button type="button" @click="editOpen = true"><Pencil :size="16" />Edit</button>
      </template>
    </PageHeader>
    <div class="detail-layout">
      <div class="detail-main">
        <section class="detail-section">
          <h2>Overview</h2>
          <p>
            Modernize the desktop application shell with reusable navigation, typed IPC boundaries,
            resilient updates and production packaging.
          </p>
        </section>
        <section class="detail-section">
          <h2>Recent activity</h2>
          <ol class="activity-timeline">
            <li>
              <i></i>
              <div>
                <strong>Navigation structure updated</strong>
                <p>Maya Chen added nested application routes.</p>
                <small>2 minutes ago</small>
              </div>
            </li>
            <li>
              <i></i>
              <div>
                <strong>Build completed</strong>
                <p>macOS ARM64 package passed smoke testing.</p>
                <small>34 minutes ago</small>
              </div>
            </li>
            <li>
              <i></i>
              <div>
                <strong>Theme preference changed</strong>
                <p>Noah Kim selected system appearance.</p>
                <small>Yesterday</small>
              </div>
            </li>
          </ol>
        </section>
      </div>
      <aside class="detail-aside">
        <section>
          <h2>Properties</h2>
          <dl class="compact-details">
            <dt>Owner</dt>
            <dd>Maya Chen</dd>
            <dt>Priority</dt>
            <dd>High</dd>
            <dt>Started</dt>
            <dd>Aug 12, 2026</dd>
            <dt>Due</dt>
            <dd>Sep 4, 2026</dd>
            <dt>Team</dt>
            <dd>Platform</dd>
          </dl>
        </section>
        <section>
          <h2>Progress</h2>
          <div class="detail-progress"><strong>78%</strong><progress max="100" value="78" /></div>
        </section>
      </aside>
    </div>

    <AppDialog
      :open="editOpen"
      title="Edit project"
      description="Update the project information."
      @close="editOpen = false"
    >
      <label class="dialog-field">
        <span>Project name</span>
        <input v-model="projectName" />
      </label>
      <template #footer>
        <button class="secondary-button" type="button" @click="editOpen = false">Cancel</button>
        <button type="button" @click="editOpen = false">Save</button>
      </template>
    </AppDialog>
  </section>
</template>
