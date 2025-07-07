import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'ANALYST' | 'VIEWER'
  permissions: string[]
  avatar?: string
  lastLogin?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

interface AuthResponse {
  success: boolean
  data: {
    token: string
    refreshToken: string
    user: User
  }
  message: string
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isLoading = ref(false)
  const isInitialized = ref(false)

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  
  const hasRole = computed(() => (role: string) => {
    return user.value?.role === role
  })
  
  const hasPermission = computed(() => (permission: string) => {
    if (user.value?.role === 'ADMIN') return true
    return user.value?.permissions?.includes(permission) ?? false
  })

  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const isAnalyst = computed(() => user.value?.role === 'ANALYST')
  const isViewer = computed(() => user.value?.role === 'VIEWER')
  
  // Additional permission computed properties
  const canEditSettings = computed(() => {
    return isAdmin.value || hasPermission.value('settings:write')
  })
  
  const canManageUsers = computed(() => {
    return isAdmin.value || hasPermission.value('users:manage')
  })
  
  const canManageSystem = computed(() => {
    return isAdmin.value || hasPermission.value('system:manage')
  })

  // Actions
  const initializeAuth = async () => {
    if (isInitialized.value) return

    try {
      // Get tokens from localStorage
      const storedToken = localStorage.getItem('ctem_token')
      const storedRefreshToken = localStorage.getItem('ctem_refresh_token')

      if (storedToken) {
        token.value = storedToken
        refreshToken.value = storedRefreshToken

        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`

        // Verify token and get user data
        await getCurrentUser()
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      await logout()
    } finally {
      isInitialized.value = true
    }
  }

  const login = async (credentials: LoginCredentials) => {
    isLoading.value = true
    
    try {
      const response = await axios.post<AuthResponse>('/api/auth/login', credentials)
      
      if (response.data.success) {
        const { token: accessToken, refreshToken: refToken, user: userData } = response.data.data

        // Store tokens
        token.value = accessToken
        refreshToken.value = refToken
        user.value = userData

        // Persist tokens
        localStorage.setItem('ctem_token', accessToken)
        if (refToken) {
          localStorage.setItem('ctem_refresh_token', refToken)
        }

        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`

        return response.data
      } else {
        throw new Error(response.data.message || 'Login failed')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      
      // Clear any partial state
      await logout()
      
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (apiCall = true) => {
    isLoading.value = true

    try {
      if (apiCall && token.value) {
        try {
          await axios.post('/api/auth/logout', {
            refreshToken: refreshToken.value
          })
        } catch (error) {
          console.warn('Logout API call failed:', error)
          // Continue with local logout even if API fails
        }
      }
    } finally {
      // Clear local state
      user.value = null
      token.value = null
      refreshToken.value = null

      // Clear storage
      localStorage.removeItem('ctem_token')
      localStorage.removeItem('ctem_refresh_token')

      // Clear axios header
      delete axios.defaults.headers.common['Authorization']

      isLoading.value = false
    }
  }

  const getCurrentUser = async () => {
    try {
      const response = await axios.get('/api/auth/me')
      
      if (response.data.success) {
        user.value = response.data.data.user
        return response.data.data.user
      } else {
        throw new Error('Failed to get user data')
      }
    } catch (error: any) {
      console.error('Get current user error:', error)
      
      if (error.response?.status === 401) {
        await refreshTokens()
      } else {
        throw error
      }
    }
  }

  const refreshTokens = async () => {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await axios.post('/api/auth/refresh', {
        refreshToken: refreshToken.value
      })

      if (response.data.success) {
        const newToken = response.data.data.token
        
        token.value = newToken
        localStorage.setItem('ctem_token', newToken)
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`

        // Get updated user data
        await getCurrentUser()

        return newToken
      } else {
        throw new Error('Token refresh failed')
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      await logout(false) // Don't call API on refresh failure
      throw error
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    isLoading.value = true

    try {
      const response = await axios.put('/api/auth/change-password', {
        currentPassword,
        newPassword
      })

      if (response.data.success) {
        return response.data
      } else {
        throw new Error(response.data.message || 'Password change failed')
      }
    } finally {
      isLoading.value = false
    }
  }

  const updateProfile = async (profileData: Partial<User>) => {
    isLoading.value = true

    try {
      const response = await axios.put(`/api/users/${user.value?.id}`, profileData)

      if (response.data.success) {
        user.value = { ...user.value, ...response.data.data }
        return response.data
      } else {
        throw new Error(response.data.message || 'Profile update failed')
      }
    } finally {
      isLoading.value = false
    }
  }

  // Setup axios interceptors for automatic token refresh
  const setupInterceptors = () => {
    let isRefreshing = false
    let failedQueue: any[] = []

    const processQueue = (error: any, token: string | null = null) => {
      failedQueue.forEach(prom => {
        if (error) {
          prom.reject(error)
        } else {
          prom.resolve(token)
        }
      })
      
      failedQueue = []
    }

    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject })
            }).then(token => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`
              return axios(originalRequest)
            }).catch(err => {
              return Promise.reject(err)
            })
          }

          originalRequest._retry = true
          isRefreshing = true

          try {
            const newToken = await refreshTokens()
            processQueue(null, newToken)
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`
            return axios(originalRequest)
          } catch (refreshError) {
            processQueue(refreshError, null)
            await logout(false)
            return Promise.reject(refreshError)
          } finally {
            isRefreshing = false
          }
        }

        return Promise.reject(error)
      }
    )
  }

  return {
    // State
    user,
    token,
    refreshToken,
    isLoading,
    isInitialized,
    
    // Computed
    isAuthenticated,
    hasRole,
    hasPermission,
    isAdmin,
    isAnalyst,
    isViewer,
    canEditSettings,
    canManageUsers,
    canManageSystem,
    
    // Actions
    initializeAuth,
    login,
    logout,
    getCurrentUser,
    refreshTokens,
    changePassword,
    updateProfile,
    setupInterceptors
  }
})