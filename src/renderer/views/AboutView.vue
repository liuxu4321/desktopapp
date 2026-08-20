<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, Download, RefreshCw, Rocket } from '@lucide/vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import { useAppStore } from '@renderer/stores/app'
import { hasUpdateAvailable } from '@shared/update-state'

const store = useAppStore()
const updateBusy = computed(() =>
  ['checking', 'available', 'downloading'].includes(store.updateState.status),
)
const newVersionAvailable = computed(() => hasUpdateAvailable(store.updateState))
const updateDownloaded = computed(() => store.updateState.status === 'downloaded')
const updateProgress = computed(() => Math.round(store.updateState.progress?.percent ?? 0))
const latestVersion = computed(() => store.updateState.version ?? '')
const platformLabel = computed(() => {
  const platform = store.platformInfo
  if (!platform) return '正在读取'
  const names = { macos: 'macOS', windows: 'Windows', linux: 'Linux' }
  return `${names[platform.name]} ${platform.arch}`
})
const updateActionLabel = computed(() => {
  if (store.updateState.status === 'checking') return '正在检查新版本'
  if (['available', 'downloading'].includes(store.updateState.status)) return '正在下载新版本'
  if (updateDownloaded.value) return '升级到最新版'
  if (store.updateState.status === 'error') return '重新检查最新版'
  return '检查并升级到最新版'
})

async function handleUpdateAction(): Promise<void> {
  if (updateDownloaded.value) {
    await store.installUpdate()
    return
  }
  await store.checkForUpdates()
}
</script>

<template>
  <section class="page about-page">
    <PageHeader title="About" description="版本信息与应用升级" />

    <section class="about-version-section" aria-labelledby="current-version-title">
      <div class="about-section-heading">
        <div class="about-app-mark"><span>文</span></div>
        <div>
          <h2 id="current-version-title">文书比对</h2>
          <p>智能文书审核与对比工具</p>
        </div>
      </div>
      <dl class="version-details">
        <div>
          <dt>当前版本</dt>
          <dd>v{{ store.version || '...' }}</dd>
        </div>
        <div>
          <dt>更新通道</dt>
          <dd>{{ store.updateState.channel === 'beta' ? 'Beta 测试版' : 'Stable 正式版' }}</dd>
        </div>
        <div>
          <dt>运行平台</dt>
          <dd>{{ platformLabel }}</dd>
        </div>
      </dl>
    </section>

    <section class="about-update-section" aria-labelledby="update-title">
      <header class="update-section-header">
        <div>
          <h2 id="update-title">应用升级</h2>
          <p>保持应用为最新版本，以获取功能改进和问题修复。</p>
        </div>
        <span v-if="newVersionAvailable" class="update-available-label">发现新版本</span>
        <span v-else-if="store.updateState.status === 'not-available'" class="latest-label">
          <CheckCircle2 :size="15" aria-hidden="true" />已是最新版
        </span>
      </header>

      <div class="update-version-row">
        <div>
          <span>当前版本</span>
          <strong>v{{ store.version || '...' }}</strong>
        </div>
        <div>
          <span>最新版本</span>
          <strong>{{ latestVersion ? `v${latestVersion}` : '检查后显示' }}</strong>
        </div>
      </div>

      <div v-if="store.updateState.progress" class="update-progress-block">
        <div>
          <span>下载进度</span>
          <strong>{{ updateProgress }}%</strong>
        </div>
        <progress max="100" :value="updateProgress" />
      </div>

      <div class="update-status-row">
        <p :class="{ error: store.updateState.status === 'error' }">
          {{ store.updateState.message }}
        </p>
        <button
          type="button"
          :disabled="updateBusy || store.platformInfo?.canAutoUpdate === false"
          @click="handleUpdateAction"
        >
          <Rocket v-if="updateDownloaded" :size="16" aria-hidden="true" />
          <Download
            v-else-if="['available', 'downloading'].includes(store.updateState.status)"
            :size="16"
            aria-hidden="true"
          />
          <RefreshCw v-else :size="16" aria-hidden="true" />
          {{ updateActionLabel }}
        </button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.about-page {
  margin: 0 auto;
  max-width: 920px;
}

.about-version-section,
.about-update-section {
  border-top: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  padding: 22px 0;
}

.about-section-heading {
  align-items: center;
  display: flex;
  gap: 14px;
}

.about-section-heading h2,
.about-section-heading p,
.update-section-header h2,
.update-section-header p,
.update-status-row p {
  margin: 0;
}

.about-section-heading p,
.update-section-header p,
.update-status-row p {
  color: color-mix(in srgb, CanvasText 62%, transparent);
  font-size: 14px;
}

.about-app-mark {
  align-items: center;
  background: #256f73;
  border-radius: 8px;
  color: white;
  display: flex;
  flex: 0 0 48px;
  font-size: 22px;
  font-weight: 700;
  height: 48px;
  justify-content: center;
}

.version-details {
  display: grid;
  gap: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 22px;
}

.version-details div {
  border-left: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  padding-left: 18px;
}

.version-details div:first-child {
  border-left: 0;
  padding-left: 0;
}

.version-details dt,
.update-version-row span,
.update-progress-block span {
  color: color-mix(in srgb, CanvasText 55%, transparent);
  font-size: 12px;
}

.version-details dd,
.update-version-row strong {
  display: block;
  font-size: 16px;
  font-weight: 650;
  margin: 5px 0 0;
}

.update-section-header,
.update-status-row,
.update-progress-block > div {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.update-available-label,
.latest-label {
  align-items: center;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 13px;
  gap: 6px;
}

.update-available-label {
  color: #b9433f;
  font-weight: 650;
}

.latest-label {
  color: #28756f;
}

.update-version-row {
  background: color-mix(in srgb, CanvasText 4%, transparent);
  border: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  border-radius: 6px;
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20px;
  padding: 16px;
}

.update-progress-block {
  margin-top: 18px;
}

.update-progress-block progress {
  margin-top: 8px;
}

.update-status-row {
  border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  margin-top: 20px;
  padding-top: 18px;
}

.update-status-row p.error {
  color: #b9433f;
}

.update-status-row button {
  align-items: center;
  display: inline-flex;
  flex: 0 0 auto;
  gap: 8px;
}

@media (max-width: 620px) {
  .version-details,
  .update-version-row {
    grid-template-columns: 1fr;
  }

  .version-details div,
  .version-details div:first-child {
    border-left: 0;
    border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
    padding: 12px 0 0;
  }

  .version-details div:first-child {
    border-top: 0;
  }

  .update-section-header,
  .update-status-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
