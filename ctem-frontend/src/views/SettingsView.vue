<template>
  <div class="settings-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Settings</h1>
        <p class="text-muted mb-0">Configure system settings and preferences</p>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary" @click="resetToDefaults">
          <i class="bi bi-arrow-clockwise me-2"></i>Reset to Defaults
        </button>
        <button class="btn btn-primary" @click="saveSettings" :disabled="isSaving">
          <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="bi bi-check me-2"></i>Save Changes
        </button>
      </div>
    </div>
    
    <div class="row">
      <!-- Settings Navigation -->
      <div class="col-md-3">
        <div class="list-group settings-nav">
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'general' }"
            @click="activeTab = 'general'"
          >
            <i class="bi bi-gear me-2"></i>General
          </a>
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'security' }"
            @click="activeTab = 'security'"
          >
            <i class="bi bi-shield me-2"></i>Security
          </a>
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'notifications' }"
            @click="activeTab = 'notifications'"
          >
            <i class="bi bi-bell me-2"></i>Notifications
          </a>
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'scanning' }"
            @click="activeTab = 'scanning'"
          >
            <i class="bi bi-search me-2"></i>Scanning
          </a>
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'integrations' }"
            @click="activeTab = 'integrations'"
          >
            <i class="bi bi-link me-2"></i>Integrations
          </a>
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'users' }"
            @click="activeTab = 'users'"
            v-if="canManageUsers"
          >
            <i class="bi bi-people me-2"></i>Users & Roles
          </a>
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'backup' }"
            @click="activeTab = 'backup'"
            v-if="canManageSystem"
          >
            <i class="bi bi-cloud-download me-2"></i>Backup & Restore
          </a>
          <a 
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: activeTab === 'system' }"
            @click="activeTab = 'system'"
            v-if="canManageSystem"
          >
            <i class="bi bi-cpu me-2"></i>System
          </a>
        </div>
      </div>
      
      <!-- Settings Content -->
      <div class="col-md-9">
        <!-- General Settings -->
        <div v-if="activeTab === 'general'" class="card">
          <div class="card-body">
            <h5 class="card-title">General Settings</h5>
            
            <form @submit.prevent="saveSettings">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="organizationName" class="form-label">Organization Name</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    id="organizationName"
                    v-model="settings.general.organizationName"
                  >
                </div>
                <div class="col-md-6 mb-3">
                  <label for="timezone" class="form-label">Timezone</label>
                  <select class="form-select" id="timezone" v-model="settings.general.timezone">
                    <option value="UTC">UTC</option>
                    <option value="Europe/Berlin">Europe/Berlin</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </div>
              </div>
              
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="dateFormat" class="form-label">Date Format</label>
                  <select class="form-select" id="dateFormat" v-model="settings.general.dateFormat">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="language" class="form-label">Language</label>
                  <select class="form-select" id="language" v-model="settings.general.language">
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="defaultPageSize" class="form-label">Default Page Size</label>
                <select class="form-select" id="defaultPageSize" v-model="settings.general.defaultPageSize">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              
              <div class="form-check mb-3">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="darkMode"
                  v-model="settings.general.darkMode"
                >
                <label class="form-check-label" for="darkMode">
                  Enable Dark Mode
                </label>
              </div>
              
              <div class="form-check mb-3">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="autoRefresh"
                  v-model="settings.general.autoRefresh"
                >
                <label class="form-check-label" for="autoRefresh">
                  Auto-refresh dashboards
                </label>
              </div>
            </form>
          </div>
        </div>

        <!-- Security Settings -->
        <div v-if="activeTab === 'security'" class="card">
          <div class="card-body">
            <h5 class="card-title">Security Settings</h5>
            
            <form @submit.prevent="saveSettings">
              <div class="mb-4">
                <h6>Authentication</h6>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="requireMFA"
                    v-model="settings.security.requireMFA"
                  >
                  <label class="form-check-label" for="requireMFA">
                    Require Multi-Factor Authentication
                  </label>
                </div>
                
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="sessionTimeout" class="form-label">Session Timeout (minutes)</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="sessionTimeout"
                      v-model="settings.security.sessionTimeout"
                      min="5"
                      max="1440"
                    >
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="passwordExpiry" class="form-label">Password Expiry (days)</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="passwordExpiry"
                      v-model="settings.security.passwordExpiry"
                      min="30"
                      max="365"
                    >
                  </div>
                </div>
              </div>
              
              <div class="mb-4">
                <h6>Access Control</h6>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="ipWhitelist"
                    v-model="settings.security.ipWhitelist.enabled"
                  >
                  <label class="form-check-label" for="ipWhitelist">
                    Enable IP Whitelist
                  </label>
                </div>
                
                <div v-if="settings.security.ipWhitelist.enabled" class="mb-3">
                  <label for="allowedIPs" class="form-label">Allowed IP Addresses</label>
                  <textarea 
                    class="form-control" 
                    id="allowedIPs"
                    rows="3"
                    v-model="settings.security.ipWhitelist.addresses"
                    placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                  ></textarea>
                  <div class="form-text">Enter one IP address or CIDR block per line</div>
                </div>
              </div>
              
              <div class="mb-4">
                <h6>API Security</h6>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="apiRateLimit"
                    v-model="settings.security.apiRateLimit.enabled"
                  >
                  <label class="form-check-label" for="apiRateLimit">
                    Enable API Rate Limiting
                  </label>
                </div>
                
                <div v-if="settings.security.apiRateLimit.enabled" class="row">
                  <div class="col-md-6 mb-3">
                    <label for="rateLimit" class="form-label">Requests per minute</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="rateLimit"
                      v-model="settings.security.apiRateLimit.limit"
                      min="10"
                      max="10000"
                    >
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        <!-- Notification Settings -->
        <div v-if="activeTab === 'notifications'" class="card">
          <div class="card-body">
            <h5 class="card-title">Notification Settings</h5>
            
            <form @submit.prevent="saveSettings">
              <div class="mb-4">
                <h6>Email Notifications</h6>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="emailEnabled"
                    v-model="settings.notifications.email.enabled"
                  >
                  <label class="form-check-label" for="emailEnabled">
                    Enable Email Notifications
                  </label>
                </div>
                
                <div v-if="settings.notifications.email.enabled">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label for="smtpServer" class="form-label">SMTP Server</label>
                      <input 
                        type="text" 
                        class="form-control" 
                        id="smtpServer"
                        v-model="settings.notifications.email.smtpServer"
                        placeholder="smtp.example.com"
                      >
                    </div>
                    <div class="col-md-6 mb-3">
                      <label for="smtpPort" class="form-label">SMTP Port</label>
                      <input 
                        type="number" 
                        class="form-control" 
                        id="smtpPort"
                        v-model="settings.notifications.email.smtpPort"
                        placeholder="587"
                      >
                    </div>
                  </div>
                  
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label for="smtpUsername" class="form-label">Username</label>
                      <input 
                        type="text" 
                        class="form-control" 
                        id="smtpUsername"
                        v-model="settings.notifications.email.username"
                      >
                    </div>
                    <div class="col-md-6 mb-3">
                      <label for="smtpPassword" class="form-label">Password</label>
                      <input 
                        type="password" 
                        class="form-control" 
                        id="smtpPassword"
                        v-model="settings.notifications.email.password"
                      >
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <label for="fromEmail" class="form-label">From Email</label>
                    <input 
                      type="email" 
                      class="form-control" 
                      id="fromEmail"
                      v-model="settings.notifications.email.fromEmail"
                      placeholder="ctem@example.com"
                    >
                  </div>
                </div>
              </div>
              
              <div class="mb-4">
                <h6>Alert Thresholds</h6>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="criticalThreshold" class="form-label">Critical Vulnerabilities</label>
                    <div class="input-group">
                      <span class="input-group-text">≥</span>
                      <input 
                        type="number" 
                        class="form-control" 
                        id="criticalThreshold"
                        v-model="settings.notifications.thresholds.criticalVulns"
                        min="1"
                      >
                      <span class="input-group-text">vulnerabilities</span>
                    </div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="riskThreshold" class="form-label">Risk Score</label>
                    <div class="input-group">
                      <span class="input-group-text">≥</span>
                      <input 
                        type="number" 
                        class="form-control" 
                        id="riskThreshold"
                        v-model="settings.notifications.thresholds.riskScore"
                        min="0"
                        max="10"
                        step="0.1"
                      >
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mb-4">
                <h6>Notification Types</h6>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="newVulns"
                    v-model="settings.notifications.types.newVulnerabilities"
                  >
                  <label class="form-check-label" for="newVulns">
                    New vulnerabilities detected
                  </label>
                </div>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="riskChanges"
                    v-model="settings.notifications.types.riskChanges"
                  >
                  <label class="form-check-label" for="riskChanges">
                    Risk score changes
                  </label>
                </div>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="complianceChanges"
                    v-model="settings.notifications.types.complianceChanges"
                  >
                  <label class="form-check-label" for="complianceChanges">
                    Compliance status changes
                  </label>
                </div>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="systemAlerts"
                    v-model="settings.notifications.types.systemAlerts"
                  >
                  <label class="form-check-label" for="systemAlerts">
                    System alerts and errors
                  </label>
                </div>
              </div>
            </form>
          </div>
        </div>

        <!-- Scanning Settings -->
        <div v-if="activeTab === 'scanning'" class="card">
          <div class="card-body">
            <h5 class="card-title">Scanning Settings</h5>
            
            <form @submit.prevent="saveSettings">
              <div class="mb-4">
                <h6>Automated Scanning</h6>
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="enableScheduledScans"
                    v-model="settings.scanning.automated.enabled"
                  >
                  <label class="form-check-label" for="enableScheduledScans">
                    Enable Scheduled Scans
                  </label>
                </div>
                
                <div v-if="settings.scanning.automated.enabled">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label for="scanFrequency" class="form-label">Scan Frequency</label>
                      <select class="form-select" id="scanFrequency" v-model="settings.scanning.automated.frequency">
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label for="scanTime" class="form-label">Scan Time</label>
                      <input 
                        type="time" 
                        class="form-control" 
                        id="scanTime"
                        v-model="settings.scanning.automated.time"
                      >
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mb-4">
                <h6>Scan Configuration</h6>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="scanTimeout" class="form-label">Scan Timeout (minutes)</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="scanTimeout"
                      v-model="settings.scanning.timeout"
                      min="5"
                      max="1440"
                    >
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="concurrentScans" class="form-label">Concurrent Scans</label>
                    <input 
                      type="number" 
                      class="form-control" 
                      id="concurrentScans"
                      v-model="settings.scanning.concurrentScans"
                      min="1"
                      max="10"
                    >
                  </div>
                </div>
                
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="deepScan"
                    v-model="settings.scanning.deepScan"
                  >
                  <label class="form-check-label" for="deepScan">
                    Enable Deep Scanning (slower but more thorough)
                  </label>
                </div>
                
                <div class="form-check mb-2">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="autoRemediation"
                    v-model="settings.scanning.autoRemediation"
                  >
                  <label class="form-check-label" for="autoRemediation">
                    Enable Automatic Remediation (where possible)
                  </label>
                </div>
              </div>
            </form>
          </div>
        </div>

        <!-- User Management -->
        <div v-if="activeTab === 'users' && canManageUsers" class="card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h5 class="card-title mb-0">Users & Roles</h5>
              <button class="btn btn-primary btn-sm" @click="showAddUserModal = true">
                <i class="bi bi-person-plus me-1"></i>Add User
              </button>
            </div>
            
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Last Login</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in users" :key="user.id">
                    <td>{{ user.name }}</td>
                    <td>{{ user.email }}</td>
                    <td>
                      <span class="badge bg-primary">{{ user.role }}</span>
                    </td>
                    <td>{{ formatDate(user.lastLogin) }}</td>
                    <td>
                      <span 
                        class="badge"
                        :class="user.active ? 'bg-success' : 'bg-secondary'"
                      >
                        {{ user.active ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="Edit">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" title="Delete">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- System Settings -->
        <div v-if="activeTab === 'system' && canManageSystem" class="card">
          <div class="card-body">
            <h5 class="card-title">System Information</h5>
            
            <div class="row">
              <div class="col-md-6">
                <table class="table table-sm">
                  <tr>
                    <td><strong>Version:</strong></td>
                    <td>{{ systemInfo.version }}</td>
                  </tr>
                  <tr>
                    <td><strong>Build:</strong></td>
                    <td>{{ systemInfo.build }}</td>
                  </tr>
                  <tr>
                    <td><strong>Uptime:</strong></td>
                    <td>{{ systemInfo.uptime }}</td>
                  </tr>
                  <tr>
                    <td><strong>Database:</strong></td>
                    <td>{{ systemInfo.database }}</td>
                  </tr>
                </table>
              </div>
              <div class="col-md-6">
                <table class="table table-sm">
                  <tr>
                    <td><strong>CPU Usage:</strong></td>
                    <td>{{ systemInfo.cpuUsage }}%</td>
                  </tr>
                  <tr>
                    <td><strong>Memory Usage:</strong></td>
                    <td>{{ systemInfo.memoryUsage }}%</td>
                  </tr>
                  <tr>
                    <td><strong>Disk Usage:</strong></td>
                    <td>{{ systemInfo.diskUsage }}%</td>
                  </tr>
                  <tr>
                    <td><strong>Active Users:</strong></td>
                    <td>{{ systemInfo.activeUsers }}</td>
                  </tr>
                </table>
              </div>
            </div>
            
            <div class="mt-4">
              <h6>System Actions</h6>
              <div class="btn-group">
                <button class="btn btn-outline-warning">
                  <i class="bi bi-arrow-clockwise me-1"></i>Restart Services
                </button>
                <button class="btn btn-outline-info">
                  <i class="bi bi-download me-1"></i>Download Logs
                </button>
                <button class="btn btn-outline-secondary">
                  <i class="bi bi-shield-check me-1"></i>Run Diagnostics
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="saveMessage" class="toast-container position-fixed bottom-0 end-0 p-3">
      <div class="toast show" role="alert">
        <div class="toast-header">
          <i :class="saveSuccess ? 'bi bi-check-circle text-success' : 'bi bi-exclamation-triangle text-danger'" class="me-2"></i>
          <strong class="me-auto">{{ saveSuccess ? 'Success' : 'Error' }}</strong>
          <button type="button" class="btn-close" @click="saveMessage = ''"></button>
        </div>
        <div class="toast-body">
          {{ saveMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

// Auth store for permissions
const authStore = useAuthStore()
const { isAdmin, canEditSettings } = storeToRefs(authStore)

// Local state
const activeTab = ref('general')
const isSaving = ref(false)
const saveMessage = ref('')
const saveSuccess = ref(false)
const showAddUserModal = ref(false)

// Settings data structure
const settings = ref({
  general: {
    organizationName: 'ACME Corporation',
    timezone: 'Europe/Berlin',
    dateFormat: 'DD/MM/YYYY',
    language: 'en',
    defaultPageSize: 20,
    darkMode: false,
    autoRefresh: true
  },
  security: {
    requireMFA: false,
    sessionTimeout: 60,
    passwordExpiry: 90,
    ipWhitelist: {
      enabled: false,
      addresses: ''
    },
    apiRateLimit: {
      enabled: true,
      limit: 1000
    }
  },
  notifications: {
    email: {
      enabled: false,
      smtpServer: '',
      smtpPort: 587,
      username: '',
      password: '',
      fromEmail: ''
    },
    thresholds: {
      criticalVulns: 1,
      riskScore: 8.0
    },
    types: {
      newVulnerabilities: true,
      riskChanges: true,
      complianceChanges: true,
      systemAlerts: true
    }
  },
  scanning: {
    automated: {
      enabled: true,
      frequency: 'daily',
      time: '02:00'
    },
    timeout: 60,
    concurrentScans: 3,
    deepScan: false,
    autoRemediation: false
  }
})

// Mock user data
const users = ref([
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Admin',
    lastLogin: '2024-01-15T10:30:00Z',
    active: true
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    role: 'Analyst',
    lastLogin: '2024-01-14T14:15:00Z',
    active: true
  }
])

// Mock system info
const systemInfo = ref({
  version: '1.0.0',
  build: '2024.01.15',
  uptime: '15 days, 3 hours',
  database: 'PostgreSQL 14.2',
  cpuUsage: 23,
  memoryUsage: 67,
  diskUsage: 45,
  activeUsers: 12
})

// Computed properties
const canManageUsers = computed(() => isAdmin.value)
const canManageSystem = computed(() => isAdmin.value)

// Methods
const saveSettings = async () => {
  if (!canEditSettings.value) {
    saveMessage.value = 'You do not have permission to edit settings'
    saveSuccess.value = false
    return
  }

  isSaving.value = true
  try {
    // TODO: Implement API call to save settings
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    saveMessage.value = 'Settings saved successfully'
    saveSuccess.value = true
    
    // Hide message after 3 seconds
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)
    
  } catch (error) {
    saveMessage.value = 'Failed to save settings'
    saveSuccess.value = false
  } finally {
    isSaving.value = false
  }
}

const resetToDefaults = () => {
  if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
    // Reset to default values
    settings.value = {
      general: {
        organizationName: '',
        timezone: 'UTC',
        dateFormat: 'DD/MM/YYYY',
        language: 'en',
        defaultPageSize: 20,
        darkMode: false,
        autoRefresh: true
      },
      security: {
        requireMFA: false,
        sessionTimeout: 60,
        passwordExpiry: 90,
        ipWhitelist: {
          enabled: false,
          addresses: ''
        },
        apiRateLimit: {
          enabled: true,
          limit: 1000
        }
      },
      notifications: {
        email: {
          enabled: false,
          smtpServer: '',
          smtpPort: 587,
          username: '',
          password: '',
          fromEmail: ''
        },
        thresholds: {
          criticalVulns: 1,
          riskScore: 8.0
        },
        types: {
          newVulnerabilities: true,
          riskChanges: true,
          complianceChanges: true,
          systemAlerts: true
        }
      },
      scanning: {
        automated: {
          enabled: true,
          frequency: 'daily',
          time: '02:00'
        },
        timeout: 60,
        concurrentScans: 3,
        deepScan: false,
        autoRemediation: false
      }
    }
    
    saveMessage.value = 'Settings reset to defaults'
    saveSuccess.value = true
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)
  }
}

