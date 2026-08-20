<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import VuePdfEmbed, { GlobalWorkerOptions } from 'vue-pdf-embed/dist/index.essential.mjs'
import { enhanceDocumentRaster } from '@shared/document-image-enhancement'

GlobalWorkerOptions.workerSrc = PdfWorker

interface PdfPageLike {
  getViewport(options: { scale: number }): { height: number; width: number }
}

interface PdfDocumentLike {
  numPages: number
  getPage(pageNumber: number): Promise<PdfPageLike>
}

const props = defineProps<{
  source?: string
  zoom: number
  label: string
  fit?: 'page' | 'width'
  enhanced?: boolean
  continuous?: boolean
  normalizedPageAspectRatio?: number
}>()

const emit = defineEmits<{
  pageAspectRatio: [ratio: number]
  rendered: []
  scrollPosition: [scrollTop: number]
}>()

const container = ref<HTMLDivElement | null>(null)
const containerSize = ref({ width: 0, height: 0 })
const pageAspectRatio = ref(765 / 595)
const pageCount = ref(1)
const loading = ref(false)
const error = ref('')
const renderSource = shallowRef<string | Uint8Array | undefined>()
const renderRevision = ref(0)
let originalRasters = new WeakMap<HTMLCanvasElement, ImageData>()
let resizeObserver: ResizeObserver | null = null
let suppressScrollEvent = false
let releaseScrollFrame: number | null = null

const pageWidth = computed(() => {
  const availableWidth = Math.max(containerSize.value.width - 28, 0)
  const availableHeight = Math.max(containerSize.value.height - 28, 0)
  if (!availableWidth || !availableHeight) return undefined

  const fittedWidth =
    props.fit === 'width'
      ? Math.min(availableWidth, 760)
      : Math.min(availableWidth, availableHeight / pageAspectRatio.value)
  return Math.max(1, Math.floor(fittedWidth * (props.zoom / 100)))
})

const pageSelection = computed(() => (props.continuous ? {} : { page: 1 }))
const normalizedPageStyle = computed(() => ({
  '--normalized-page-aspect': String(props.normalizedPageAspectRatio ?? 765 / 595),
  '--pdf-page-width': pageWidth.value ? `${pageWidth.value}px` : '100%',
}))

watch(
  [() => props.source, pageWidth],
  ([source, width], [previousSource, previousWidth]) => {
    if (source !== previousSource) {
      error.value = ''
      pageCount.value = 1
      originalRasters = new WeakMap<HTMLCanvasElement, ImageData>()
      scrollToPosition(0)
    }

    if (!source || !width) {
      renderSource.value = undefined
      return
    }

    if (source !== previousSource || !previousWidth || !renderSource.value) {
      error.value = ''
      loading.value = true
      originalRasters = new WeakMap<HTMLCanvasElement, ImageData>()
      renderSource.value = createRenderSource(source)
      renderRevision.value += 1
    }
  },
  { immediate: true },
)

watch(
  () => props.enhanced,
  () => applyPreviewMode(),
)

