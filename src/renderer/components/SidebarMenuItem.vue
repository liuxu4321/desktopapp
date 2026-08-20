<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronDown } from '@lucide/vue'
import type { SidebarMenuItem as MenuItem } from '@renderer/types/navigation'

defineOptions({ name: 'SidebarMenuItem' })

const props = withDefaults(
  defineProps<{
    item: MenuItem
    collapsed: boolean
    depth?: number
    forceOpen?: boolean
  }>(),
  {
    depth: 0,
    forceOpen: false,
  },
)

const emit = defineEmits<{
  requestExpand: []
}>()

const route = useRoute()
const open = ref(props.item.defaultOpen ?? false)
const hasChildren = computed(() => Boolean(props.item.children?.length))
const containsActiveRoute = computed(() => itemContainsPath(props.item, route.path))
const expanded = computed(() => props.forceOpen || open.value)
const itemStyle = computed(() =>
  props.collapsed ? undefined : { paddingLeft: `${10 + props.depth * 16}px` },
)

watch(
  containsActiveRoute,
  (active) => {
    if (active) open.value = true
  },
  { immediate: true },
)

function toggleChildren(): void {
  if (props.collapsed) {
    emit('requestExpand')
    open.value = true
    return
  }
  open.value = !open.value
}

function itemContainsPath(item: MenuItem, path: string): boolean {
  if (item.to === path) return true
  return item.children?.some((child) => itemContainsPath(child, path)) ?? false
}
</script>

<template>
  <div class="menu-node">
    <button
      v-if="hasChildren"
      class="nav-link menu-trigger"
      type="button"
      :style="itemStyle"
      :aria-expanded="expanded"
      :title="collapsed ? item.label : undefined"
      @click="toggleChildren"
    >
      <component :is="item.icon" :size="19" aria-hidden="true" />
      <span v-if="!collapsed" class="menu-label">{{ item.label }}</span>
      <span v-if="item.attention" class="menu-attention-dot" aria-label="有新版本"></span>
      <ChevronDown
        v-if="!collapsed"
        class="menu-chevron"
        :class="{ open: expanded }"
        :size="16"
        aria-hidden="true"
      />
    </button>

    <RouterLink
      v-else-if="item.to"
      class="nav-link"
      :to="item.to"
      :style="itemStyle"
      :title="collapsed ? item.label : undefined"
    >
      <component :is="item.icon" :size="19" aria-hidden="true" />
      <span v-if="!collapsed" class="menu-label">{{ item.label }}</span>
      <span v-if="item.attention" class="menu-attention-dot" aria-label="有新版本"></span>
    </RouterLink>

    <div v-if="hasChildren && expanded && !collapsed" class="menu-children">
      <SidebarMenuItem
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :collapsed="collapsed"
        :depth="depth + 1"
        :force-open="forceOpen"
        @request-expand="emit('requestExpand')"
      />
    </div>
  </div>
</template>
