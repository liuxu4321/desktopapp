<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@renderer/components/AppShell.vue'
import { useAppStore } from '@renderer/stores/app'

const store = useAppStore()

onMounted(() => {
  void store.initialize()
})
</script>

<template>
  <AppShell />
</template>
