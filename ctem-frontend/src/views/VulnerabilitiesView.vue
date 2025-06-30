<template>
  <div class="vulnerabilities-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Vulnerability Management</h1>
        <p class="text-muted mb-0">Track and manage security vulnerabilities</p>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary" @click="exportVulnerabilities">
          <i class="bi bi-download me-2"></i>Export
        </button>
        <button class="btn btn-primary" @click="scanAssets" :disabled="isLoading">
          <i class="bi bi-arrow-clockwise me-2"></i>Scan All
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card text-white bg-danger">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h4>{{ vulnerabilityStats.critical }}</h4>
                <span>Critical</span>
              </div>
              <i class="bi bi-exclamation-triangle-fill" style="font-size: 2rem;"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-white bg-warning">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h4>{{ vulnerabilityStats.high }}</h4>
                <span>High</span>
              </div>
              <i class="bi bi-exclamation-circle-fill" style="font-size: 2rem;"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-white bg-info">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h4>{{ vulnerabilityStats.medium }}</h4>
                <span>Medium</span>
              </div>
              <i class="bi bi-info-circle-fill" style="font-size: 2rem;"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-white bg-success">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h4>{{ vulnerabilityStats.low }}</h4>
                <span>Low</span>
              </div>
              <i class="bi bi-check-circle-fill" style="font-size: 2rem;"></i>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row">
          <div class="col-md-3">
            <div class="input-group">
              <span class="input-group-text">
                <i class="bi bi-search"></i>
              </span>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Search vulnerabilities..."
                v-model="searchTerm"
                @input="debouncedSearch"
              >
            </div>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedSeverity" @change="applyFilters">
              <option value="">All Severities</option>
              <option v-for="(label, value) in severityLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedStatus" @change="applyFilters">
              <option value="">All Status</option>
              <option v-for="(label, value) in statusLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select" v-model="selectedAsset" @change="applyFilters">
              <option value="">All Assets</option>
              <option v-for="asset in availableAssets" :key="asset.id" :value="asset.id">
                {{ asset.name }}
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-outline-primary w-100" @click="clearAllFilters">
              <i class="bi bi-x-circle"></i> Clear
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Loading vulnerabilities...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-danger" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ error }}
      <button class="btn btn-outline-danger btn-sm ms-2" @click="retryLoad">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </div>

    <!-- Vulnerabilities Table -->
    <div v-else class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Vulnerability</th>
                <th>Asset</th>
                <th>Severity</th>
                <th>CVSS</th>
                <th>Status</th>
                <th>Detected</th>
                <th>Age</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="vulnerabilities.length === 0">
                <td colspan="8" class="text-center py-4 text-muted">
                  <i class="bi bi-shield-check fs-1 d-block mb-2"></i>
                  No vulnerabilities found
                </td>
              </tr>
              <tr v-for="vuln in vulnerabilities" :key="vuln.id" @click="selectVulnerability(vuln)" style="cursor: pointer;">
                <td>
                  <div class="fw-bold">{{ vuln.title }}</div>
                  <div class="text-muted small" v-if="vuln.cveId">{{ vuln.cveId }}</div>
                  <div class="text-muted small">{{ vuln.category }}</div>
                  <div class="mt-1" v-if="vuln.exploitAvailable || vuln.patchAvailable">
                    <span v-if="vuln.exploitAvailable" class="badge bg-danger me-1">Exploit Available</span>
                    <span v-if="vuln.patchAvailable" class="badge bg-success">Patch Available</span>
                  </div>
                </td>
                <td>
                  <div class="fw-bold">{{ getAssetName(vuln.affectedAssets[0]) }}</div>
                  <div class="text-muted small" v-if="vuln.affectedAssets.length > 1">
                    +{{ vuln.affectedAssets.length - 1 }} more assets
                  </div>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="getSeverityClass(vuln.severity)"
                  >
                    {{ severityLabels[vuln.severity] || vuln.severity }}
                  </span>
                </td>
                <td>
                  <div class="fw-bold" :class="getCvssColor(vuln.cvssScore)">{{ vuln.cvssScore }}</div>
                  <div class="progress mt-1" style="height: 4px;">
                    <div 
                      class="progress-bar"
                      :class="getCvssProgressClass(vuln.cvssScore)"
                      :style="{ width: (vuln.cvssScore / 10 * 100) + '%' }"
                    ></div>
                  </div>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="getStatusClass(vuln.status)"
                  >
                    {{ statusLabels[vuln.status] || vuln.status }}
                  </span>
                </td>
                <td>
                  <small>{{ formatDate(vuln.publishedDate) }}</small>
                </td>
                <td>
                  <span class="badge bg-light text-dark">
                    {{ calculateAge(vuln.publishedDate) }} days
                  </span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button 
                      class="btn btn-outline-primary" 
                      title="View Details"
                      @click.stop="viewDetails(vuln)"
                    >
                      <i class="bi bi-eye"></i>
                    </button>
                    <button 
                      class="btn btn-outline-success" 
                      title="Update Status"
                      @click.stop="showStatusModal(vuln)"
                    >
                      <i class="bi bi-tools"></i>
                    </button>
                    <div class="btn-group btn-group-sm">
                      <button 
                        class="btn btn-outline-secondary dropdown-toggle" 
                        data-bs-toggle="dropdown"
                        title="More Actions"
                      >
                        <i class="bi bi-three-dots"></i>
                      </button>
                      <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" @click.stop="updateStatus(vuln.id, 'false_positive')">Mark as False Positive</a></li>
                        <li><a class="dropdown-item" href="#" @click.stop="updateStatus(vuln.id, 'risk_accepted')">Accept Risk</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" @click.stop="viewReferences(vuln)">View References</a></li>
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <nav class="mt-4" v-if="pagination.totalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: pagination.page === 1 }">
          <button 
            class="page-link" 
            @click="changePage(pagination.page - 1)"
            :disabled="pagination.page === 1"
          >
            <span aria-hidden="true">&laquo;</span>
          </button>
        </li>
        
        <li 
          v-for="page in getVisiblePages()" 
          :key="page" 
          class="page-item" 
          :class="{ active: page === pagination.page }"
        >
          <button class="page-link" @click="changePage(page)">{{ page }}</button>
        </li>
        
        <li class="page-item" :class="{ disabled: pagination.page === pagination.totalPages }">
          <button 
            class="page-link" 
            @click="changePage(pagination.page + 1)"
            :disabled="pagination.page === pagination.totalPages"
          >
            <span aria-hidden="true">&raquo;</span>
          </button>
        </li>
      </ul>
    </nav>

    <!-- Status Update Modal -->
    <div class="modal fade" :class="{ show: showStatusUpdateModal }" style="display: block;" v-if="showStatusUpdateModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Update Vulnerability Status</h5>
            <button type="button" class="btn-close" @click="showStatusUpdateModal = false"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Vulnerability:</label>
              <p class="fw-bold">{{ selectedVulnerability?.title }}</p>
            </div>
            <div class="mb-3">
              <label for="statusSelect" class="form-label">New Status</label>
              <select id="statusSelect" class="form-select" v-model="newStatus">
                <option v-for="(label, value) in statusLabels" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showStatusUpdateModal = false">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="confirmStatusUpdate" :disabled="isLoading">
              <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" v-if="showStatusUpdateModal"></div>

    <!-- Vulnerability Details Modal -->
    <div class="modal fade" :class="{ show: showDetailsModal }" style="display: block;" v-if="showDetailsModal">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Vulnerability Details</h5>
            <button type="button" class="btn-close" @click="showDetailsModal = false"></button>
          </div>
          <div class="modal-body" v-if="selectedVulnerability">
            <div class="row">
              <div class="col-md-6">
                <h6>Basic Information</h6>
                <table class="table table-sm">
                  <tr>
                    <td><strong>Title:</strong></td>
                    <td>{{ selectedVulnerability.title }}</td>
                  </tr>
                  <tr v-if="selectedVulnerability.cveId">
                    <td><strong>CVE ID:</strong></td>
                    <td>{{ selectedVulnerability.cveId }}</td>
                  </tr>
                  <tr>
                    <td><strong>Severity:</strong></td>
                    <td>
                      <span class="badge" :class="getSeverityClass(selectedVulnerability.severity)">
                        {{ severityLabels[selectedVulnerability.severity] }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>CVSS Score:</strong></td>
                    <td>{{ selectedVulnerability.cvssScore }}</td>
                  </tr>
                  <tr>
                    <td><strong>Category:</strong></td>
                    <td>{{ selectedVulnerability.category }}</td>
                  </tr>
                </table>
              </div>
              <div class="col-md-6">
                <h6>Status & Dates</h6>
                <table class="table table-sm">
                  <tr>
                    <td><strong>Status:</strong></td>
                    <td>
                      <span class="badge" :class="getStatusClass(selectedVulnerability.status)">
                        {{ statusLabels[selectedVulnerability.status] }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Published:</strong></td>
                    <td>{{ formatDate(selectedVulnerability.publishedDate) }}</td>
                  </tr>
                  <tr>
                    <td><strong>Last Modified:</strong></td>
                    <td>{{ formatDate(selectedVulnerability.lastModifiedDate) }}</td>
                  </tr>
                  <tr>
                    <td><strong>Exploit Available:</strong></td>
                    <td>
                      <span :class="selectedVulnerability.exploitAvailable ? 'text-danger' : 'text-success'">
                        {{ selectedVulnerability.exploitAvailable ? 'Yes' : 'No' }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Patch Available:</strong></td>
                    <td>
                      <span :class="selectedVulnerability.patchAvailable ? 'text-success' : 'text-warning'">
                        {{ selectedVulnerability.patchAvailable ? 'Yes' : 'No' }}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>
            </div>
            
            <div class="mt-3">
              <h6>Description</h6>
              <p>{{ selectedVulnerability.description }}</p>
            </div>

            <div class="mt-3" v-if="selectedVulnerability.solution">
              <h6>Solution</h6>
              <p>{{ selectedVulnerability.solution }}</p>
            </div>

            <div class="mt-3">
              <h6>Affected Assets</h6>
              <div class="d-flex flex-wrap gap-2">
                <span 
                  v-for="assetId in selectedVulnerability.affectedAssets" 
                  :key="assetId"
                  class="badge bg-light text-dark"
                >
                  {{ getAssetName(assetId) }}
                </span>
              </div>
            </div>

            <div class="mt-3" v-if="selectedVulnerability.references.length > 0">
              <h6>References</h6>
              <ul class="list-unstyled">
                <li v-for="ref in selectedVulnerability.references" :key="ref">
                  <a :href="ref" target="_blank" class="text-decoration-none">
                    <i class="bi bi-link-45deg me-1"></i>{{ ref }}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showDetailsModal = false">
              Close
            </button>
            <button type="button" class="btn btn-primary" @click="showStatusModal(selectedVulnerability)">
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" v-if="showDetailsModal"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useVulnerabilitiesStore } from '@/stores/vulnerabilities'
import { useAssetsStore } from '@/stores/assets'
import { storeToRefs } from 'pinia'
import type { Vulnerability } from '@/services/api'

// Stores
const vulnerabilitiesStore = useVulnerabilitiesStore()
const assetsStore = useAssetsStore()

const { 
  vulnerabilities,
  selectedVulnerability,
  isLoading,
  error,
  pagination,
  vulnerabilityStats,
  severityLabels,
  statusLabels,
  getSeverityColor,
  getStatusColor,
  getCvssColor
} = storeToRefs(vulnerabilitiesStore)

const { assets } = storeToRefs(assetsStore)

// Local reactive data
const searchTerm = ref('')
const selectedSeverity = ref('')
const selectedStatus = ref('')
const selectedAsset = ref('')
const showStatusUpdateModal = ref(false)
const showDetailsModal = ref(false)
const newStatus = ref<Vulnerability['status']>('open')

// Computed properties
const availableAssets = computed(() => {
  return assets.value || []
})

// Debounced search
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    applyFilters()
  }, 300)
}