onMounted(() => {
  updateContainerSize()
  resizeObserver = new ResizeObserver(updateContainerSize)
  if (container.value) resizeObserver.observe(container.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (releaseScrollFrame !== null) window.cancelAnimationFrame(releaseScrollFrame)
})

defineExpose({ getScrollPosition, scrollToPosition })

function updateContainerSize(): void {
  if (!container.value) return
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  if (containerSize.value.width === width && containerSize.value.height === height) return
  containerSize.value = { width, height }
}

function getScrollPosition(): number {
  return container.value?.scrollTop ?? 0
}

function scrollToPosition(scrollTop: number): void {
  const element = container.value
  if (!element) return

  const maximum = Math.max(element.scrollHeight - element.clientHeight, 0)
  suppressScrollEvent = true
  element.scrollTop = Math.min(maximum, Math.max(0, scrollTop))

  if (releaseScrollFrame !== null) window.cancelAnimationFrame(releaseScrollFrame)
  releaseScrollFrame = window.requestAnimationFrame(() => {
    suppressScrollEvent = false
    releaseScrollFrame = null
  })
}

function handleScroll(): void {
  if (suppressScrollEvent) return
  emit('scrollPosition', getScrollPosition())
}

function createRenderSource(source: string): string | Uint8Array {
  if (!source.startsWith('data:application/pdf;base64,')) return source

  const encoded = source.slice(source.indexOf(',') + 1)
  const binary = window.atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function handleLoaded(document: PdfDocumentLike): Promise<void> {
  pageCount.value = Math.max(document.numPages, 1)
  try {
    const firstPage = await document.getPage(1)
    const viewport = firstPage.getViewport({ scale: 1 })
    if (viewport.width > 0 && viewport.height > 0) {
      pageAspectRatio.value = viewport.height / viewport.width
      emit('pageAspectRatio', pageAspectRatio.value)
    }
  } catch {
    pageAspectRatio.value = 765 / 595
  }
}

function finishLoading(): void {
  captureOriginalRasters()
  applyPreviewMode()
  loading.value = false
  emit('rendered')
}

function captureOriginalRasters(): void {
  const canvases = container.value?.querySelectorAll('canvas') ?? []
  originalRasters = new WeakMap<HTMLCanvasElement, ImageData>()
  for (const canvas of canvases) {
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context || canvas.width <= 1 || canvas.height <= 1) continue
    originalRasters.set(canvas, context.getImageData(0, 0, canvas.width, canvas.height))
  }
}

function applyPreviewMode(): void {
  const canvases = container.value?.querySelectorAll('canvas') ?? []
  for (const canvas of canvases) {
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const original = originalRasters.get(canvas)
    if (!context || !original) continue
    if (canvas.width !== original.width || canvas.height !== original.height) continue

    try {
      const raster = props.enhanced
        ? enhanceDocumentRaster({
            data: original.data,
            width: original.width,
            height: original.height,
          })
        : {
            data: new Uint8ClampedArray(original.data),
            width: original.width,
            height: original.height,
          }
      const output = new Uint8ClampedArray(raster.data.length)
      output.set(raster.data)
      context.putImageData(new ImageData(output, raster.width, raster.height), 0, 0)
    } catch {
      context.putImageData(original, 0, 0)
    }
  }
}

function failLoading(cause: unknown): void {
  loading.value = false
  error.value = cause instanceof Error ? cause.message : 'PDF预览渲染失败。'
}
</script>

<template>
  <div
    ref="container"
    class="pdf-canvas-preview"
    :aria-label="label"
    :style="normalizedPageStyle"
    @scroll.passive="handleScroll"
  >
    <div v-if="loading" class="pdf-preview-state">
      {{ continuous ? '正在渲染全部页面...' : '正在渲染第一页...' }}
    </div>
    <div v-if="error" class="pdf-preview-state error">{{ error }}</div>
    <VuePdfEmbed
      v-if="renderSource && pageWidth"
      :key="`${renderRevision}:${pageWidth}:${continuous ? 'all' : 'first'}`"
      class="pdf-embed"
      :class="{ continuous, normalized: normalizedPageAspectRatio }"
      :source="renderSource"
      v-bind="pageSelection"
      :width="pageWidth"
      :scale="continuous ? 0.75 : 1"
      @loaded="handleLoaded"
      @rendered="finishLoading"
      @loading-failed="failLoading"
      @rendering-failed="failLoading"
    >
      <template v-if="continuous" #before-page="{ page }">
        <div class="pdf-page-number">第 {{ page }} / {{ pageCount }} 页</div>
      </template>
    </VuePdfEmbed>
  </div>
</template>

<style scoped>
.pdf-canvas-preview {
  align-items: flex-start;
  background: color-mix(in srgb, CanvasText 4%, transparent);
  display: flex;
  height: 100%;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding: 14px;
  position: relative;
  scrollbar-gutter: stable;
  width: 100%;
}

.pdf-embed:not(.continuous) {
  background: Canvas;
  box-shadow: 0 8px 22px rgb(0 0 0 / 10%);
}

.pdf-embed.continuous {
  width: 100%;
}

:deep(.pdf-embed.continuous > div) {
  display: grid;
  gap: 8px;
  justify-items: center;
  margin-bottom: 20px;
}

:deep(.pdf-embed.continuous .vue-pdf-embed__page) {
  background: Canvas;
  box-shadow: 0 7px 20px rgb(0 0 0 / 12%);
}

:deep(.pdf-embed.continuous.normalized .vue-pdf-embed__page) {
  align-items: center;
  display: flex;
  height: calc(var(--pdf-page-width) * var(--normalized-page-aspect));
  justify-content: center;
  overflow: hidden;
  width: var(--pdf-page-width);
}

:deep(.pdf-embed.continuous.normalized .vue-pdf-embed__page canvas) {
  height: auto !important;
  max-height: 100%;
  max-width: 100%;
  width: auto !important;
}

.pdf-page-number {
  color: color-mix(in srgb, CanvasText 55%, transparent);
  font-size: 12px;
  line-height: 20px;
}

:deep(.pdf-embed canvas) {
  display: block;
}

.pdf-preview-state {
  background: Canvas;
  border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  border-radius: 6px;
  color: color-mix(in srgb, CanvasText 64%, transparent);
  font-size: 13px;
  left: 50%;
  padding: 9px 12px;
  position: absolute;
  top: 18px;
  transform: translateX(-50%);
  z-index: 1;
}

.pdf-preview-state.error {
  border-color: #b9433f;
  color: #b9433f;
}
</style>
