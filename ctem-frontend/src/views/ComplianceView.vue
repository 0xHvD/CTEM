<template>
  <div class="compliance-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Compliance Management</h1>
        <p class="text-muted mb-0">Monitor compliance with security frameworks</p>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary" @click="refreshCompliance">
          <i class="bi bi-arrow-clockwise me-2"></i>Refresh
        </button>
        <button class="btn btn-primary" @click="showAddFrameworkModal = true">
          <i class="bi bi-plus-circle me-2"></i>Add Framework
        </button>
      </div>
    </div>

    <!-- Overall Compliance Score -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card bg-gradient-primary text-white">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-md-8">
                <h2 class="mb-1">Overall Compliance Score</h2>
                <p class="mb-0 opacity-75">Weighted average across all active frameworks</p>
              </div>
              <div class="col-md-4 text-center">
                <div class="position-relative d-inline-flex">
                  <svg width="120" height="120" class="compliance-circle">
                    <circle 
                      cx="60" 
                      cy="60" 
                      r="50" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.3)" 
                      stroke-width="8"
                    />
                    <circle 
                      cx="60" 
                      cy="60" 
                      r="50" 
                      fill="none" 
                      stroke="white" 
                      stroke-width="8"
                      stroke-dasharray="314"
                      :stroke-dashoffset="314 - (314 * overallScore / 100)"
                      stroke-linecap="round"
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div class="position-absolute top-50 start-50 translate-middle text-center">
                    <div class="h2 mb-0">{{ overallScore }}%</div>
                    <small>{{ getComplianceLevel(overallScore).text }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Framework Cards -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Compliance Frameworks</h5>
          </div>
          <div class="card-body p-0">
            <div class="row g-0">
              <div 
                v-for="framework in frameworks" 
                :key="framework.id"
                class="col-lg-4 col-md-6"
              >
                <div class="card-body border-end border-bottom h-100">
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h6 class="fw-bold">{{ framework.name }}</h6>
                      <small class="text-muted">{{ framework.version }}</small>
                    </div>
                    <span 
                      class="badge"
                      :class="`bg-${getComplianceLevel(framework.score).color}`"
                    >
                      {{ framework.score }}%
                    </span>
                  </div>
                  
                  <div class="progress mb-3" style="height: 8px;">
                    <div 
                      class="progress-bar"
                      :class="`bg-${getComplianceLevel(framework.score).color}`"
                      :style="{ width: framework.score + '%' }"
                    ></div>
                  </div>
                  
                  <div class="row text-center">
                    <div class="col-4">
                      <div class="fw-bold text-success">{{ framework.controls.implemented }}</div>
                      <small class="text-muted">Implemented</small>
                    </div>
                    <div class="col-4">
                      <div class="fw-bold text-warning">{{ framework.controls.partial }}</div>
                      <small class="text-muted">Partial</small>
                    </div>
                    <div class="col-4">
                      <div class="fw-bold text-danger">{{ framework.controls.missing }}</div>
                      <small class="text-muted">Missing</small>
                    </div>
                  </div>
                  
                  <div class="mt-3">
                    <button 
                      class="btn btn-outline-primary btn-sm me-2"
                      @click="viewFrameworkDetails(framework)"
                    >
                      <i class="bi bi-eye me-1"></i>Details
                    </button>
                    <button 
                      class="btn btn-outline-secondary btn-sm"
                      @click="generateFrameworkReport(framework)"
                    >
                      <i class="bi bi-file-earmark me-1"></i>Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compliance Gaps and Recommendations -->
    <div class="row mb-4">
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">Top Compliance Gaps</h5>
            <select class="form-select form-select-sm w-auto" v-model="selectedFrameworkFilter">
              <option value="">All Frameworks</option>
              <option v-for="framework in frameworks" :key="framework.id" :value="framework.id">
                {{ framework.name }}
              </option>
            </select>
          </div>
          <div class="card-body">
            <div v-if="filteredGaps.length === 0" class="text-center text-muted py-4">
              <i class="bi bi-check-circle fs-1 d-block mb-2"></i>
              No compliance gaps found
            </div>
            <div v-else>
              <div 
                v-for="gap in filteredGaps" 
                :key="gap.id"
                class="d-flex align-items-start mb-3 pb-3 border-bottom"
              >
                <div class="me-3">
                  <span 
                    class="badge rounded-pill"
                    :class="`bg-${getSeverityColor(gap.severity)}`"
                  >
                    {{ gap.severity }}
                  </span>
                </div>
                <div class="flex-grow-1">
                  <h6 class="mb-1">{{ gap.control }}</h6>
                  <p class="text-muted small mb-2">{{ gap.description }}</p>
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">{{ gap.framework }}</small>
                    <button 
                      class="btn btn-outline-primary btn-sm"
                      @click="viewGapDetails(gap)"
                    >
                      Fix
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header">
            <h5 class="card-title mb-0">Recent Assessments</h5>
          </div>
          <div class="card-body">
            <div v-if="recentAssessments.length === 0" class="text-center text-muted py-4">
              <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
              No recent assessments
            </div>
            <div v-else>
              <div 
                v-for="assessment in recentAssessments" 
                :key="assessment.id"
                class="d-flex align-items-center mb-3 pb-3 border-bottom"
              >
                <div class="me-3">
                  <i class="bi bi-file-earmark-check fs-4 text-primary"></i>
                </div>
                <div class="flex-grow-1">
                  <h6 class="mb-1">{{ assessment.framework }}</h6>
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">{{ formatDate(assessment.date) }}</small>
                    <span 
                      class="badge"
                      :class="`bg-${getComplianceLevel(assessment.score).color}`"
                    >
                      {{ assessment.score }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Control Implementation Status -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">Control Implementation Status</h5>
            <div class="d-flex gap-2">
              <select class="form-select form-select-sm" v-model="selectedFramework">
                <option value="">All Frameworks</option>
                <option v-for="framework in frameworks" :key="framework.id" :value="framework.id">
                  {{ framework.name }}
                </option>
              </select>
              <select class="form-select form-select-sm" v-model="selectedStatus">
                <option value="">All Status</option>
                <option value="implemented">Implemented</option>
                <option value="partial">Partial</option>
                <option value="missing">Not Implemented</option>
              </select>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Control ID</th>
                    <th>Framework</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Last Assessed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="filteredControls.length === 0">
                    <td colspan="7" class="text-center py-4 text-muted">
                      <i class="bi bi-list-ul fs-1 d-block mb-2"></i>
                      No controls found
                    </td>
                  </tr>
                  <tr v-for="control in filteredControls" :key="control.id">
                    <td>
                      <code>{{ control.controlId }}</code>
                    </td>
                    <td>
                      <span class="badge bg-light text-dark">{{ control.framework }}</span>
                    </td>
                    <td>
                      <div class="fw-bold">{{ control.title }}</div>
                      <div class="text-muted small">{{ truncateText(control.description, 60) }}</div>
                    </td>
                    <td>{{ control.category }}</td>
                    <td>
                      <span 
                        class="badge"
                        :class="getControlStatusClass(control.status)"
                      >
                        {{ formatControlStatus(control.status) }}
                      </span>
                    </td>
                    <td>
                      <small>{{ formatDate(control.lastAssessed) }}</small>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button 
                          class="btn btn-outline-primary" 
                          title="View Details"
                          @click="viewControlDetails(control)"
                        >
                          <i class="bi bi-eye"></i>
                        </button>
                        <button 
                          class="btn btn-outline-secondary" 
                          title="Assess"
                          @click="assessControl(control)"
                        >
                          <i class="bi bi-check-square"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Framework Modal -->
    <div class="modal fade" :class="{ show: showAddFrameworkModal }" style="display: block;" v-if="showAddFrameworkModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add Compliance Framework</h5>
            <button type="button" class="btn-close" @click="showAddFrameworkModal = false"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="addFramework">
              <div class="mb-3">
                <label for="frameworkSelect" class="form-label">Framework</label>
                <select class="form-select" id="frameworkSelect" v-model="newFramework.type" required>
                  <option value="">Select Framework</option>
                  <option value="ISO27001">ISO 27001</option>
                  <option value="NIST">NIST Cybersecurity Framework</option>
                  <option value="SOC2">SOC 2</option>
                  <option value="PCI-DSS">PCI DSS</option>
                  <option value="GDPR">GDPR</option>
                  <option value="HIPAA">HIPAA</option>
                </select>
              </div>
              <div class="mb-3">
                <label for="frameworkVersion" class="form-label">Version</label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="frameworkVersion"
                  v-model="newFramework.version"
                  placeholder="e.g., 2022"
                >
              </div>
              <div class="mb-3">
                <label for="frameworkDescription" class="form-label">Description</label>
                <textarea 
                  class="form-control" 
                  id="frameworkDescription"
                  rows="3"
                  v-model="newFramework.description"
                  placeholder="Optional description..."
                ></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showAddFrameworkModal = false">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="addFramework" :disabled="isLoading">
              <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
              Add Framework
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" v-if="showAddFrameworkModal"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Interfaces
interface ComplianceFramework {
  id: string
  name: string
  version: string
  score: number
  controls: {
    total: number
    implemented: number
    partial: number
    missing: number
  }
  lastAssessed: string
  status: 'active' | 'inactive'
}

interface ComplianceGap {
  id: string
  framework: string
  control: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  recommendation: string
}

interface ComplianceControl {
  id: string
  controlId: string
  framework: string
  title: string
  description: string
  category: string
  status: 'implemented' | 'partial' | 'missing'
  lastAssessed: string
  evidence?: string[]
}

interface Assessment {
  id: string
  framework: string
  score: number
  date: string
  assessor: string
}

// Mock data - replace with actual API calls
const frameworks = ref<ComplianceFramework[]>([
  {
    id: '1',
    name: 'ISO 27001',
    version: '2022',
    score: 87,
    controls: { total: 114, implemented: 92, partial: 15, missing: 7 },
    lastAssessed: '2024-01-15',
    status: 'active'
  },
  {
    id: '2',
    name: 'NIST CSF',
    version: '1.1',
    score: 78,
    controls: { total: 108, implemented: 78, partial: 18, missing: 12 },
    lastAssessed: '2024-01-10',
    status: 'active'
  },
  {
    id: '3',
    name: 'SOC 2',
    version: '2017',
    score: 92,
    controls: { total: 64, implemented: 58, partial: 4, missing: 2 },
    lastAssessed: '2024-01-20',
    status: 'active'
  }
])

const complianceGaps = ref<ComplianceGap[]>([
  {
    id: '1',
    framework: 'ISO 27001',
    control: 'A.12.6.1 - Management of technical vulnerabilities',
    description: 'Vulnerability scanning process not fully documented',
    severity: 'high',
    recommendation: 'Document and implement formal vulnerability management process'
  },
  {
    id: '2',
    framework: 'NIST CSF',
    control: 'PR.AC-1 - Identity and credentials management',
    description: 'Multi-factor authentication not enabled for all users',
    severity: 'critical',
    recommendation: 'Enable MFA for all user accounts'
  }
])

const controls = ref<ComplianceControl[]>([
  {
    id: '1',
    controlId: 'A.12.6.1',
    framework: 'ISO 27001',
    title: 'Management of technical vulnerabilities',
    description: 'Information about technical vulnerabilities...',
    category: 'Operations Security',
    status: 'partial',
    lastAssessed: '2024-01-15'
  },
  {
    id: '2',
    controlId: 'PR.AC-1',
    framework: 'NIST CSF',
    title: 'Identities and credentials are issued, managed, verified...',
    description: 'Identity and credential management processes...',
    category: 'Access Control',
    status: 'missing',
    lastAssessed: '2024-01-10'
  }
])

const recentAssessments = ref<Assessment[]>([
  {
    id: '1',
    framework: 'ISO 27001',
    score: 87,
    date: '2024-01-15',
    assessor: 'John Doe'
  },
  {
    id: '2',
    framework: 'SOC 2',
    score: 92,
    date: '2024-01-20',
    assessor: 'Jane Smith'
  }
])

// Local state
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedFramework = ref('')
const selectedFrameworkFilter = ref('')
const selectedStatus = ref('')
const showAddFrameworkModal = ref(false)

const newFramework = ref({
  type: '',
  version: '',
  description: ''
})

// Computed properties
const overallScore = computed(() => {
  if (frameworks.value.length === 0) return 0
  const total = frameworks.value.reduce((sum, framework) => sum + framework.score, 0)
  return Math.round(total / frameworks.value.length)
})

const filteredGaps = computed(() => {
  if (!selectedFrameworkFilter.value) return complianceGaps.value
  return complianceGaps.value.filter(gap => 
    gap.framework.toLowerCase().includes(selectedFrameworkFilter.value.toLowerCase())
  )
})

const filteredControls = computed(() => {
  let filtered = [...controls.value]
  
  if (selectedFramework.value) {
    const framework = frameworks.value.find(f => f.id === selectedFramework.value)
    if (framework) {
      filtered = filtered.filter(control => control.framework === framework.name)
    }
  }
  
  if (selectedStatus.value) {
    filtered = filtered.filter(control => control.status === selectedStatus.value)
  }
  
  return filtered
})

// Methods
const refreshCompliance = async () => {
  isLoading.value = true
  try {
    // TODO: Implement API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Compliance data refreshed')
  } catch (err) {
    error.value = 'Failed to refresh compliance data'
  } finally {
    isLoading.value = false
  }
}

const addFramework = () => {
  if (!newFramework.value.type) return
  
  const framework: ComplianceFramework = {
    id: Date.now().toString(),
    name: newFramework.value.type,
    version: newFramework.value.version || '1.0',
    score: 0,
    controls: { total: 0, implemented: 0, partial: 0, missing: 0 },
    lastAssessed: new Date().toISOString(),
    status: 'active'
  }
  
  frameworks.value.push(framework)
  showAddFrameworkModal.value = false
  
  // Reset form
  newFramework.value = { type: '', version: '', description: '' }
}

const viewFrameworkDetails = (framework: ComplianceFramework) => {
  console.log('View framework details:', framework.name)
}

const generateFrameworkReport = (framework: ComplianceFramework) => {
  console.log('Generate report for:', framework.name)
}

const viewGapDetails = (gap: ComplianceGap) => {
  console.log('View gap details:', gap.control)
}

const viewControlDetails = (control: ComplianceControl) => {
  console.log('View control details:', control.controlId)
}

const assessControl = (control: ComplianceControl) => {
  console.log('Assess control:', control.controlId)
}

// Utility functions
const getComplianceLevel = (score: number) => {
  if (score >= 90) return { level: 'excellent', color: 'success', text: 'Excellent' }
  if (score >= 75) return { level: 'good', color: 'info', text: 'Good' }
  if (score >= 60) return { level: 'fair', color: 'warning', text: 'Needs Improvement' }
  return { level: 'poor', color: 'danger', text: 'Poor' }
}

const getSeverityColor = (severity: string) => {
  const colors = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'success'
  }
  return colors[severity as keyof typeof colors] || 'secondary'
}

const getControlStatusClass = (status: string) => {
  const classes = {
    implemented: 'bg-success',
    partial: 'bg-warning',
    missing: 'bg-danger'
  }
  return classes[status as keyof typeof classes] || 'bg-secondary'
}

const formatControlStatus = (status: string) => {
  const labels = {
    implemented: 'Implemented',
    partial: 'Partial',
    missing: 'Not Implemented'
  }
  return labels[status as keyof typeof labels] || status
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
  refreshCompliance()
})
</script>

<style scoped>
.compliance-view {
  padding: 1rem;
}

.bg-gradient-primary {
  background: linear-gradient(135deg, var(--ctem-primary) 0%, #3b82f6 100%);
}

.compliance-circle {
  transform: rotate(-90deg);
}

.card-body.border-end:last-child {
  border-right: none !important;
}

.table tbody tr:hover {
  background-color: var(--bs-gray-50);
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

@media (max-width: 768px) {
  .card-body.border-end {
    border-right: none !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.125) !important;
  }
  
  .compliance-circle {
    width: 100px;
    height: 100px;
  }
  
  .position-absolute .h2 {
    font-size: 1.5rem;
  }
}
</style>