// Methods
const applyFilters = () => {
  vulnerabilitiesStore.setFilters({
    search: searchTerm.value,
    severity: selectedSeverity.value,
    status: selectedStatus.value,
    assetId: selectedAsset.value,
    page: 1
  })
  vulnerabilitiesStore.fetchVulnerabilities()
}

const clearAllFilters = () => {
  searchTerm.value = ''
  selectedSeverity.value = ''
  selectedStatus.value = ''
  selectedAsset.value = ''
  vulnerabilitiesStore.clearFilters()
  vulnerabilitiesStore.fetchVulnerabilities()
}

const changePage = (page: number) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    vulnerabilitiesStore.setFilters({ page })
    vulnerabilitiesStore.fetchVulnerabilities()
  }
}

const getVisiblePages = () => {
  const current = pagination.value.page
  const total = pagination.value.totalPages
  const pages = []
  
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
}

const retryLoad = () => {
  vulnerabilitiesStore.clearError()
  vulnerabilitiesStore.fetchVulnerabilities()
}

const selectVulnerability = (vulnerability: Vulnerability) => {
  vulnerabilitiesStore.setSelectedVulnerability(vulnerability)
}

const viewDetails = (vulnerability: Vulnerability) => {
  vulnerabilitiesStore.setSelectedVulnerability(vulnerability)
  showDetailsModal.value = true
}

