import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService, type ApiError } from '@/services/api'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'analyst' | 'viewer'
  permissions: string[]
  lastLogin?: string
  avatar?: string
}

interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  
  const userRole = computed(() => user.value?.role || null)
  
  const userPermissions = computed(() => user.value?.permissions || [])
  
  const isAdmin = computed(() => user.value?.role === 'admin')
  
  const isAnalyst = computed(() => user.value?.role === 'analyst' || user.value?.role === 'admin')
  
  const canViewAssets = computed(() => 
    userPermissions.value.includes('assets:read') || isAdmin.value
  )
  
  const canEditAssets = computed(() => 
    userPermissions.value.includes('assets:write') || isAdmin.value
  )
  
  const canViewVulnerabilities = computed(() => 
    userPermissions.value.includes('vulnerabilities:read') || isAnalyst.value
  )
  
  const canEditVulnerabilities = computed(() => 
    userPermissions.value.includes('vulnerabilities:write') || isAdmin.value
  )
  
  const canViewReports = computed(() => 
    userPermissions.value.includes('reports:read') || isAnalyst.value
  )
  
  const canGenerateReports = computed(() => 
    userPermissions.value.includes('reports:write') || isAdmin.value
  )
  
  const canViewSettings = computed(() => 
    userPermissions.value.includes('settings:read') || isAdmin.value
  )
  
  const canEditSettings = computed(() => 
    userPermissions.value.includes('settings:write') || isAdmin.value
  )

  // Actions
  async function login(credentials: LoginCredentials) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.login(credentials.email, credentials.password)
      
      if (response.success) {
        token.value = response.data.token
        user.value = response.data.user
        
        // Store in localStorage if remember me is checked
        if (credentials.rememberMe) {
          localStorage.setItem(
            import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ctem_auth_token', 
            response.data.token
          )
        } else {
          sessionStorage.setItem(
            import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ctem_auth_token', 
            response.data.token
          )
        }
        
        // Store user data
        localStorage.setItem('ctem_user_data', JSON.stringify(response.data.user))
        
        return response.data.user
      } else {
        throw new Error(response.message || 'Login failed')
      }
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Login failed:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true
    error.value = null

    try {
      // Call logout endpoint to invalidate token on server
      await apiService.logout()
    } catch (err) {
      // Even if logout fails on server, we should clear local data
      console.error('Logout API call failed:', err)
    } finally {
      // Clear local state
      user.value = null
      token.value = null
      refreshToken.value = null
      
      // Clear storage
      localStorage.removeItem(import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ctem_auth_token')
      sessionStorage.removeItem(import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ctem_auth_token')
      localStorage.removeItem('ctem_user_data')
      localStorage.removeItem(import.meta.env.VITE_REFRESH_TOKEN_STORAGE_KEY || 'ctem_refresh_token')
      
      isLoading.value = false
    }
  }

  async function refreshAuthToken() {
    try {
      const response = await apiService.refreshToken()
      
      if (response.success) {
        token.value = response.data.token
        
        // Update stored token
        const storageKey = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ctem_auth_token'
        if (localStorage.getItem(storageKey)) {
          localStorage.setItem(storageKey, response.data.token)
        } else if (sessionStorage.getItem(storageKey)) {
          sessionStorage.setItem(storageKey, response.data.token)
        }
        
        return response.data.token
      } else {
        throw new Error('Token refresh failed')
      }
    } catch (err) {
      console.error('Token refresh failed:', err)
      await logout()
      throw err
    }
  }

  function restoreSession() {
    // Try to restore from localStorage first, then sessionStorage
    const storageKey = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ctem_auth_token'
    const storedToken = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey)
    const storedUser = localStorage.getItem('ctem_user_data')
    
    if (storedToken && storedUser) {
      try {
        token.value = storedToken
        user.value = JSON.parse(storedUser)
        
        // Verify token is still valid by making a test API call
        // This could be done in the background
        return true
      } catch (err) {
        console.error('Failed to restore session:', err)
        clearSession()
        return false
      }
    }
    
    return false
  }

  function clearSession() {
    user.value = null
    token.value = null
    refreshToken.value = null
    
    const storageKey = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ctem_auth_token'
    localStorage.removeItem(storageKey)
    sessionStorage.removeItem(storageKey)
    localStorage.removeItem('ctem_user_data')
    localStorage.removeItem(import.meta.env.VITE_REFRESH_TOKEN_STORAGE_KEY || 'ctem_refresh_token')
  }

  function clearError() {
    error.value = null
  }

  // Check if user has specific permission
  function hasPermission(permission: string): boolean {
    if (isAdmin.value) return true
    return userPermissions.value.includes(permission)
  }

  // Check if user has any of the specified permissions
  function hasAnyPermission(permissions: string[]): boolean {
    if (isAdmin.value) return true
    return permissions.some(permission => userPermissions.value.includes(permission))
  }

  // Check if user has all of the specified permissions
  function hasAllPermissions(permissions: string[]): boolean {
    if (isAdmin.value) return true
    return permissions.every(permission => userPermissions.value.includes(permission))
  }

  // Get user initials for avatar
  const userInitials = computed(() => {
    if (!user.value?.name) return ''
    return user.value.name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  })

  // Role labels for UI
  const roleLabels = {
    'admin': 'Administrator',
    'analyst': 'Security Analyst',
    'viewer': 'Viewer'
  }

  return {
    // State
    user,
    token,
    refreshToken,
    isLoading,
    error,
    
    // Getters
    isAuthenticated,
    userRole,
    userPermissions,
    isAdmin,
    isAnalyst,
    canViewAssets,
    canEditAssets,
    canViewVulnerabilities,
    canEditVulnerabilities,
    canViewReports,
    canGenerateReports,
    canViewSettings,
    canEditSettings,
    userInitials,
    
    // Actions
    login,
    logout,
    refreshAuthToken,
    restoreSession,
    clearSession,
    clearError,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Constants
    roleLabels
  }
})