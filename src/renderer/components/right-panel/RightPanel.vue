<script setup lang="ts">
import { computed, ref } from 'vue'
import { PanelRightClose } from '@lucide/vue'
import { rightPanelTools } from './tools'

defineProps<{
  open: boolean
  pageLabel: string
}>()

defineEmits<{
  close: []
}>()

const activeToolId = ref(rightPanelTools[0]?.id ?? '')
const activeTool = computed(
  () => rightPanelTools.find((tool) => tool.id === activeToolId.value) ?? rightPanelTools[0],
)
</script>

<template>
  <aside class="right-panel" :aria-hidden="!open">
    <div class="right-panel-inner">
      <header class="right-panel-toolbar">
        <div class="right-panel-tabs" role="tablist" aria-label="Right panel tools">
          <button
            v-for="tool in rightPanelTools"
            :key="tool.id"
            type="button"
            role="tab"
            :aria-selected="activeToolId === tool.id"
            :class="{ active: activeToolId === tool.id }"
            @click="activeToolId = tool.id"
          >
            <component :is="tool.icon" :size="18" aria-hidden="true" />
            <span>{{ tool.label }}</span>
          </button>
        </div>

        <button
          class="right-panel-close"
          type="button"
          aria-label="Hide right panel"
          title="Hide right panel"
          @click="$emit('close')"
        >
          <PanelRightClose :size="18" aria-hidden="true" />
        </button>
      </header>

      <KeepAlive>
        <component
          :is="activeTool.component"
          v-if="activeTool"
          :key="activeTool.id"
          :page-label="pageLabel"
        />
      </KeepAlive>
    </div>
  </aside>
</template>
