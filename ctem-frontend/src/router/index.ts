import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import LoginView from '../views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { 
        requiresGuest: true,
        layout: 'public'
      }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { 
        requiresGuest: true,
        layout: 'auth'
      }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/assets',
      name: 'assets',
      component: () => import('../views/AssetsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/vulnerabilities',
      name: 'vulnerabilities', 
      component: () => import('../views/VulnerabilitiesView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/risks',
      name: 'risks',
      component: () => import('../views/RisksView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/remediation',
      name: 'remediation',
      component: () => import('../views/RemediationView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/compliance',
      name: 'compliance',
      component: () => import('../views/ComplianceView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../views/ReportsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresAuth: true, requiresRole: ['ADMIN'] }
    },
    // Catch-all redirect
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// Navigation Guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Initialize auth store if not already done
  if (!authStore.isInitialized) {
    await authStore.initializeAuth()
  }

  const isAuthenticated = authStore.isAuthenticated
  const userRole = authStore.user?.role

  // Handle authentication requirements
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({
      name: 'login',
      query: { redirect: to.fullPath }
    })
    return
  }

  // Redirect authenticated users away from login
  if (to.meta.requiresGuest && isAuthenticated) {
    next({ name: 'dashboard' })
    return
  }

  // Handle role requirements
  if (to.meta.requiresRole && isAuthenticated) {
    const requiredRoles = Array.isArray(to.meta.requiresRole) 
      ? to.meta.requiresRole 
      : [to.meta.requiresRole]
    
    if (!requiredRoles.includes(userRole)) {
      next({ 
        name: 'dashboard',
        query: { error: 'insufficient_permissions' }
      })
      return
    }
  }

  next()
})

export default router