<template>
  <div class="risks-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Risk Management</h1>
        <p class="text-muted mb-0">Assess and manage security risks</p>
      </div>
      <button class="btn btn-primary" @click="showCreateRiskModal = true">
        <i class="bi bi-plus-circle me-2"></i>New Risk Assessment
      </button>
    </div>

    <!-- Risk Statistics -->
    <div class="row mb-4">
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 bg-danger text-white">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-title">Critical Risks</h6>
                <h3 class="mb-0">{{ riskStats.critical }}</h3>
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
                <h6 class="card-title">High Risks</h6>
                <h3 class="mb-0">{{ riskStats.high }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-shield-exclamation fs-2"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 bg-info text-white">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-title">Medium Risks</h6>
                <h3 class="mb-0">{{ riskStats.medium }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-info-circle fs-2"></i>
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
                <h6 class="card-title">Low Risks</h6>
                <h3 class="mb-0">{{ riskStats.low }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-check-circle fs-2"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Risk Matrix Overview -->
    <div class="row mb-4">
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Risk Matrix</h5>
          </div>
          <div class="card-body">
            <div class="risk-matrix">
              <div class="risk-matrix-header">
                <div class="axis-label">Impact →</div>
                <div class="matrix-cell header">Very Low</div>
                <div class="matrix-cell header">Low</div>
                <div class="matrix-cell header">Medium</div>
                <div class="matrix-cell header">High</div>
                <div class="matrix-cell header">Very High</div>
              </div>
              
              <div class="risk-matrix-row" v-for="(likelihood, index) in likelihoodLevels" :key="likelihood">
                <div class="axis-label" v-if="index === 2">Likelihood ↓</div>
                <div class="matrix-cell row-header">{{ likelihood }}</div>
                <div 
                  v-for="impact in impactLevels" 
                  :key="`${likelihood}-${impact}`"
                  class="matrix-cell"
                  :class="getRiskMatrixClass(likelihood, impact)"
                  @click="filterByRisk(likelihood, impact)"
                >
                  {{ getRiskCount(likelihood, impact) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Risk Distribution</h5>
          </div>
          <div class="card-body">
            <canvas ref="riskChartRef" style="max-height: 250px;"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
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
                placeholder="Search risks..."
                v-model="searchTerm"
                @input="debouncedSearch"
              >
            </div>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedCategory" @change="applyFilters">
              <option value="">All Categories</option>
              <option value="technical">Technical</option>
              <option value="operational">Operational</option>
              <option value="compliance">Compliance</option>
              <option value="strategic">Strategic</option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedStatus" @change="applyFilters">
              <option value="">All Status</option>
              <option value="identified">Identified</option>
              <option value="assessed">Assessed</option>
              <option value="mitigating">Mitigating</option>
              <option value="mitigated">Mitigated</option>
              <option value="accepted">Accepted</option>
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select" v-model="selectedOwner" @change="applyFilters">
              <option value="">All Owners</option>
              <option v-for="owner in uniqueOwners" :key="owner" :value="owner">
                {{ owner }}
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
      <p class="mt-2 text-muted">Loading risks...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-danger" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ error }}
      <button class="btn btn-outline-danger btn-sm ms-2" @click="retryLoad">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </div>

    <!-- Risks Table -->
    <div v-else class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Risk</th>
                <th>Category</th>
                <th>Likelihood</th>
                <th>Impact</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="risks.length === 0">
                <td colspan="9" class="text-center py-4 text-muted">
                  <i class="bi bi-shield-check fs-1 d-block mb-2"></i>
                  No risks found
                </td>
              </tr>
              <tr v-for="risk in risks" :key="risk.id" @click="selectRisk(risk)" style="cursor: pointer;">
                <td>
                  <div class="fw-bold">{{ risk.title }}</div>
                  <div class="text-muted small">{{ truncateText(risk.description, 60) }}</div>
                </td>
                <td>
                  <span class="badge" :class="getCategoryClass(risk.category)">
                    {{ formatCategory(risk.category) }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="getLikelihoodClass(risk.likelihood)">
                    {{ formatLikelihood(risk.likelihood) }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="getImpactClass(risk.impact)">
                    {{ formatImpact(risk.impact) }}
                  </span>
                </td>
                <td>
                  <div class="d-flex align-items-center">
                    <div class="progress me-2" style="width: 60px; height: 8px;">
                      <div 
                        class="progress-bar" 
                        :class="getRiskScoreClass(risk.riskScore)"
                        :style="{ width: (risk.riskScore * 10) + '%' }"
                      ></div>
                    </div>
                    <small class="fw-bold">{{ risk.riskScore.toFixed(1) }}</small>
                  </div>
                </td>
                <td>
                  <span class="badge" :class="getStatusClass(risk.status)">
                    {{ formatStatus(risk.status) }}
                  </span>
                </td>
                <td>{{ risk.owner }}</td>
                <td>
                  <small v-if="risk.dueDate" :class="getDueDateClass(risk.dueDate)">
                    {{ formatDate(risk.dueDate) }}
                  </small>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button 
                      class="btn btn-outline-primary" 
                      title="View Details"
                      @click.stop="viewRiskDetails(risk)"
                    >
                      <i class="bi bi-eye"></i>
                    </button>
                    <button 
                      class="btn btn-outline-secondary" 
                      title="Edit"
                      @click.stop="editRisk(risk)"
                    >
                      <i class="bi bi-pencil"></i>
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
                        <li><a class="dropdown-item" href="#" @click.stop="updateRiskStatus(risk.id, 'mitigating')">Start Mitigation</a></li>
                        <li><a class="dropdown-item" href="#" @click.stop="updateRiskStatus(risk.id, 'accepted')">Accept Risk</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" @click.stop="deleteRisk(risk)">Delete</a></li>
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

    <!-- Create Risk Modal -->
    <div class="modal fade" :class="{ show: showCreateRiskModal }" style="display: block;" v-if="showCreateRiskModal">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create New Risk</h5>
            <button type="button" class="btn-close" @click="showCreateRiskModal = false"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="createRisk">
              <div class="row">
                <div class="col-md-12 mb-3">
                  <label for="riskTitle" class="form-label">Title <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control" 
                    id="riskTitle"
                    v-model="newRisk.title"
                    required
                  >
                </div>
              </div>
              
              <div class="row">
                <div class="col-md-12 mb-3">
                  <label for="riskDescription" class="form-label">Description <span class="text-danger">*</span></label>
                  <textarea 
                    class="form-control" 
                    id="riskDescription"
                    rows="3"
                    v-model="newRisk.description"
                    required
                  ></textarea>
                </div>
              </div>
              
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="riskCategory" class="form-label">Category <span class="text-danger">*</span></label>
                  <select class="form-select" id="riskCategory" v-model="newRisk.category" required>
                    <option value="">Select Category</option>
                    <option value="technical">Technical</option>
                    <option value="operational">Operational</option>
                    <option value="compliance">Compliance</option>
                    <option value="strategic">Strategic</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="riskOwner" class="form-label">Owner <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control" 
                    id="riskOwner"
                    v-model="newRisk.owner"
                    required
                  >
                </div>
              </div>
              
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="riskLikelihood" class="form-label">Likelihood <span class="text-danger">*</span></label>
                  <select class="form-select" id="riskLikelihood" v-model="newRisk.likelihood" required>
                    <option value="">Select Likelihood</option>
                    <option value="very_low">Very Low</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="very_high">Very High</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="riskImpact" class="form-label">Impact <span class="text-danger">*</span></label>
                  <select class="form-select" id="riskImpact" v-model="newRisk.impact" required>
                    <option value="">Select Impact</option>
                    <option value="very_low">Very Low</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="very_high">Very High</option>
                  </select>
                </div>
              </div>
              
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="riskDueDate" class="form-label">Due Date</label>
                  <input 
                    type="date" 
                    class="form-control" 
                    id="riskDueDate"
                    v-model="newRisk.dueDate"
                  >
                </div>
                <div class="col-md-6 mb-3">
                  <label for="riskStatus" class="form-label">Status</label>
                  <select class="form-select" id="riskStatus" v-model="newRisk.status">
                    <option value="identified">Identified</option>
                    <option value="assessed">Assessed</option>
                    <option value="mitigating">Mitigating</option>
                    <option value="mitigated">Mitigated</option>
                    <option value="accepted">Accepted</option>
                  </select>
                </div>
              </div>
              
              <div class="row">
                <div class="col-md-12 mb-3">
                  <label for="mitigationPlan" class="form-label">Mitigation Plan</label>
                  <textarea 
                    class="form-control" 
                    id="mitigationPlan"
                    rows="3"
                    v-model="newRisk.mitigationPlan"
                    placeholder="Describe the mitigation plan..."
                  ></textarea>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showCreateRiskModal = false">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="createRisk" :disabled="isLoading">
              <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
              Create Risk
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" v-if="showCreateRiskModal"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { Risk } from '@/services/api'

// Mock store for now - replace with actual store when implemented
const mockRisksStore = {
  risks: ref<Risk[]>([
    {
      id: '1',
      title: 'SQL Injection Vulnerabilities',
      description: 'Multiple SQL injection vulnerabilities detected in web applications',
      category: 'technical' as const,
      likelihood: 'high' as const,
      impact: 'high' as const,
      riskScore: 8.5,
      status: 'identified' as const,
      owner: 'John Doe',
      dueDate: '2024-02-15',
      relatedAssets: ['web-server-01'],
      relatedVulnerabilities: ['vuln-001'],
      mitigationPlan: 'Implement input validation and parameterized queries'
    },
    {
      id: '2',
      title: 'Outdated Security Patches',
      description: 'Critical security patches not applied to production servers',
      category: 'operational' as const,
      likelihood: 'medium' as const,
      impact: 'high' as const,
      riskScore: 7.2,
      status: 'mitigating' as const,
      owner: 'Jane Smith',
      dueDate: '2024-01-30',
      relatedAssets: ['server-01', 'server-02'],
      relatedVulnerabilities: [],
      mitigationPlan: 'Schedule maintenance window for patch deployment'
    }
  ]),
  isLoading: ref(false),
  error: ref<string | null>(null),
  pagination: ref({
    page: 1,
    totalPages: 1,
    total: 2,
    limit: 20
  })
}

// Using mock data - replace with actual store
const { risks, isLoading, error, pagination } = storeToRefs(mockRisksStore)

// Local reactive data
const searchTerm = ref('')
const selectedCategory = ref('')
const selectedStatus = ref('')
const selectedOwner = ref('')
const showCreateRiskModal = ref(false)
const riskChartRef = ref<HTMLCanvasElement>()

const newRisk = ref<Partial<Risk>>({
  title: '',
  description: '',
  category: 'technical',
  likelihood: 'medium',
  impact: 'medium',
  status: 'identified',
  owner: '',
  dueDate: '',
  mitigationPlan: '',
  relatedAssets: [],
  relatedVulnerabilities: []
})

// Computed properties
const riskStats = computed(() => {
  const stats = { critical: 0, high: 0, medium: 0, low: 0 }
  risks.value.forEach(risk => {
    if (risk.riskScore >= 8) stats.critical++
    else if (risk.riskScore >= 6) stats.high++
    else if (risk.riskScore >= 4) stats.medium++
    else stats.low++
  })
  return stats
})

const uniqueOwners = computed(() => {
  return [...new Set(risks.value.map(risk => risk.owner))]
})

const likelihoodLevels = ['Very High', 'High', 'Medium', 'Low', 'Very Low']
const impactLevels = ['Very Low', 'Low', 'Medium', 'High', 'Very High']

// Risk matrix methods
const getRiskCount = (likelihood: string, impact: string) => {
  return risks.value.filter(risk => 
    formatLikelihood(risk.likelihood) === likelihood && 
    formatImpact(risk.impact) === impact
  ).length
}

const getRiskMatrixClass = (likelihood: string, impact: string) => {
  const score = calculateMatrixScore(likelihood, impact)
  if (score >= 16) return 'risk-critical'
  if (score >= 12) return 'risk-high'
  if (score >= 6) return 'risk-medium'
  return 'risk-low'
}

const calculateMatrixScore = (likelihood: string, impact: string) => {
  const likelihoodScore = likelihoodLevels.indexOf(likelihood) + 1
  const impactScore = impactLevels.indexOf(impact) + 1
  return likelihoodScore * impactScore
}

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
  // TODO: Implement filtering logic with store
  console.log('Apply filters:', { searchTerm: searchTerm.value, selectedCategory: selectedCategory.value })
}

const clearAllFilters = () => {
  searchTerm.value = ''
  selectedCategory.value = ''
  selectedStatus.value = ''
  selectedOwner.value = ''
  applyFilters()
}

const changePage = (page: number) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    // TODO: Implement pagination with store
    console.log('Change page to:', page)
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
  // TODO: Implement retry logic
  console.log('Retry loading risks')
}

const selectRisk = (risk: Risk) => {
  console.log('Select risk:', risk.title)
}

const viewRiskDetails = (risk: Risk) => {
  console.log('View risk details:', risk.title)
}

const editRisk = (risk: Risk) => {
  console.log('Edit risk:', risk.title)
}

const updateRiskStatus = (riskId: string, status: Risk['status']) => {
  console.log('Update risk status:', riskId, status)
}

const deleteRisk = (risk: Risk) => {
  if (confirm(`Are you sure you want to delete risk "${risk.title}"?`)) {
    console.log('Delete risk:', risk.id)
  }
}

const filterByRisk = (likelihood: string, impact: string) => {
  console.log('Filter by risk matrix cell:', likelihood, impact)
}

const createRisk = () => {
  console.log('Create new risk:', newRisk.value)
  showCreateRiskModal.value = false
  // Reset form
  newRisk.value = {
    title: '',
    description: '',
    category: 'technical',
    likelihood: 'medium',
    impact: 'medium',
    status: 'identified',
    owner: '',
    dueDate: '',
    mitigationPlan: '',
    relatedAssets: [],
    relatedVulnerabilities: []
  }
}

// Utility methods
const getCategoryClass = (category: string) => {
  const classes = {
    technical: 'bg-primary',
    operational: 'bg-warning',
    compliance: 'bg-info',
    strategic: 'bg-secondary'
  }
  return classes[category as keyof typeof classes] || 'bg-secondary'
}

const getLikelihoodClass = (likelihood: string) => {
  const classes = {
    very_low: 'bg-success',
    low: 'bg-info',
    medium: 'bg-warning',
    high: 'bg-danger',
    very_high: 'bg-danger'
  }
  return classes[likelihood as keyof typeof classes] || 'bg-secondary'
}

const getImpactClass = (impact: string) => {
  const classes = {
    very_low: 'bg-success',
    low: 'bg-info',
    medium: 'bg-warning',
    high: 'bg-danger',
    very_high: 'bg-danger'
  }
  return classes[impact as keyof typeof classes] || 'bg-secondary'
}

const getStatusClass = (status: string) => {
  const classes = {
    identified: 'bg-danger',
    assessed: 'bg-warning',
    mitigating: 'bg-info',
    mitigated: 'bg-success',
    accepted: 'bg-secondary'
  }
  return classes[status as keyof typeof classes] || 'bg-secondary'
}

const getRiskScoreClass = (score: number) => {
  if (score >= 8) return 'bg-danger'
  if (score >= 6) return 'bg-warning'
  if (score >= 4) return 'bg-info'
  return 'bg-success'
}

const getDueDateClass = (dueDate: string) => {
  const date = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'text-danger' // Overdue
  if (diffDays <= 7) return 'text-warning' // Due soon
  return 'text-success' // On track
}

const formatCategory = (category: string) => {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

const formatLikelihood = (likelihood: string) => {
  return likelihood.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

const formatImpact = (impact: string) => {
  return impact.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Lifecycle
onMounted(() => {
  // TODO: Load risks from store
  console.log('Risks view mounted')
})
</script>

<style scoped>
.risks-view {
  padding: 1rem;
}

.risk-matrix {
  display: grid;
  grid-template-columns: auto repeat(5, 1fr);
  gap: 2px;
  max-width: 600px;
  margin: 0 auto;
}

.risk-matrix-header {
  display: contents;
}

.risk-matrix-row {
  display: contents;
}

.matrix-cell {
  padding: 8px;
  text-align: center;
  border: 1px solid #dee2e6;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.matrix-cell:hover {
  opacity: 0.8;
}

.matrix-cell.header {
  background-color: #f8f9fa;
  font-weight: bold;
  cursor: default;
}

.matrix-cell.row-header {
  background-color: #f8f9fa;
  font-weight: bold;
  cursor: default;
}

.axis-label {
  padding: 8px;
  font-weight: bold;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.risk-critical {
  background-color: #dc3545;
  color: white;
}

.risk-high {
  background-color: #fd7e14;
  color: white;
}

.risk-medium {
  background-color: #ffc107;
  color: black;
}

.risk-low {
  background-color: #198754;
  color: white;
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