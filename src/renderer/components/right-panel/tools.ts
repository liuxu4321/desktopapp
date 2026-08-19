import { Activity, Bot } from '@lucide/vue'
import type { RightPanelToolDefinition } from './types'
import RightPanelAI from './RightPanelAI.vue'
import RightPanelActivity from './RightPanelActivity.vue'

export const rightPanelTools: RightPanelToolDefinition[] = [
  { id: 'ai', label: 'AI', icon: Bot, component: RightPanelAI },
  { id: 'activity', label: 'Activity', icon: Activity, component: RightPanelActivity },
]
