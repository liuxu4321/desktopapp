import {
  Activity,
  BarChart3,
  Boxes,
  FileSearch,
  FileText,
  FolderKanban,
  House,
  Info,
  LayoutGrid,
  ListChecks,
  MessagesSquare,
  Wrench,
} from '@lucide/vue'
import type { SidebarMenuItem } from '@renderer/types/navigation'

export const sidebarMenuItems: SidebarMenuItem[] = [
  { id: 'home', to: '/', label: 'Home', icon: House },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: FolderKanban,
    defaultOpen: true,
    children: [
      { id: 'workspace-overview', to: '/workspace/overview', label: 'Overview', icon: Boxes },
      { id: 'workspace-activity', to: '/workspace/activity', label: 'Activity', icon: Activity },
    ],
  },
  {
    id: 'examples',
    label: 'Page examples',
    icon: LayoutGrid,
    children: [
      { id: 'examples-list', to: '/examples/list', label: 'List page', icon: ListChecks },
      { id: 'examples-charts', to: '/examples/charts', label: 'Charts', icon: BarChart3 },
      { id: 'examples-cards', to: '/examples/cards', label: 'Cards', icon: LayoutGrid },
      { id: 'examples-detail', to: '/examples/detail', label: 'Detail page', icon: FileSearch },
      {
        id: 'examples-dialogs',
        to: '/examples/dialogs',
        label: 'Dialogs',
        icon: MessagesSquare,
      },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    children: [
      { id: 'tools-files', to: '/tools/files', label: 'Files', icon: FileText },
      {
        id: 'tools-developer',
        label: 'Developer',
        icon: Wrench,
        children: [
          {
            id: 'tools-diagnostics',
            to: '/tools/developer/diagnostics',
            label: 'Diagnostics',
            icon: Activity,
          },
        ],
      },
    ],
  },
  { id: 'about', to: '/about', label: 'About', icon: Info },
]