const showStatusModal = (vulnerability: Vulnerability) => {
  vulnerabilitiesStore.setSelectedVulnerability(vulnerability)
  newStatus.value = vulnerability.status
  showStatusUpdateModal.value = true
  showDetailsModal.value = false
}

const confirmStatusUpdate = async () => {
  if (!selectedVulnerability.value) return

  try {
    await vulnerabilitiesStore.updateVulnerabilityStatus(selectedVulnerability.value.id, newStatus.value)
    showStatusUpdateModal.value = false
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

const updateStatus = async (vulnerabilityId: string, status: Vulnerability['status']) => {
  try {
    await vulnerabilitiesStore.updateVulnerabilityStatus(vulnerabilityId, status)
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

const exportVulnerabilities = () => {
  // TODO: Implement export functionality
  console.log('Export vulnerabilities')
}

const scanAssets = () => {
  // TODO: Implement asset scanning
  console.log('Scan all assets')
}

const viewReferences = (vulnerability: Vulnerability) => {
  // TODO: Show references in a modal or new tab
  console.log('View references for:', vulnerability.title)
}

// Utility methods
const getSeverityClass = (severity: string) => {
  const classes = {
    critical: 'bg-danger text-white',
    high: 'bg-warning text-dark',
    medium: 'bg-info text-white',
    low: 'bg-success text-white',
    info: 'bg-secondary text-white'
  }
  return classes[severity as keyof typeof classes] || 'bg-secondary text-white'
}

const getStatusClass = (status: string) => {
  const classes = {
    open: 'bg-danger text-white',
    investigating: 'bg-warning text-dark',
    mitigated: 'bg-success text-white',
    false_positive: 'bg-secondary text-white',
    risk_accepted: 'bg-info text-white'
  }
  return classes[status as keyof typeof classes] || 'bg-secondary text-white'
}

const getCvssProgressClass = (score: number) => {
  if (score >= 9.0) return 'bg-danger'
  if (score >= 7.0) return 'bg-warning'
  if (score >= 4.0) return 'bg-info'
  return 'bg-success'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const calculateAge = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const getAssetName = (assetId: string) => {
  const asset = assets.value?.find(a => a.id === assetId)
  return asset?.name || `Asset ${assetId}`
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    vulnerabilitiesStore.fetchVulnerabilities(),
    assetsStore.fetchAssets()
  ])
})

// Watch for filter changes in store
watch(() => vulnerabilitiesStore.filters, (newFilters) => {
  searchTerm.value = newFilters.search
  selectedSeverity.value = newFilters.severity
  selectedStatus.value = newFilters.status
  selectedAsset.value = newFilters.assetId
}, { deep: true })
</script>

<style scoped>
.vulnerabilities-view {
  padding: 1rem;
}

.table tbody tr:hover {
  background-color: var(--bs-gray-50);
}

.progress {
  border-radius: 4px;
}

.modal {
  background: rgba(0, 0, 0, 0.5);
}

.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border: 1px solid rgba(0, 0, 0, 0.125);
}

.badge {
  font-size: 0.75em;
}

.btn-group-sm > .btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.775rem;
}

.severity-critical { background-color: #dc3545; color: white; }
.severity-high { background-color: #fd7e14; color: white; }
.severity-medium { background-color: #0dcaf0; color: white; }
.severity-low { background-color: #198754; color: white; }
.severity-info { background-color: #6c757d; color: white; }
</style>