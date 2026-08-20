<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  BadgeInfo,
  ChevronRight,
  CircleUserRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UserRound,
} from '@lucide/vue'
import { useAppStore } from '@renderer/stores/app'
import AppDialog from '@renderer/components/AppDialog.vue'
import SidebarMenuItem from '@renderer/components/SidebarMenuItem.vue'
import { sidebarMenuItems } from '@renderer/config/navigation'
import { hasUpdateAvailable } from '@shared/update-state'
import type { SidebarMenuItem as MenuItem } from '@renderer/types/navigation'

const store = useAppStore()
const router = useRouter()
const route = useRoute()
const isPreferencesRoute = computed(() => route.name === 'settings')
const collapsed = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const userMenu = ref<HTMLElement | null>(null)
const userMenuOpen = ref(false)
const accountDialogOpen = ref(false)
const signOutDialogOpen = ref(false)
const menuItems = computed<MenuItem[]>(() =>
  sidebarMenuItems.map((item) => ({
    ...item,
    attention: item.id === 'about' && hasUpdateAvailable(store.updateState),
  })),
)

const filteredMenuItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  return query ? filterMenuItems(menuItems.value, query) : menuItems.value
})

function filterMenuItems(items: MenuItem[], query: string): MenuItem[] {
  return items.flatMap((item) => {
    if (item.label.toLocaleLowerCase().includes(query)) return [item]
    const children = item.children ? filterMenuItems(item.children, query) : []
    return children.length ? [{ ...item, children }] : []
  })
}

function toggleSidebar(): void {
  collapsed.value = !collapsed.value
  userMenuOpen.value = false
}

async function openSearch(): Promise<void> {
  collapsed.value = false
  await nextTick()
  searchInput.value?.focus()
}

function toggleUserMenu(): void {
  userMenuOpen.value = !userMenuOpen.value
}

function closeUserMenu(): void {
  userMenuOpen.value = false
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!userMenu.value?.contains(event.target as Node)) closeUserMenu()
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeUserMenu()
}

function navigateFromUserMenu(path: string): void {
  closeUserMenu()
  void router.push(path)
}

function openAccountDialog(): void {
  closeUserMenu()
  accountDialogOpen.value = true
}

function openSignOutDialog(): void {
  closeUserMenu()
  signOutDialogOpen.value = true
}

function confirmSignOut(): void {
  signOutDialogOpen.value = false
}

function editProfile(): void {
  accountDialogOpen.value = false
  navigateFromUserMenu('/profile')
}

onMounted(() => {
  store.clearError()
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeyDown)
})
</script>

<template>
  <RouterView v-if="isPreferencesRoute" />

  <div v-else class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar">
      <section class="sidebar-top">
        <div class="sidebar-heading">
          <div class="app-identity">
            <strong>文书比对</strong>
            <small>v{{ store.version || '...' }}</small>
          </div>

          <button
            class="icon-button sidebar-toggle"
            type="button"
            :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar"
          >
            <PanelLeftOpen v-if="collapsed" :size="18" aria-hidden="true" />
            <PanelLeftClose v-else :size="18" aria-hidden="true" />
          </button>
        </div>

        <label v-if="!collapsed" class="global-search">
          <Search :size="17" aria-hidden="true" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            placeholder="Search"
            aria-label="Global search"
          />
        </label>
        <button
          v-else
          class="icon-button collapsed-search"
          type="button"
          aria-label="Open global search"
          title="Search"
          @click="openSearch"
        >
          <Search :size="18" aria-hidden="true" />
        </button>
      </section>

      <section class="sidebar-main">
        <nav aria-label="Primary">
          <SidebarMenuItem
            v-for="item in filteredMenuItems"
            :key="item.id"
            :item="item"
            :collapsed="collapsed"
            :force-open="Boolean(searchQuery.trim())"
            @request-expand="collapsed = false"
          />
          <p v-if="!collapsed && filteredMenuItems.length === 0" class="search-empty">
            No matching menu items
          </p>
        </nav>
      </section>

      <section class="sidebar-bottom">
        <div ref="userMenu" class="user-menu-anchor">
          <div v-if="userMenuOpen" class="user-popover" role="menu" aria-label="Account menu">
            <div class="user-popover-header">
              <CircleUserRound :size="28" aria-hidden="true" />
              <div>
                <strong>Desktop User</strong>
                <small>desktop.user@example.com</small>
              </div>
            </div>
            <div class="user-popover-items">
              <button type="button" role="menuitem" @click="navigateFromUserMenu('/profile')">
                <UserRound :size="17" aria-hidden="true" />
                <span>Profile</span>
              </button>
              <button type="button" role="menuitem" @click="openAccountDialog">
                <BadgeInfo :size="17" aria-hidden="true" />
                <span>Account details</span>
              </button>
              <button type="button" role="menuitem" @click="navigateFromUserMenu('/settings')">
                <Settings :size="17" aria-hidden="true" />
                <span>Preferences</span>
              </button>
              <button
                class="danger-menu-item"
                type="button"
                role="menuitem"
                @click="openSignOutDialog"
              >
                <LogOut :size="17" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </div>

          <button
            class="user-summary"
            type="button"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            :title="collapsed ? 'Desktop User' : undefined"
            @click="toggleUserMenu"
          >
            <CircleUserRound :size="20" aria-hidden="true" />
            <div v-if="!collapsed" class="user-details">
              <strong>Desktop User</strong>
              <small>Local account</small>
            </div>
            <ChevronRight
              v-if="!collapsed"
              class="user-menu-chevron"
              :class="{ open: userMenuOpen }"
              :size="16"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>
    </aside>

    <main class="content">
      <div v-if="store.loading" class="state-card">Loading application state...</div>
      <RouterView />
    </main>

    <AppDialog
      :open="accountDialogOpen"
      title="Account details"
      description="Your local account information."
      @close="accountDialogOpen = false"
    >
      <dl class="account-details">
        <dt>Name</dt>
        <dd>Desktop User</dd>
        <dt>Email</dt>
        <dd>desktop.user@example.com</dd>
        <dt>Plan</dt>
        <dd>Local workspace</dd>
      </dl>
      <template #footer>
        <button class="secondary-button" type="button" @click="accountDialogOpen = false">
          Close
        </button>
        <button type="button" @click="editProfile">Edit profile</button>
      </template>
    </AppDialog>

    <AppDialog
      :open="signOutDialogOpen"
      title="Sign out"
      description="You will need to sign in again to access your workspace."
      @close="signOutDialogOpen = false"
    >
      <p class="dialog-message">Are you sure you want to sign out of this application?</p>
      <template #footer>
        <button class="secondary-button" type="button" @click="signOutDialogOpen = false">
          Cancel
        </button>
        <button class="danger-button" type="button" @click="confirmSignOut">Sign out</button>
      </template>
    </AppDialog>
  </div>
</template>
