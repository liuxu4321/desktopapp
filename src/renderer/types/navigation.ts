import type { Component } from 'vue'

export interface SidebarMenuItem {
  id: string
  label: string
  icon: Component
  to?: string
  children?: SidebarMenuItem[]
  defaultOpen?: boolean
  attention?: boolean
}
