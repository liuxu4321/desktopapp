<script setup lang="ts">
import { ref } from 'vue'
import { AlertCircle, FilePenLine, Info, Trash2 } from '@lucide/vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import PageHeader from '@renderer/components/PageHeader.vue'

const infoOpen = ref(false)
const formOpen = ref(false)
const confirmOpen = ref(false)
const workspaceName = ref('Desktop platform')
</script>

<template>
  <section class="page compact-page">
    <PageHeader title="Dialogs" description="Common modal interaction patterns." />
    <div class="dialog-demo-list">
      <article>
        <span class="demo-icon info"><Info :size="19" /></span>
        <div>
          <h2>Information dialog</h2>
          <p>Present contextual information without leaving the current page.</p>
        </div>
        <button class="secondary-button" type="button" @click="infoOpen = true">Open</button>
      </article>
      <article>
        <span class="demo-icon form"><FilePenLine :size="19" /></span>
        <div>
          <h2>Form dialog</h2>
          <p>Collect a small amount of focused input.</p>
        </div>
        <button class="secondary-button" type="button" @click="formOpen = true">Open</button>
      </article>
      <article>
        <span class="demo-icon danger"><Trash2 :size="19" /></span>
        <div>
          <h2>Confirmation dialog</h2>
          <p>Require confirmation before a destructive action.</p>
        </div>
        <button class="secondary-button" type="button" @click="confirmOpen = true">Open</button>
      </article>
    </div>

    <AppDialog
      :open="infoOpen"
      title="Update available"
      description="Version 0.2.0 is ready to install."
      @close="infoOpen = false"
      ><div class="dialog-callout">
        <AlertCircle :size="20" />
        <p>The update will be installed the next time the application restarts.</p>
      </div>
      <template #footer
        ><button type="button" @click="infoOpen = false">Got it</button></template
      ></AppDialog
    >
    <AppDialog
      :open="formOpen"
      title="Rename workspace"
      description="Choose a clear name for this workspace."
      @close="formOpen = false"
      ><label class="dialog-field"
        ><span>Workspace name</span><input v-model="workspaceName" /></label
      ><template #footer
        ><button class="secondary-button" type="button" @click="formOpen = false">Cancel</button
        ><button type="button" @click="formOpen = false">Save</button></template
      ></AppDialog
    >
    <AppDialog
      :open="confirmOpen"
      title="Delete workspace?"
      description="This action cannot be undone."
      @close="confirmOpen = false"
      ><p class="dialog-message">
        All local workspace data and settings will be permanently removed.
      </p>
      <template #footer
        ><button class="secondary-button" type="button" @click="confirmOpen = false">Cancel</button
        ><button class="danger-button" type="button" @click="confirmOpen = false">
          Delete
        </button></template
      ></AppDialog
    >
  </section>
</template>
