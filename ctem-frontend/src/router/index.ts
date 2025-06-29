import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/assets',
      name: 'assets',
      component: () => import('../views/AssetsView.vue')
    },
    {
      path: '/vulnerabilities',
      name: 'vulnerabilities', 
      component: () => import('../views/VulnerabilitiesView.vue')
    },
    {
      path: '/risks',
      name: 'risks',
      component: () => import('../views/RisksView.vue')
    },
    {
      path: '/remediation',
      name: 'remediation',
      component: () => import('../views/RemediationView.vue')
    },
    {
      path: '/compliance',
      name: 'compliance',
      component: () => import('../views/ComplianceView.vue')
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../views/ReportsView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    }
  ]
})

export default router