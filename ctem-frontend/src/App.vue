<template>
  <div id="app">
    <!-- Top Navigation -->
    <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
      <div class="container-fluid">
        <router-link class="navbar-brand fw-bold" to="/">
          <i class="bi bi-shield-check me-2"></i>
          CTEM System
        </router-link>
        
        <button 
          class="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <router-link class="nav-link" to="/">
                <i class="bi bi-speedometer2 me-1"></i>Dashboard
              </router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/assets">
                <i class="bi bi-hdd-stack me-1"></i>Assets
                <span v-if="assetsStore.criticalAssets.length > 0" class="badge bg-danger ms-1">
                  {{ assetsStore.criticalAssets.length }}
                </span>
              </router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/vulnerabilities">
                <i class="bi bi-exclamation-triangle me-1"></i>Vulnerabilities
                <span v-if="vulnerabilitiesStore.criticalVulnerabilities.length > 0" class="badge bg-danger ms-1">
                  {{ vulnerabilitiesStore.criticalVulnerabilities.length }}
                </span>
              </router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/risks">
                <i class="bi bi-graph-up-arrow me-1"></i>Risks
              </router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/remediation">
                <i class="bi bi-tools me-1"></i>Remediation
              </router-link>
            </li>
          </ul>
          
          <!-- User Menu -->
          <div class="dropdown">
            <button 
              class="btn btn-outline-secondary dropdown-toggle" 
              type="button" 
              data-bs-toggle="dropdown"
            >
              <i class="bi bi-person-circle me-1"></i>
              {{ authStore.currentUser?.name || 'User' }}
            </button>
            <ul class="dropdown-menu">
              <li>
                <router-link class="dropdown-item" to="/settings">
                  <i class="bi bi-gear me-2"></i>Settings
                </router-link>
              </li>
              <li>
                <router-link class="dropdown-item" to="/reports">
                  <i class="bi bi-file-earmark-text me-2"></i>Reports
                </router-link>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <a class="dropdown-item" href="#" @click.prevent="handleLogout">
                  <i class="bi bi-box-arrow-right me-2"></i>Logout
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="container-fluid">
      <div class="row">
        <!-- Sidebar für zusätzliche Navigation -->
        <nav class="col-md-2 d-none d-md-block sidebar p-0">
          <div class="position-sticky pt-3">
            <ul class="nav flex-column">
              <li class="nav-item">
                <router-link 
                  class="nav-link text-white" 
                  :class="{ active: $route.name === 'compliance' }"
                  to="/compliance"
                >
                  <i class="bi bi-clipboard-check me-2"></i>
                  Compliance
                </router-link>
              </li>
              <li class="nav-item">
                <a class="nav-link text-white" href="#" @click.prevent="showNotifications">
                  <i class="bi bi-bell me-2"></i>
                  Notifications
                  <span 
                    v-if="notificationsStore.unreadCount > 0" 
                    class="badge bg-danger ms-auto"
                  >
                    {{ notificationsStore.unreadCount }}
                  </span>
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link text-white" href="#">
                  <i class="bi bi-clock-history me-2"></i>
                  Audit Log
                </a>
              </li>
            </ul>

            <!-- Mini Stats in Sidebar -->
            <div class="mt-4 px-3">
              <div class="card bg-dark border-secondary">
                <div class="card-body p-3">
                  <h6 class="card-title text-white mb-2">Quick Stats</h6>
                  <div class="d-flex justify-content-between text-white mb-1">
                    <small>Assets:</small>
                    <small class="fw-bold">{{ dashboardStore.metrics.totalAssets }}</small>
                  </div>
                  <div class="d-flex justify-content-between text-white mb-1">
                    <small>Vulnerabilities:</small>
                    <small class="fw-bold text-danger">{{ dashboardStore.metrics.activeVulnerabilities }}</small>
                  </div>
                  <div class="d-flex justify-content-between text-white">
                    <small>Risk Score:</small>
                    <small class="fw-bold" :class="getRiskScoreClass(dashboardStore.metrics.avgRiskScore)">
                      {{ dashboardStore.metrics.avgRiskScore }}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <!-- Page Content -->
        <main class="col-md-10 ms-sm-auto px-md-4">
          <!-- Loading Overlay -->
          <div v-if="isGlobalLoading" class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="background: rgba(0,0,0,0.5); z-index: 9999;">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>

          <!-- Critical Alerts Banner -->
          <div v-if="notificationsStore.criticalNotifications.length > 0" class="alert alert-danger alert-dismissible fade show mb-3" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Critical Alert:</strong> 
            {{ notificationsStore.criticalNotifications[0].message }}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>

          <router-view />
        </main>
      </div>
    </div>

    <!-- Notifications Modal -->
    <div class="modal fade" id="notificationsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-bell me-2"></i>Notifications
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="text-muted">{{ notificationsStore.notifications.length }} notifications</span>
              <button 
                v-if="notificationsStore.unreadCount > 0"
                @click="notificationsStore.markAllAsRead()"
                class="btn btn-sm btn-outline-primary"
              >
                Mark all as read
              </button>
            </div>
            
            <div class="list-group">
              <div 
                v-for="notification in notificationsStore.recentNotifications" 
                :key="notification.id"
                class="list-group-item"
                :class="{ 'list-group-item-light': notification.read }"
              >
                <div class="d-flex w-100 justify-content-between">
                  <h6 class="mb-1">
                    <i :class="getNotificationIcon(notification.type)" class="me-2"></i>
                    {{ notification.title }}
                  </h6>
                  <small class="text-muted">{{ formatTimeAgo(notification.timestamp) }}</small>
                </div>
                <p class="mb-1">{{ notification.message }}</p>
                <div class="d-flex justify-content-between align-items-center">
                  <span 
                    class="badge"
                    :class="getSeverityBadgeClass(notification.severity)"
                  >
                    {{ notification.severity }}
                  </span>
                  <div>
                    <button 
                      v-if="!notification.read"
                      @click="notificationsStore.markAsRead(notification.id)"
                      class="btn btn-sm btn-outline-secondary me-2"
                    >
                      Mark as read
                    </button>
                    <router-link 
                      v-if="notification.actionUrl"
                      :to="notification.actionUrl"
                      class="btn btn-sm btn-primary"
                      data-bs-dismiss="modal"
                    >
                      View
                    </router-link>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Empty state -->
            <div v-if="notificationsStore.notifications.length === 0" class="text-center py-4">
              <i class="bi bi-bell-slash text-muted" style="font-size: 3rem;"></i>
              <p class="text-muted mt-2">No notifications yet</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              Close
            </button>
            <router-link to="/notifications" class="btn btn-primary" data-bs-dismiss="modal">
              View All Notifications
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Container for Quick Notifications -->
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div 
        v-for="toast in activeToasts" 
        :key="toast.id"
        class="toast show"
        role="alert"
      >
        <div class="toast-header">
          <i :class="getNotificationIcon(toast.type)" class="me-2"></i>
          <strong class="me-auto">{{ toast.title }}</strong>
          <small class="text-muted">now</small>
          <button 
            type="button" 
            class="btn-close" 
            @click="dismissToast(toast.id)"
          ></button>
        </div>
        <div class="toast-body">
          {{ toast.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { useVulnerabilitiesStore } from '@/stores/vulnerabilities'
import { useAssetsStore } from '@/stores/assets'
import { useNotificationsStore } from '@/stores/notifications'

const router = useRouter()

// Store instances
const authStore = useAuthStore()
const dashboardStore = useDashboardStore()
const vulnerabilitiesStore = useVulnerabilitiesStore()
const assetsStore = useAssetsStore()
const notificationsStore = useNotificationsStore()

// Local state for toasts
const activeToasts = ref<Array<{
  id: string
  title: string
  message: string
  type: string
}>>([])

// Computed
const isGlobalLoading = computed(() => 
  dashboardStore.isLoading || 
  vulnerabilitiesStore.isLoading || 
  assetsStore.isLoading
)

// Methods
const handleLogout = async () => {
  try {
    authStore.logout()
    await router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

const showNotifications = () => {
  // Bootstrap Modal programmatically
  const modal = new (window as any).bootstrap.Modal(document.getElementById('notificationsModal'))
  modal.show()
}

const getRiskScoreClass = (score: number): string => {
  if (score >= 8) return 'text-danger'
  if (score >= 5) return 'text-warning'
  return 'text-success'
}

const getNotificationIcon = (type: string): string => {
  const icons = {
    vulnerability: 'bi bi-exclamation-triangle-fill text-danger',
    asset: 'bi bi-hdd-stack text-info',
    compliance: 'bi bi-clipboard-check text-success',
    system: 'bi bi-gear text-secondary',
    error: 'bi bi-x-circle-fill text-danger',
    warning: 'bi bi-exclamation-triangle-fill text-warning',
    info: 'bi bi-info-circle-fill text-info',
    success: 'bi bi-check-circle-fill text-success'
  }
  return icons[type as keyof typeof icons] || 'bi bi-info-circle'
}

const getSeverityBadgeClass = (severity: string): string => {
  const classes = {
    error: 'bg-danger',
    warning: 'bg-warning text-dark',
    success: 'bg-success',
    info: 'bg-info text-dark',
    critical: 'bg-danger',
    high: 'bg-warning text-dark',
    medium: 'bg-primary',
    low: 'bg-secondary'
  }
  return classes[severity as keyof typeof classes] || 'bg-secondary'
}

const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  
  const diffInWeeks = Math.floor(diffInDays / 7)
  return `${diffInWeeks}w ago`
}

const dismissToast = (toastId: string) => {
  const index = activeToasts.value.findIndex(toast => toast.id === toastId)
  if (index > -1) {
    activeToasts.value.splice(index, 1)
  }
}

const showToast = (notification: any) => {
  const toast = {
    id: `toast-${Date.now()}`,
    title: notification.title,
    message: notification.message,
    type: notification.type || notification.severity
  }
  
  activeToasts.value.push(toast)
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    dismissToast(toast.id)
  }, 5000)
}

// Lifecycle
onMounted(async () => {
  // Initial data fetch
  try {
    await Promise.all([
      dashboardStore.fetchMetrics(),
      vulnerabilitiesStore.fetchVulnerabilities(),
      assetsStore.fetchAssets(),
      notificationsStore.fetchNotifications()
    ])
  } catch (error) {
    console.error('Failed to load initial data:', error)
    
    // Show error toast
    showToast({
      title: 'Loading Error',
      message: 'Failed to load some data. Please refresh the page.',
      type: 'error'
    })
  }

  // Setup periodic data refresh (every 5 minutes)
  setInterval(async () => {
    try {
      await Promise.all([
        dashboardStore.fetchMetrics(),
        notificationsStore.fetchNotifications()
      ])
    } catch (error) {
      console.warn('Background refresh failed:', error)
    }
  }, 5 * 60 * 1000)
})

// Watch for new critical notifications and show toasts
import { watch } from 'vue'
watch(
  () => notificationsStore.criticalNotifications,
  (newCriticalNotifications, oldCriticalNotifications) => {
    // Show toast for new critical notifications
    if (newCriticalNotifications.length > (oldCriticalNotifications?.length || 0)) {
      const newNotification = newCriticalNotifications[0]
      if (newNotification && !newNotification.read) {
        showToast(newNotification)
      }
    }
  },
  { deep: true }
)
</script>

<style scoped>
:root {
  --ctem-primary: #667eea;
  --ctem-secondary: #764ba2;
  --ctem-danger: #dc3545;
  --ctem-warning: #ffc107;
  --ctem-success: #28a745;
  --ctem-info: #17a2b8;
}

.router-link-active {
  color: var(--ctem-primary) !important;
  font-weight: 600;
}

.sidebar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: calc(100vh - 56px);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}

