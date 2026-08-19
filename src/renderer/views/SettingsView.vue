<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Bell,
  CircleUserRound,
  Download,
  Keyboard,
  Palette,
  Search,
  Settings2,
  UserRound,
  Wrench,
} from '@lucide/vue'
import type { ThemePreference } from '@shared/types'
import { useAppStore } from '@renderer/stores/app'
import { desktopAPI } from '@renderer/services/desktop-api'

type SettingsSection =
  | 'general'
  | 'import'
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'shortcuts'
  | 'advanced'
  | 'account'

const store = useAppStore()
const router = useRouter()
const activeSection = ref<SettingsSection>('general')
const searchQuery = ref('')
const language = ref('en')
const launchAtStartup = ref(false)
const reopenWindows = ref(true)
const desktopNotifications = ref(true)
const updateNotifications = ref(true)

const sections = [
  { id: 'general' as const, label: 'General', icon: Settings2 },
  { id: 'import' as const, label: 'Import', icon: Download },
  { id: 'profile' as const, label: 'Profile', icon: UserRound },
  { id: 'appearance' as const, label: 'Appearance', icon: Palette },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  { id: 'shortcuts' as const, label: 'Keyboard shortcuts', icon: Keyboard },
  { id: 'advanced' as const, label: 'Advanced', icon: Wrench },
  { id: 'account' as const, label: 'Account', icon: CircleUserRound },
]

const filteredSections = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  return query
    ? sections.filter((section) => section.label.toLocaleLowerCase().includes(query))
    : sections
})

const activeTitle = computed(
  () => sections.find((section) => section.id === activeSection.value)?.label ?? 'Preferences',
)

const themes: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function returnToApp(): void {
  void router.push('/')
}

function openLogs(): void {
  void desktopAPI.openLogDirectory()
}
</script>

<template>
  <div class="preferences-page">
    <aside class="preferences-sidebar">
      <button class="preferences-back" type="button" @click="returnToApp">
        <ArrowLeft :size="19" aria-hidden="true" />
        <span>Back to app</span>
      </button>

      <label class="preferences-search">
        <Search :size="18" aria-hidden="true" />
        <input v-model="searchQuery" type="search" placeholder="Search settings..." />
      </label>

      <span class="preferences-group-label">Personal</span>
      <nav class="preferences-nav" aria-label="Settings sections">
        <button
          v-for="section in filteredSections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id"
        >
          <component :is="section.icon" :size="18" aria-hidden="true" />
          <span>{{ section.label }}</span>
        </button>
        <p v-if="filteredSections.length === 0" class="preferences-empty">No settings found</p>
      </nav>
    </aside>

    <main class="preferences-main">
      <div class="preferences-main-inner">
        <h1>{{ activeTitle }}</h1>

        <section v-if="activeSection === 'general'" class="preference-section">
          <h2>Application</h2>
          <div class="preference-group">
            <label class="preference-row">
              <span>
                <strong>Language</strong>
                <small>Display language for menus and controls.</small>
              </span>
              <select v-model="language">
                <option value="en">English</option>
                <option value="zh-CN">Simplified Chinese</option>
                <option value="ja">Japanese</option>
              </select>
            </label>
            <label class="preference-row">
              <span>
                <strong>Launch at startup</strong>
                <small>Start the application when you sign in.</small>
              </span>
              <input v-model="launchAtStartup" class="switch-input" type="checkbox" />
            </label>
            <label class="preference-row">
              <span>
                <strong>Reopen windows</strong>
                <small>Restore the previous workspace on launch.</small>
              </span>
              <input v-model="reopenWindows" class="switch-input" type="checkbox" />
            </label>
          </div>
        </section>

        <section v-else-if="activeSection === 'import'" class="preference-section">
          <h2>Import data</h2>
          <div class="preference-group">
            <div class="preference-row">
              <span>
                <strong>Import from file</strong>
                <small>Select a local file through the secure desktop file picker.</small>
              </span>
              <button type="button" @click="store.selectFile">Choose file</button>
            </div>
            <div v-if="store.selectedFile" class="preference-file">
              <strong>{{ store.selectedFile.name }}</strong>
              <small>{{ store.selectedFile.path }}</small>
            </div>
          </div>
        </section>

        <section v-else-if="activeSection === 'profile'" class="preference-section">
          <h2>Personal information</h2>
          <div class="preference-group preference-form">
            <label>
              <span>Display name</span>
              <input value="Desktop User" autocomplete="name" />
            </label>
            <label>
              <span>Email</span>
              <input value="desktop.user@example.com" type="email" autocomplete="email" />
            </label>
            <div class="preference-form-actions">
              <button type="button">Save changes</button>
            </div>
          </div>
        </section>

        <section v-else-if="activeSection === 'appearance'" class="preference-section">
          <h2>Theme</h2>
          <div class="preference-group">
            <div class="preference-row preference-row-stacked">
              <span>
                <strong>Color mode</strong>
                <small>Use a light, dark, or system-matched interface.</small>
              </span>
              <div class="segmented theme-control">
                <button
                  v-for="theme in themes"
                  :key="theme.value"
                  type="button"
                  :class="{ active: store.config.theme === theme.value }"
                  @click="store.setTheme(theme.value)"
                >
                  {{ theme.label }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="activeSection === 'notifications'" class="preference-section">
          <h2>Notifications</h2>
          <div class="preference-group">
            <label class="preference-row">
              <span>
                <strong>Desktop notifications</strong>
                <small>Show notifications when the application is in the background.</small>
              </span>
              <input v-model="desktopNotifications" class="switch-input" type="checkbox" />
            </label>
            <label class="preference-row">
              <span>
                <strong>Update notifications</strong>
                <small>Notify when a new application version is available.</small>
              </span>
              <input v-model="updateNotifications" class="switch-input" type="checkbox" />
            </label>
          </div>
        </section>

        <section v-else-if="activeSection === 'shortcuts'" class="preference-section">
          <h2>Keyboard shortcuts</h2>
          <div class="preference-group shortcut-list">
            <div class="preference-row"><span>Global search</span><kbd>Cmd / Ctrl + K</kbd></div>
            <div class="preference-row"><span>Open preferences</span><kbd>Cmd / Ctrl + ,</kbd></div>
            <div class="preference-row"><span>Close dialog</span><kbd>Esc</kbd></div>
          </div>
        </section>

        <section v-else-if="activeSection === 'advanced'" class="preference-section">
          <h2>Diagnostics</h2>
          <div class="preference-group">
            <div class="preference-row">
              <span>
                <strong>Application logs</strong>
                <small>Open the local folder containing diagnostic logs.</small>
              </span>
              <button class="secondary-button" type="button" @click="openLogs">Open logs</button>
            </div>
            <dl v-if="store.platformInfo" class="runtime-details">
              <dt>Application</dt>
              <dd>v{{ store.version }}</dd>
              <dt>Platform</dt>
              <dd>{{ store.platformInfo.name }} {{ store.platformInfo.arch }}</dd>
              <dt>Electron</dt>
              <dd>{{ store.platformInfo.versions.electron }}</dd>
            </dl>
          </div>
        </section>

        <section v-else class="preference-section">
          <h2>Account</h2>
          <div class="preference-group">
            <div class="preference-row">
              <span><strong>Desktop User</strong><small>desktop.user@example.com</small></span>
              <button class="secondary-button" type="button">Manage account</button>
            </div>
            <div class="preference-row">
              <span
                ><strong>Local workspace</strong
                ><small>Application data is stored on this device.</small></span
              >
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
