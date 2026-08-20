import { FileDiff, Info } from '@lucide/vue'
import type { SidebarMenuItem } from '@renderer/types/navigation'

export const sidebarMenuItems: SidebarMenuItem[] = [
  { id: 'document-compare', to: '/document-compare', label: '文书比对', icon: FileDiff },
  { id: 'about', to: '/about', label: 'About', icon: Info },
]
