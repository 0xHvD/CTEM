<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-md-5 col-lg-4">
          <div class="card shadow-lg border-0">
            <div class="card-header bg-primary text-white text-center py-4">
              <h3 class="mb-0">
                <i class="bi bi-shield-check me-2"></i>
                CTEM Login
              </h3>
              <p class="mb-0 opacity-75">Continuous Threat Exposure Management</p>
            </div>
            
            <div class="card-body p-4">
              <!-- Error Alert -->
              <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                {{ error }}
                <button type="button" class="btn-close" @click="clearError"></button>
              </div>

              <!-- Success Alert -->
              <div v-if="successMessage" class="alert alert-success alert-dismissible fade show" role="alert">
                <i class="bi bi-check-circle me-2"></i>
                {{ successMessage }}
                <button type="button" class="btn-close" @click="successMessage = ''"></button>
              </div>

              <!-- Login Form -->
              <form @submit.prevent="handleLogin" novalidate>
                <div class="mb-3">
                  <label for="email" class="form-label">Email Address</label>
                  <div class="input-group">
                    <span class="input-group-text">
                      <i class="bi bi-envelope"></i>
                    </span>
                    <input
                      id="email"
                      v-model="form.email"
                      type="email"
                      class="form-control"
                      :class="{ 'is-invalid': emailError }"
                      placeholder="Enter your email"
                      autocomplete="email"
                      required
                      :disabled="isLoading"
                    />
                    <div v-if="emailError" class="invalid-feedback">
                      {{ emailError }}
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="password" class="form-label">Password</label>
                  <div class="input-group">
                    <span class="input-group-text">
                      <i class="bi bi-lock"></i>
                    </span>
                    <input
                      id="password"
                      v-model="form.password"
                      :type="showPassword ? 'text' : 'password'"
                      class="form-control"
                      :class="{ 'is-invalid': passwordError }"
                      placeholder="Enter your password"
                      autocomplete="current-password"
                      required
                      :disabled="isLoading"
                    />
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      @click="togglePasswordVisibility"
                      :disabled="isLoading"
                    >
                      <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                    </button>
                    <div v-if="passwordError" class="invalid-feedback">
                      {{ passwordError }}
                    </div>
                  </div>
                </div>

                <div class="mb-3 form-check">
                  <input
                    id="rememberMe"
                    v-model="form.rememberMe"
                    type="checkbox"
                    class="form-check-input"
                    :disabled="isLoading"
                  />
                  <label for="rememberMe" class="form-check-label">
                    Remember me for 30 days
                  </label>
                </div>

                <button
                  type="submit"
                  class="btn btn-primary w-100 py-2"
                  :disabled="isLoading || !isFormValid"
                >
                  <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </span>
                  <i v-else class="bi bi-box-arrow-in-right me-2"></i>
                  {{ isLoading ? 'Signing In...' : 'Sign In' }}
                </button>
              </form>

              <!-- Additional Links -->
              <div class="text-center mt-4">
                <small class="text-muted">
                  Forgot your password? Contact your administrator.
                </small>
              </div>
            </div>

            <!-- Footer -->
            <div class="card-footer bg-light text-center text-muted py-3">
              <small>
                Secure access to CTEM Dashboard
                <br>
                <i class="bi bi-shield-fill-check text-success me-1"></i>
                Protected by enterprise security
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

// Router
const router = useRouter()
const route = useRoute()

// Auth Store
const authStore = useAuthStore()
const { isLoading, isAuthenticated } = storeToRefs(authStore)

// Form state
const form = ref({
  email: '',
  password: '',
  rememberMe: false
})

// UI state
const showPassword = ref(false)
const error = ref('')
const successMessage = ref('')

// Validation state
const emailError = ref('')
const passwordError = ref('')

// Computed properties
const isFormValid = computed(() => {
  return form.value.email.length > 0 && 
         form.value.password.length >= 8 && 
         !emailError.value && 
         !passwordError.value
})

// Methods
const validateEmail = () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.value.email) {
    emailError.value = 'Email is required'
  } else if (!emailRegex.test(form.value.email)) {
    emailError.value = 'Please enter a valid email address'
  } else {
    emailError.value = ''
  }
}

const validatePassword = () => {
  if (!form.value.password) {
    passwordError.value = 'Password is required'
  } else if (form.value.password.length < 8) {
    passwordError.value = 'Password must be at least 8 characters'
  } else {
    passwordError.value = ''
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const clearError = () => {
  error.value = ''
}

const handleLogin = async () => {
  // Clear previous errors
  error.value = ''
  emailError.value = ''
  passwordError.value = ''

  // Validate form
  validateEmail()
  validatePassword()

  if (emailError.value || passwordError.value) {
    return
  }

  try {
    await authStore.login({
      email: form.value.email.toLowerCase().trim(),
      password: form.value.password,
      rememberMe: form.value.rememberMe
    })

    // Get redirect path from query params or default to dashboard
    const redirectPath = route.query.redirect as string || '/'
    
    successMessage.value = 'Login successful! Redirecting...'
    
    // Redirect after short delay to show success message
    setTimeout(() => {
      router.push(redirectPath)
    }, 1000)

  } catch (err: any) {
    console.error('Login error:', err)
    
    // Handle different error types
    if (err.response?.status === 401) {
      error.value = 'Invalid email or password. Please try again.'
    } else if (err.response?.status === 423) {
      error.value = 'Account has been deactivated. Please contact your administrator.'
    } else if (err.response?.data?.message) {
      error.value = err.response.data.message
    } else {
      error.value = 'An error occurred during login. Please try again.'
    }
  }
}

// Lifecycle hooks
onMounted(() => {
  // Redirect if already authenticated
  if (isAuthenticated.value) {
    const redirectPath = route.query.redirect as string || '/'
    router.push(redirectPath)
  }

  // Set focus to email field
  const emailInput = document.getElementById('email')
  if (emailInput) {
    emailInput.focus()
  }

  // Check for query parameters (e.g., logout message)
  if (route.query.message === 'logged_out') {
    successMessage.value = 'You have been successfully logged out.'
  }
})

// Watch for form changes to validate
import { watch } from 'vue'

watch(() => form.value.email, validateEmail)
watch(() => form.value.password, validatePassword)
</script>

<style scoped>
.card {
  border-radius: 0.75rem;
  overflow: hidden;
}

.card-header {
  border: none;
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
}

.input-group-text {
  background-color: #f8f9fa;
  border-color: #ced4da;
  color: #6c757d;
}

.btn-primary {
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  border: none;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.form-control:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.25);
}

.card-footer {
  border-top: 1px solid #e9ecef;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}

.alert {
  border: none;
  border-radius: 0.5rem;
}

.alert-danger {
  background-color: #fef2f2;
  color: #991b1b;
}

.alert-success {
  background-color: #f0fdf4;
  color: #166534;
}

@media (max-width: 576px) {
  .card {
    margin: 1rem;
  }
  
  .card-body {
    padding: 1.5rem;
  }
}

/* Loading animation */
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.btn-primary:disabled {
  animation: pulse 2s infinite;
}
</style>