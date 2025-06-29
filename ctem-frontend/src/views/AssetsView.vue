<template>
  <div class="assets-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Asset Management</h1>
        <p class="text-muted mb-0">Manage and monitor your IT assets</p>
      </div>
      <button class="btn btn-primary" @click="showAddAssetModal = true">
        <i class="bi bi-plus-circle me-2"></i>Add Asset
      </button>
    </div>

    <!-- Asset Statistics -->
    <div class="row mb-4">
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 bg-primary text-white">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-title">Total Assets</h6>
                <h3 class="mb-0">{{ assetStats.total }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-hdd-stack fs-2"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 bg-success text-white">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-title">Active Assets</h6>
                <h3 class="mb-0">{{ assetStats.active }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-check-circle fs-2"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 bg-danger text-white">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-title">Critical Assets</h6>
                <h3 class="mb-0">{{ assetStats.critical }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-exclamation-triangle fs-2"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 bg-warning text-white">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-title">High Risk</h6>
                <h3 class="mb-0">{{ highRiskAssets.length }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-shield-exclamation fs-2"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row">
          <div class="col-md-4">
            <div class="input-group">
              <span class="input-group-text">
                <i class="bi bi-search"></i>
              </span>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Search assets..."
                v-model="searchTerm"
                @input="debouncedSearch"
              >
            </div>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedType" @change="applyFilters">
              <option value="">All Types</option>
              <option v-for="(label, value) in assetTypeLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedStatus" @change="applyFilters">
              <option value="">All Status</option>
              <option v-for="(label, value) in assetStatusLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedCriticality" @change="applyFilters">
              <option value="">All Criticality</option>
              <option v-for="(label, value) in criticalityLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-outline-secondary w-100" @click="clearAllFilters">
              <i class="bi bi-arrow-clockwise me-1"></i> Reset
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
      <p class="mt-2 text-muted">Loading assets...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-danger" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ error }}
      <button class="btn btn-outline-danger btn-sm ms-2" @click="retryLoad">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </div>

    <!-- Assets Table -->
    <div v-else class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Criticality</th>
                <th>IP Address</th>
                <th>Owner</th>
                <th>Risk Score</th>
                <th>Vulnerabilities</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="assets.length === 0">
                <td colspan="10" class="text-center py-4 text-muted">
                  <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                  No assets found
                </td>
              </tr>
              <tr v-for="asset in assets" :key="asset.id" @click="selectAsset(asset)" style="cursor: pointer;">
                <td>
                  <div class="fw-bold">{{ asset.name }}</div>
                  <small class="text-muted">{{ asset.hostname || 'No hostname' }}</small>
                </td>
                <td>
                  <span class="badge bg-light text-dark">
                    {{ assetTypeLabels[asset.type] || asset.type }}
                  </span>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="getStatusClass(asset.status)"
                  >
                    {{ assetStatusLabels[asset.status] || asset.status }}
                  </span>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="getCriticalityClass(asset.criticality)"
                  >
                    {{ criticalityLabels[asset.criticality] || asset.criticality }}
                  </span>
                </td>
                <td>
                  <code v-if="asset.ipAddress">{{ asset.ipAddress }}</code>
                  <span v-else class="text-muted">N/A</span>
                </td>
                <td>{{ asset.owner }}</td>
                <td>
                  <div class="d-flex align-items-center">
                    <div class="progress me-2" style="width: 60px; height: 8px;">
                      <div 
                        class="progress-bar" 
                        :class="getRiskScoreClass(asset.riskScore)"
                        :style="{ width: (asset.riskScore * 10) + '%' }"
                      ></div>
                    </div>
                    <small class="fw-bold">{{ asset.riskScore.toFixed(1) }}</small>
                  </div>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="asset.vulnerabilityCount > 0 ? 'bg-danger' : 'bg-success'"
                  >
                    {{ asset.vulnerabilityCount }}
                  </span>
                </td>
                <td>
                  <small>{{ formatDate(asset.lastSeen) }}</small>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button 
                      class="btn btn-outline-primary" 
                      title="View Details"
                      @click.stop="viewAssetDetails(asset)"
                    >
                      <i class="bi bi-eye"></i>
                    </button>
                    <button 
                      class="btn btn-outline-secondary" 
                      title="Edit"
                      @click.stop="editAsset(asset)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button 
                      class="btn btn-outline-danger" 
                      title="Delete"
                      @click.stop="confirmDeleteAsset(asset)"
                    >
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

    <!-- Add Asset Modal -->
    <div class="modal fade" :class="{ show: showAddAssetModal }" style="display: block;" v-if="showAddAssetModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add New Asset</h5>
            <button type="button" class="btn-close" @click="showAddAssetModal = false"></button>
          </div>
          <div class="modal-body">
            <!-- Add Asset Form would go here -->
            <p class="text-muted">Asset creation form will be implemented here.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showAddAssetModal = false">
              Cancel
            </button>
            <button type="button" class="btn btn-primary">
              Create Asset
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" v-if="showAddAssetModal"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAssetsStore } from '@/stores/assets'
import { storeToRefs } from 'pinia'

// Store
const assetsStore = useAssetsStore()
const { 
  assets, 
  isLoading, 
  error, 
  pagination, 
  assetStats,
  highRiskAssets,
  assetTypeLabels,
  assetStatusLabels,
  criticalityLabels
} = storeToRefs(assetsStore)

// Local reactive data
const searchTerm = ref('')
const selectedType = ref('')
const selectedStatus = ref('')
const selectedCriticality = ref('')
const showAddAssetModal = ref(false)

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
  assetsStore.setFilters({
    search: searchTerm.value,
    type: selectedType.value,
    status: selectedStatus.value,
    criticality: selectedCriticality.value,
    page: 1
  })
  assetsStore.fetchAssets()
}

const clearAllFilters = () => {
  searchTerm.value = ''
  selectedType.value = ''
  selectedStatus.value = ''
  selectedCriticality.value = ''
  assetsStore.clearFilters()
  assetsStore.fetchAssets()
}

const changePage = (page: number) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    assetsStore.setFilters({ page })
    assetsStore.fetchAssets()
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
  assetsStore.clearError()
  assetsStore.fetchAssets()
}

const selectAsset = (asset: any) => {
  assetsStore.setSelectedAsset(asset)
}

const viewAssetDetails = (asset: any) => {
  // Navigate to asset details page
  console.log('View asset details:', asset.id)
}

const editAsset = (asset: any) => {
  // Open edit modal or navigate to edit page
  console.log('Edit asset:', asset.id)
}

const confirmDeleteAsset = (asset: any) => {
  if (confirm(`Are you sure you want to delete asset "${asset.name}"?`)) {
    assetsStore.deleteAsset(asset.id)
  }
}

// Utility methods
const getCriticalityClass = (criticality: string) => {
  const classes = {
    critical: 'bg-danger',
    high: 'bg-warning',
    medium: 'bg-info',
    low: 'bg-success'
  }
  return classes[criticality as keyof typeof classes] || 'bg-secondary'
}

const getStatusClass = (status: string) => {
  const classes = {
    active: 'bg-success',
    inactive: 'bg-secondary',
    maintenance: 'bg-warning'
  }
  return classes[status as keyof typeof classes] || 'bg-secondary'
}

const getRiskScoreClass = (score: number) => {
  if (score >= 8) return 'bg-danger'
  if (score >= 6) return 'bg-warning'
  if (score >= 4) return 'bg-info'
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

// Lifecycle
onMounted(() => {
  assetsStore.fetchAssets()
})

// Watch for filter changes in store
watch(() => assetsStore.filters, (newFilters) => {
  searchTerm.value = newFilters.search
  selectedType.value = newFilters.type
  selectedStatus.value = newFilters.status
  selectedCriticality.value = newFilters.criticality
}, { deep: true })
</script>

<style scoped>
.assets-view {
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
</style>