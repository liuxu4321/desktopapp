<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps<{
  open: boolean
  title: string
  description?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open && !dialog.value?.open) dialog.value?.showModal()
    if (!open && dialog.value?.open) dialog.value.close()
  },
  { immediate: true },
)

function close(): void {
  emit('close')
}

function closeFromBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) close()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="app-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="close"
    @click="closeFromBackdrop"
  >
    <div class="dialog-surface">
      <header class="dialog-header">
        <div>
          <h2 :id="titleId">{{ title }}</h2>
          <p v-if="description">{{ description }}</p>
        </div>
        <button class="dialog-close" type="button" aria-label="Close dialog" @click="close">
          <X :size="18" aria-hidden="true" />
        </button>
      </header>

      <div class="dialog-body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="dialog-footer">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>
