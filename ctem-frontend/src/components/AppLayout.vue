<template>
  <div class="app-layout">
    <!-- Top Navigation -->
    <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom fixed-top">
      <div class="container-fluid">
        <!-- Brand -->
        <router-link to="/dashboard" class="navbar-brand d-flex align-items-center">
          <i class="bi bi-shield-check me-2 fs-4 text-primary"></i>
          <span class="fw-bold">CTEM Platform</span>
        </router-link>

        <!-- Mobile Toggle -->
        <button 
          class="navbar-toggler border-0" 
          type="button" 
          @click="toggleMobileSidebar"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <!-- Right Side Navigation -->
        <div class="navbar-nav ms-auto d-flex flex-row align-items-center">
          <!-- Notifications -->
          <div class="nav-item dropdown me-3">
            <button 
              class="btn btn-outline-secondary btn-sm position-relative"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i class="bi bi-bell"></i>
              <span 
                v-if="unreadNotifications > 0"
                class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
              >
                {{ unreadNotifications > 99 ? '99+' : unreadNotifications }}
              </span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end notification-dropdown">
              <li class="dropdown-header d-flex justify-content-between align-items-center">
                <span>Notifications</span>
                <button class="btn btn-link btn-sm p-0" @click="markAllAsRead">
                  Mark all as read
                </button>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li v-if="recentNotifications.length === 0" class="dropdown-item-text text-center text-muted">
                No new notifications
              </li>
              <li v-for="notification in recentNotifications.slice(0, 5)" :key="notification.id">
                <a 
                  class="dropdown-item d-flex align-items-start"
                  :class="{ 'bg-light': !notification.read }"
                  href="#"
                  @click="markAsRead(notification.id)"
                >
                  <i 
                    class="me-2 mt-1"
                    :class="getNotificationIcon(notification.type)"
                  ></i>
                  <div class="flex-grow-1">
                    <div class="fw-bold small">{{ notification.title }}</div>
                    <div class="text-muted small">{{ notification.message }}</div>
                    <div class="text-muted small">{{ formatTime(notification.timestamp) }}</div>
                  </div>
                </a>
              </li>
              <li v-if="recentNotifications.length > 5"><hr class="dropdown-divider"></li>
              <li v-if="recentNotifications.length > 5">
                <a class="dropdown-item text-center" href="#">View all notifications</a>
              </li>
            </ul>
          </div>

          <!-- User Menu -->
          <div class="nav-item dropdown">
            <button 
              class="btn btn-outline-secondary btn-sm d-flex align-items-center"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <div 
                class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2"
                style="width: 24px; height: 24px; font-size: 0.75rem;"
              >
                {{ userInitials }}
              </div>
              <span class="d-none d-md-inline">{{ user?.name || 'User' }}</span>
              <i class="bi bi-chevron-down ms-1"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li class="dropdown-header">
                <div class="fw-bold">{{ user?.name }}</div>
                <div class="text-muted small">{{ user?.email }}</div>
                <div class="text-muted small">Role: {{ user?.role }}</div>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <router-link to="/settings" class="dropdown-item">
                  <i class="bi bi-gear me-2"></i>Settings
                </router-link>
              </li>
              <li>
                <a class="dropdown-item" href="#" @click="showProfile">
                  <i class="bi bi-person me-2"></i>Profile
                </a>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <a class="dropdown-item text-danger" href="#" @click="logout">
                  <i class="bi bi-box-arrow-right me-2"></i>Logout
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>

    <!-- Sidebar -->
    <div 
      class="sidebar d-flex flex-column"
      :class="{ 'mobile-open': isMobileSidebarOpen }"
    >
      <div class="sidebar-content flex-grow-1">
        <!-- Main Navigation -->
        <ul class="nav flex-column">
          <li class="nav-item">
            <router-link 
              to="/dashboard" 
              class="nav-link"
              :class="{ active: $route.name === 'dashboard' }"
            >
              <i class="bi bi-speedometer2 me-2"></i>
              Dashboard
            </router-link>
          </li>
          
          <li class="nav-item" v-if="canViewAssets">
            <router-link 
              to="/assets" 
              class="nav-link"
              :class="{ active: $route.name === 'assets' }"
            >
              <i class="bi bi-hdd-stack me-2"></i>
              Assets
              <span v-if="assetStats.total" class="badge bg-secondary ms-auto">
                {{ assetStats.total }}
              </span>
            </router-link>
          </li>
          
          <li class="nav-item" v-if="canViewVulnerabilities">
            <router-link 
              to="/vulnerabilities" 
              class="nav-link"
              :class="{ active: $route.name === 'vulnerabilities' }"
            >
              <i class="bi bi-shield-exclamation me-2"></i>
              Vulnerabilities
              <span v-if="vulnerabilityStats.critical" class="badge bg-danger ms-auto">
                {{ vulnerabilityStats.critical }}
              </span>
            </router-link>
          </li>
          
          <li class="nav-item">
            <router-link 
              to="/risks" 
              class="nav-link"
              :class="{ active: $route.name === 'risks' }"
            >
              <i class="bi bi-exclamation-triangle me-2"></i>
              Risks
              <span v-if="riskStats.critical" class="badge bg-warning ms-auto">
                {{ riskStats.critical }}
              </span>
            </router-link>
          </li>
          
          <li class="nav-item">
            <router-link 
              to="/compliance" 
              class="nav-link"
              :class="{ active: $route.name === 'compliance' }"
            >
              <i class="bi bi-check2-square me-2"></i>
              Compliance
            </router-link>
          </li>
          
          <li class="nav-item" v-if="canViewReports">
            <router-link 
              to="/reports" 
              class="nav-link"
              :class="{ active: $route.name === 'reports' }"
            >
              <i class="bi bi-file-earmark-text me-2"></i>
              Reports
            </router-link>
          </li>
          
          <li class="nav-item">
            <router-link 
              to="/remediation" 
              class="nav-link"
              :class="{ active: $route.name === 'remediation' }"
            >
              <i class="bi bi-tools me-2"></i>
              Remediation
            </router-link>
          </li>
        </ul>

        <!-- Secondary Navigation -->
        <hr class="text-muted">
        <ul class="nav flex-column">
          <li class="nav-item" v-if="canViewSettings">
            <router-link 
              to="/settings" 
              class="nav-link"
              :class="{ active: $route.name === 'settings' }"
            >
              <i class="bi bi-gear me-2"></i>
              Settings
            </router-link>
          </li>
        </ul>
      </div>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer p-3 border-top">
        <div class="d-flex align-items-center">
          <div 
            class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2"
            style="width: 32px; height: 32px; font-size: 0.875rem;"
          >
            {{ userInitials }}
          </div>
          <div class="flex-grow-1">
            <div class="fw-bold small">{{ user?.name }}</div>
            <div class="text-muted small">{{ roleLabels[user?.role] || user?.role }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Sidebar Overlay -->
    <div 
      v-if="isMobileSidebarOpen"
      class="sidebar-overlay"
      @click="closeMobileSidebar"
    ></div>

    <!-- Main Content -->
    <main class="main-content">
      <div class="container-fluid">
        <router-view />
      </div>
    </main>

    <!-- Loading Overlay -->
    <div v-if="isGlobalLoading" class="loading-overlay">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useAssetsStore } from '@/stores/assets'
