import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'analyst' | 'viewer'
  permissions: string[]
  lastLogin?: Date
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>({
    id: '1',
    name: 'Security Admin',
    email: 'admin@company.com',
    role: 'admin',
    permissions: ['read', 'write', 'admin'],
    lastLogin: new Date()
  })
  const isLoading = ref(false)
  const loginError = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const canWrite = computed(() => 
    currentUser.value?.permissions.includes('write') || false
  )

  // Actions
  async function login(email: string, password: string): Promise<void> {
    isLoading.value = true
    loginError.value = null
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock successful login
      currentUser.value = {
        id: '1',
        name: 'Security Admin',
        email: email,
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
        lastLogin: new Date()
      }
    } catch (error) {
      loginError.value = 'Login failed'
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function logout(): void {
    currentUser.value = null
    loginError.value = null
  }

  return {
    // State
    currentUser,
    isLoading,
    loginError,
    // Getters
    isAuthenticated,
    isAdmin,
    canWrite,
    // Actions
    login,
    logout
  }
})