<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  titleClass?: string
}>()
</script>

<template>
  <header class="page-title-row" :class="titleClass">
    <slot name="title"
      ><h1>{{ title }}</h1></slot
    >
    <p v-if="description">{{ description }}</p>
  </header>
  <div v-if="$slots.search || $slots.actions" class="page-action-row">
    <slot name="search" />
    <div v-if="$slots.actions" class="page-toolbar-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