import { useVulnerabilitiesStore } from '@/stores/vulnerabilities'
import { storeToRefs } from 'pinia'

// Stores
const router = useRouter()
const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const assetsStore = useAssetsStore()
const vulnerabilitiesStore = useVulnerabilitiesStore()

// Store refs
const { 
  user, 
  userInitials, 
  roleLabels,
  canViewAssets,
  canViewVulnerabilities,
  canViewReports,
  canViewSettings
} = storeToRefs(authStore)

const { 
  unreadCount: unreadNotifications,
  recentNotifications,
  markAsRead,
  markAllAsRead
} = storeToRefs(notificationsStore)

const { assetStats } = storeToRefs(assetsStore)
const { vulnerabilityStats } = storeToRefs(vulnerabilitiesStore)

// Local state
const isMobileSidebarOpen = ref(false)
const isGlobalLoading = ref(false)

// Mock risk stats (replace with actual store when implemented)
const riskStats = ref({
  critical: 3,
  high: 7,
  medium: 12,
  low: 5
})

// Methods
const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value
}

const closeMobileSidebar = () => {
  isMobileSidebarOpen.value = false
}

const showProfile = () => {
  // TODO: Implement profile modal or navigation
  console.log('Show profile')
}

const logout = async () => {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

const getNotificationIcon = (type: string) => {
  const icons = {
    vulnerability: 'bi bi-shield-exclamation text-danger',
    asset: 'bi bi-hdd-stack text-primary',
    compliance: 'bi bi-check2-square text-success',
    system: 'bi bi-gear text-info'
  }
  return icons[type as keyof typeof icons] || 'bi bi-info-circle text-info'
}

const formatTime = (timestamp: Date) => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// Handle window resize
const handleResize = () => {
  if (window.innerWidth >= 768) {
    isMobileSidebarOpen.value = false
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('resize', handleResize)
  
  // Load initial data
  if (canViewAssets.value) {
    assetsStore.fetchAssets()
  }
  if (canViewVulnerabilities.value) {
    vulnerabilitiesStore.fetchVulnerabilities()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Watch for route changes to close mobile sidebar
router.afterEach(() => {
  isMobileSidebarOpen.value = false
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
}

/* Top Navigation */
.navbar {
  z-index: 1030;
  height: 60px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.navbar-brand {
  font-size: 1.25rem;
  color: var(--ctem-primary) !important;
}

/* Sidebar */
.sidebar {
  position: fixed;
  top: 60px;
  left: 0;
  bottom: 0;
  width: 260px;
  background-color: var(--ctem-dark);
  color: white;
  z-index: 1020;
  transition: transform 0.3s ease;
  overflow-y: auto;
}

.sidebar-content {
  padding: 1rem 0;
}

.sidebar .nav-link {
  color: rgba(255, 255, 255, 0.8);
  padding: 0.75rem 1.5rem;
  border-radius: 0;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.sidebar .nav-link:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

.sidebar .nav-link.active {
  color: white;
  background-color: var(--ctem-primary);
  border-left: 4px solid rgba(255, 255, 255, 0.9);
}

.sidebar-footer {
  background-color: rgba(0, 0, 0, 0.2);
}

/* Mobile Sidebar */
@media (max-width: 767.98px) {
  .sidebar {
    transform: translateX(-100%);
  }
  
  .sidebar.mobile-open {
    transform: translateX(0);
  }
  
  .sidebar-overlay {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1010;
  }
}

/* Main Content */
.main-content {
  margin-left: 260px;
  margin-top: 60px;
  min-height: calc(100vh - 60px);
  background-color: #f8f9fa;
}

@media (max-width: 767.98px) {
  .main-content {
    margin-left: 0;
  }
}

/* Notifications Dropdown */
.notification-dropdown {
  width: 350px;
  max-height: 400px;
  overflow-y: auto;
}

.dropdown-item {
  white-space: normal;
  word-wrap: break-word;
}

/* Loading Overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* Badges in Navigation */
.nav-link .badge {
  font-size: 0.7rem;
  padding: 0.25em 0.5em;
}

/* Scrollbar Styling */
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

/* Animation for badges */
.badge {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
</style>