<script setup lang="ts">
import { ref } from 'vue'
import { Pin } from '@lucide/vue'

defineProps<{
  pageLabel: string
}>()

const pinned = ref(false)
</script>

<template>
  <div class="right-panel-content" role="tabpanel">
    <section class="right-panel-section">
      <h2>{{ pageLabel }}</h2>
      <dl class="right-panel-details">
        <dt>Status</dt>
        <dd><span class="status-badge active">Active</span></dd>
        <dt>Owner</dt>
        <dd>Desktop User</dd>
        <dt>Updated</dt>
        <dd>Just now</dd>
      </dl>
    </section>

    <section class="right-panel-section">
      <h2>Pinned</h2>
      <button
        class="right-panel-action"
        :class="{ active: pinned }"
        type="button"
        :aria-pressed="pinned"
        @click="pinned = !pinned"
      >
        <Pin :size="16" aria-hidden="true" />
        <span>{{ pinned ? 'Page pinned' : 'Pin current page' }}</span>
      </button>
    </section>

    <section class="right-panel-section">
      <h2>Recent activity</h2>
      <ol class="panel-activity-list">
        <li>
          <i></i><span><strong>Page opened</strong><small>Just now</small></span>
        </li>
        <li>
          <i></i><span><strong>Application state loaded</strong><small>1 min ago</small></span>
        </li>
        <li>
          <i></i><span><strong>Workspace synchronized</strong><small>4 min ago</small></span>
        </li>
      </ol>
    </section>
  </div>
</template>
