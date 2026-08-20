import { createRouter, createWebHashHistory } from 'vue-router'
import SettingsView from '@renderer/views/SettingsView.vue'
import AboutView from '@renderer/views/AboutView.vue'
import ProfileView from '@renderer/views/ProfileView.vue'
import FeatureView from '@renderer/views/FeatureView.vue'
import ListDemoView from '@renderer/views/ListDemoView.vue'
import ChartsDemoView from '@renderer/views/ChartsDemoView.vue'
import CardsDemoView from '@renderer/views/CardsDemoView.vue'
import DetailDemoView from '@renderer/views/DetailDemoView.vue'
import DialogsDemoView from '@renderer/views/DialogsDemoView.vue'
import DocumentCompareView from '@renderer/views/DocumentCompareView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/document-compare' },
    { path: '/document-compare', name: 'document-compare', component: DocumentCompareView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/profile', name: 'profile', component: ProfileView },
    { path: '/workspace/overview', name: 'workspace-overview', component: FeatureView },
    { path: '/workspace/activity', name: 'workspace-activity', component: FeatureView },
    { path: '/tools/files', name: 'tools-files', component: FeatureView },
    { path: '/examples/list', name: 'examples-list', component: ListDemoView },
    { path: '/examples/charts', name: 'examples-charts', component: ChartsDemoView },
    { path: '/examples/cards', name: 'examples-cards', component: CardsDemoView },
    { path: '/examples/detail', name: 'examples-detail', component: DetailDemoView },
    { path: '/examples/dialogs', name: 'examples-dialogs', component: DialogsDemoView },
    {
      path: '/tools/developer/diagnostics',
      name: 'tools-diagnostics',
      component: FeatureView,
    },
  ],
})
