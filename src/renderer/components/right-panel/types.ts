import type { Component } from 'vue'

export interface RightPanelToolDefinition {
  id: string
  label: string
  icon: Component
  component: Component
}