.sidebar .nav-link {
  transition: all 0.3s ease;
  border-radius: 0.375rem;
  margin: 0.125rem 0.75rem;
  padding: 0.75rem 1rem;
}

.sidebar .nav-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(5px);
}

.sidebar .nav-link.active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: 600;
  border-left: 4px solid white;
}

.navbar {
  border-bottom: 1px solid #e9ecef;
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.95) !important;
}

.navbar-brand {
  color: var(--ctem-primary) !important;
  font-size: 1.5rem;
  text-decoration: none;
}

.navbar-brand:hover {
  color: var(--ctem-secondary) !important;
}

.nav-link {
  transition: color 0.3s ease;
}

.nav-link:hover {
  color: var(--ctem-primary) !important;
}

.badge {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
}

.card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.alert {
  border: none;
  border-radius: 0.5rem;
}

.modal-content {
  border: none;
  border-radius: 1rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.modal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 1rem 1rem 0 0;
}

.list-group-item {
  border: none;
  border-bottom: 1px solid #e9ecef;
  transition: background-color 0.2s ease;
}

.list-group-item:hover {
  background-color: #f8f9fa;
}

.list-group-item:last-child {
  border-bottom: none;
}

.toast {
  min-width: 350px;
}

.toast-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: none;
}

.spinner-border {
  width: 3rem;
  height: 3rem;
}

/* Custom scrollbar for sidebar */
.sidebar::-webkit-scrollbar {
  width: 6px;
}

.sidebar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .sidebar {
    min-height: auto;
  }
  
  .navbar-brand {
    font-size: 1.25rem;
  }
  
  .toast {
    min-width: 300px;
  }
}

/* Animation for loading overlay */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.position-fixed {
  animation: fadeIn 0.3s ease;
}

/* Notification badges pulse animation */
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.badge.bg-danger {
  animation: pulse 2s infinite;
}
</style>