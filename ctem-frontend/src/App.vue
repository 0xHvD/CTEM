<template>
  <div id="app">
    <!-- Loading Screen during auth initialization -->
    <div v-if="!authStore.isInitialized" class="loading-screen">
      <div class="d-flex flex-column align-items-center justify-content-center min-vh-100">
        <div class="mb-4">
          <i class="bi bi-shield-check text-primary" style="font-size: 4rem;"></i>
        </div>
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <h4 class="text-muted">Initializing CTEM Platform...</h4>
      </div>
    </div>

    <!-- Public Layout (Home, Login) -->
    <template v-else-if="isPublicRoute">
      <router-view />
    </template>

    <!-- Authenticated Layout (Dashboard, etc.) -->
    <template v-else-if="authStore.isAuthenticated">
      <div class="authenticated-layout">
        <!-- Navigation Header -->
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
          <div class="container-fluid">
            <router-link class="navbar-brand d-flex align-items-center" to="/dashboard">
              <i class="bi bi-shield-check me-2"></i>
              CTEM Platform
            </router-link>

            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
              <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarNav">
              <ul class="navbar-nav me-auto">
                <li class="nav-item">
                  <router-link class="nav-link" to="/dashboard" active-class="active">
                    <i class="bi bi-speedometer2 me-1"></i>Dashboard
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/assets" active-class="active">
                    <i class="bi bi-hdd-stack me-1"></i>Assets
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/vulnerabilities" active-class="active">
                    <i class="bi bi-exclamation-triangle me-1"></i>Vulnerabilities
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/risks" active-class="active">
                    <i class="bi bi-shield-exclamation me-1"></i>Risks
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/remediation" active-class="active">
                    <i class="bi bi-tools me-1"></i>Remediation
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/compliance" active-class="active">
                    <i class="bi bi-patch-check me-1"></i>Compliance
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/reports" active-class="active">
                    <i class="bi bi-file-earmark-text me-1"></i>Reports
                  </router-link>
                </li>
                <li class="nav-item" v-if="authStore.isAdmin">
                  <router-link class="nav-link" to="/settings" active-class="active">
                    <i class="bi bi-gear me-1"></i>Settings
                  </router-link>
                </li>
              </ul>

              <!-- User Menu -->
              <div class="navbar-nav">
                <div class="nav-item dropdown">
                  <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
                    <div class="user-avatar me-2">
                      <i class="bi bi-person-circle"></i>
                    </div>
                    <span class="d-none d-md-inline">{{ authStore.user?.name }}</span>
                  </a>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                      <div class="dropdown-header">
                        <div class="fw-bold">{{ authStore.user?.name }}</div>
                        <small class="text-muted">{{ authStore.user?.email }}</small>
                        <small class="badge bg-primary">{{ authStore.user?.role }}</small>
                      </div>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                      <a class="dropdown-item" href="#" @click="showProfileModal = true">
                        <i class="bi bi-person me-2"></i>Profile
                      </a>
                    </li>
                    <li>
                      <a class="dropdown-item" href="#" @click="showChangePasswordModal = true">
                        <i class="bi bi-key me-2"></i>Change Password
                      </a>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                      <a class="dropdown-item text-danger" href="#" @click="handleLogout">
                        <i class="bi bi-box-arrow-right me-2"></i>Sign Out
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <!-- Main Content Area -->
        <main class="main-content">
          <div class="container-fluid">
            <router-view />
          </div>
        </main>
      </div>
    </template>

    <!-- Fallback: Redirect to login if not authenticated -->
    <template v-else>
      <div class="d-flex align-items-center justify-content-center min-vh-100">
        <div class="text-center">
          <i class="bi bi-shield-x text-warning mb-3" style="font-size: 3rem;"></i>
          <h4>Access Restricted</h4>
          <p class="text-muted">Please log in to access the CTEM platform.</p>
          <router-link to="/login" class="btn btn-primary">
            <i class="bi bi-box-arrow-in-right me-2"></i>Go to Login
          </router-link>
        </div>
      </div>
    </template>

    <!-- Profile Modal -->
    <div v-if="showProfileModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">User Profile</h5>
            <button type="button" class="btn-close" @click="showProfileModal = false"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="updateProfile">
              <div class="mb-3">
                <label for="profileName" class="form-label">Name</label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="profileName"
                  v-model="profileForm.name"
                >
              </div>
              <div class="mb-3">
                <label for="profileEmail" class="form-label">Email</label>
                <input 
                  type="email" 
                  class="form-control" 
                  id="profileEmail"
                  v-model="profileForm.email"
                  disabled
                >
                <div class="form-text">Email cannot be changed. Contact your administrator.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Role</label>
                <input 
                  type="text" 
                  class="form-control" 
                  :value="authStore.user?.role"
                  disabled
                >
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showProfileModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" @click="updateProfile" :disabled="isUpdatingProfile">
              <span v-if="isUpdatingProfile" class="spinner-border spinner-border-sm me-2"></span>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Change Password Modal -->
    <div v-if="showChangePasswordModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Change Password</h5>
            <button type="button" class="btn-close" @click="showChangePasswordModal = false"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="changePassword">
              <div class="mb-3">
                <label for="currentPassword" class="form-label">Current Password</label>
                <input 
                  type="password" 
                  class="form-control" 
                  id="currentPassword"
                  v-model="passwordForm.currentPassword"
                  required
                >
              </div>
              <div class="mb-3">
                <label for="newPassword" class="form-label">New Password</label>
                <input 
                  type="password" 
                  class="form-control" 
                  id="newPassword"
                  v-model="passwordForm.newPassword"
                  minlength="8"
                  required
                >
              </div>
              <div class="mb-3">
                <label for="confirmPassword" class="form-label">Confirm New Password</label>
                <input 
                  type="password" 
                  class="form-control" 
                  id="confirmPassword"
                  v-model="passwordForm.confirmPassword"
                  required
                >
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showChangePasswordModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" @click="changePassword" :disabled="isChangingPassword || !isPasswordFormValid">
              <span v-if="isChangingPassword" class="spinner-border spinner-border-sm me-2"></span>
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div v-if="notification.show" class="toast show" role="alert">
        <div class="toast-header">
          <i :class="notification.type === 'success' ? 'bi bi-check-circle text-success' : 'bi bi-exclamation-triangle text-danger'" class="me-2"></i>
          <strong class="me-auto">{{ notification.type === 'success' ? 'Success' : 'Error' }}</strong>
          <button type="button" class="btn-close" @click="notification.show = false"></button>
        </div>
        <div class="toast-body">
          {{ notification.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Router
const route = useRoute()
const router = useRouter()

// Stores
const authStore = useAuthStore()

// Local state
const showProfileModal = ref(false)
const showChangePasswordModal = ref(false)
const isUpdatingProfile = ref(false)
const isChangingPassword = ref(false)

const notification = ref({
  show: false,
  type: 'success' as 'success' | 'error',
  message: ''
})

const profileForm = ref({
  name: '',
  email: ''
})

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// Computed
const isPublicRoute = computed(() => {
  const publicRoutes = ['home', 'login']
  return publicRoutes.includes(route.name as string)
})

const isPasswordFormValid = computed(() => {
  return passwordForm.value.currentPassword.length >= 8 &&
         passwordForm.value.newPassword.length >= 8 &&
         passwordForm.value.newPassword === passwordForm.value.confirmPassword
})

// Methods
const showNotification = (type: 'success' | 'error', message: string) => {
  notification.value = { show: true, type, message }
  setTimeout(() => {
    notification.value.show = false
  }, 5000)
}

const handleLogout = async () => {
  if (confirm('Are you sure you want to sign out?')) {
    try {
      await authStore.logout()
      router.push('/login?message=logged_out')
    } catch (error) {
      console.error('Logout error:', error)
      showNotification('error', 'Failed to sign out')
    }
  }
}

const updateProfile = async () => {
  if (!profileForm.value.name.trim()) {
    showNotification('error', 'Name is required')
    return
  }

  isUpdatingProfile.value = true
  try {
    await authStore.updateProfile({
      name: profileForm.value.name.trim()
    })
    
    showProfileModal.value = false
    showNotification('success', 'Profile updated successfully')
  } catch (error: any) {
    showNotification('error', error.message || 'Failed to update profile')
  } finally {
    isUpdatingProfile.value = false
  }
}

const changePassword = async () => {
  if (!isPasswordFormValid.value) {
    showNotification('error', 'Please check your password requirements')
    return
  }

  isChangingPassword.value = true
  try {
    await authStore.changePassword(
      passwordForm.value.currentPassword,
      passwordForm.value.newPassword
    )
    
    showChangePasswordModal.value = false
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    showNotification('success', 'Password changed successfully')
  } catch (error: any) {
    showNotification('error', error.message || 'Failed to change password')
  } finally {
    isChangingPassword.value = false
  }
}

const initializeProfileForm = () => {
  if (authStore.user) {
    profileForm.value = {
      name: authStore.user.name,
      email: authStore.user.email
    }
  }
}

// Watchers
watch(() => authStore.user, initializeProfileForm, { immediate: true })

watch(() => showProfileModal.value, (show) => {
  if (show) {
    initializeProfileForm()
  }
})

watch(() => showChangePasswordModal.value, (show) => {
  if (!show) {
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  }
})

// Lifecycle
onMounted(async () => {
  // Initialize auth store
  await authStore.initializeAuth()
  
  // Setup axios interceptors
  authStore.setupInterceptors()
})
</script>

<style scoped>
.loading-screen {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.authenticated-layout {
  min-height: 100vh;
  padding-top: 76px; /* Account for fixed navbar */
}

.main-content {
  padding: 2rem 0;
}

.navbar-brand {
  font-weight: 700;
  font-size: 1.25rem;
}

.nav-link {
  transition: all 0.3s ease;
  border-radius: 0.375rem;
  margin: 0 0.25rem;
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-link.active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: 600;
}

.user-avatar i {
  font-size: 1.5rem;
}

.dropdown-header {
  padding: 0.75rem 1rem;
}

.dropdown-item {
  transition: all 0.2s ease;
}

.dropdown-item:hover {
  background-color: rgba(0, 123, 255, 0.1);
}

.modal.show {
  display: block !important;
}

.toast-container {
  z-index: 1100;
}

.toast {
  min-width: 300px;
}

@media (max-width: 768px) {
  .main-content {
    padding: 1rem 0;
  }
  
  .navbar-nav .nav-link {
    margin: 0.25rem 0;
  }
  
  .d-none.d-md-inline {
    display: none !important;
  }
}

/* Custom scrollbar for sidebar if needed */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>