const loadSettings = async () => {
  try {
    // TODO: Implement API call to load settings
    console.log('Loading settings...')
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-view {
  padding: 1rem;
}

.settings-nav .list-group-item {
  cursor: pointer;
  border: none;
  border-radius: 0;
  padding: 0.75rem 1rem;
}

.settings-nav .list-group-item:hover {
  background-color: var(--bs-gray-100);
}

.settings-nav .list-group-item.active {
  background-color: var(--ctem-primary);
  color: white;
  border-color: var(--ctem-primary);
}

.settings-nav .list-group-item.active i {
  color: white;
}

.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border: 1px solid rgba(0, 0, 0, 0.125);
}

.table th {
  border-top: none;
  font-weight: 600;
  color: var(--ctem-dark);
}

.toast-container {
  z-index: 1100;
}

.form-label {
  font-weight: 500;
  color: var(--ctem-dark);
}

.form-check-label {
  font-weight: normal;
}

h6 {
  color: var(--ctem-primary);
  font-weight: 600;
  border-bottom: 1px solid var(--bs-gray-200);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.btn-group-sm > .btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.775rem;
}

@media (max-width: 768px) {
  .settings-nav {
    margin-bottom: 1rem;
  }
  
  .settings-nav .list-group-item {
    text-align: center;
  }
}
</style>