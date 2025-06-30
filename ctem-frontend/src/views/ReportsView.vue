<template>
  <div class="reports-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Reports & Analytics</h1>
        <p class="text-muted mb-0">Generate security reports and analytics</p>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary" @click="refreshReports">
          <i class="bi bi-arrow-clockwise me-2"></i>Refresh
        </button>
        <button class="btn btn-primary" @click="showCreateReportModal = true">
          <i class="bi bi-file-earmark-plus me-2"></i>New Report
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="row mb-4">
      <div class="col-lg-3 col-md-6 mb-3">
        <div class="card border-0 bg-primary text-white">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-title">Total Reports</h6>
                <h3 class="mb-0">{{ reportStats.total }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-file-earmark-text fs-2"></i>
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
                <h6 class="card-title">Completed</h6>
                <h3 class="mb-0">{{ reportStats.completed }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-check-circle fs-2"></i>
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
                <h6 class="card-title">In Progress</h6>
                <h3 class="mb-0">{{ reportStats.inProgress }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-clock fs-2"></i>
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
                <h6 class="card-title">Scheduled</h6>
                <h3 class="mb-0">{{ reportStats.scheduled }}</h3>
              </div>
              <div class="align-self-center">
                <i class="bi bi-calendar-event fs-2"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Report Templates -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Quick Report Templates</h5>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-lg-3 col-md-6 mb-3">
                <div class="card h-100 border-2 report-template" @click="generateQuickReport('vulnerabilities')">
                  <div class="card-body text-center">
                    <i class="bi bi-shield-exclamation text-danger fs-1 mb-3"></i>
                    <h6 class="card-title">Vulnerability Report</h6>
                    <p class="card-text small text-muted">Comprehensive vulnerability assessment and analysis</p>
                  </div>
                </div>
              </div>
              <div class="col-lg-3 col-md-6 mb-3">
                <div class="card h-100 border-2 report-template" @click="generateQuickReport('assets')">
                  <div class="card-body text-center">
                    <i class="bi bi-hdd-stack text-primary fs-1 mb-3"></i>
                    <h6 class="card-title">Asset Inventory</h6>
                    <p class="card-text small text-muted">Complete asset inventory and status report</p>
                  </div>
                </div>
              </div>
              <div class="col-lg-3 col-md-6 mb-3">
                <div class="card h-100 border-2 report-template" @click="generateQuickReport('risks')">
                  <div class="card-body text-center">
                    <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
                    <h6 class="card-title">Risk Assessment</h6>
                    <p class="card-text small text-muted">Risk analysis and mitigation status</p>
                  </div>
                </div>
              </div>
              <div class="col-lg-3 col-md-6 mb-3">
                <div class="card h-100 border-2 report-template" @click="generateQuickReport('compliance')">
                  <div class="card-body text-center">
                    <i class="bi bi-check2-square text-success fs-1 mb-3"></i>
                    <h6 class="card-title">Compliance Report</h6>
                    <p class="card-text small text-muted">Compliance framework status and gaps</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reports Table -->
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="card-title mb-0">Recent Reports</h5>
        <div class="d-flex gap-2">
          <select class="form-select form-select-sm" v-model="selectedType" @change="filterReports">
            <option value="">All Types</option>
            <option value="vulnerabilities">Vulnerabilities</option>
            <option value="assets">Assets</option>
            <option value="risks">Risks</option>
            <option value="compliance">Compliance</option>
          </select>
          <select class="form-select form-select-sm" v-model="selectedStatus" @change="filterReports">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="scheduled">Scheduled</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>
      <div class="card-body p-0">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2 text-muted">Loading reports...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="alert alert-danger m-3" role="alert">
          <i class="bi bi-exclamation-triangle me-2"></i>
          {{ error }}
          <button class="btn btn-outline-danger btn-sm ms-2" @click="retryLoad">
            <i class="bi bi-arrow-clockwise me-1"></i>Retry
          </button>
        </div>

        <!-- Reports Table -->
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Report Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Generated By</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredReports.length === 0">
                <td colspan="7" class="text-center py-4 text-muted">
                  <i class="bi bi-file-earmark fs-1 d-block mb-2"></i>
                  No reports found
                </td>
              </tr>
              <tr v-for="report in filteredReports" :key="report.id">
                <td>
                  <div class="fw-bold">{{ report.name }}</div>
                  <div class="text-muted small">{{ report.description }}</div>
                </td>
                <td>
                  <span class="badge" :class="getTypeClass(report.type)">
                    {{ formatType(report.type) }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="getStatusClass(report.status)">
                    {{ formatStatus(report.status) }}
                  </span>
                  <div v-if="report.status === 'in_progress'" class="progress mt-1" style="height: 4px;">
                    <div 
                      class="progress-bar bg-info" 
                      :style="{ width: report.progress + '%' }"
                    ></div>
                  </div>
                </td>
                <td>
                  <small>{{ formatDate(report.createdAt) }}</small>
                  <div class="text-muted small">{{ formatTime(report.createdAt) }}</div>
                </td>
                <td>{{ report.createdBy }}</td>
                <td>
                  <span v-if="report.size" class="text-muted">{{ formatFileSize(report.size) }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button 
                      v-if="report.status === 'completed'"
                      class="btn btn-outline-primary" 
                      title="Download"
                      @click="downloadReport(report)"
                    >
                      <i class="bi bi-download"></i>
                    </button>
                    <button 
                      v-if="report.status === 'completed'"
                      class="btn btn-outline-info" 
                      title="View"
                      @click="viewReport(report)"
                    >
                      <i class="bi bi-eye"></i>
                    </button>
                    <button 
                      v-if="report.status === 'completed'"
                      class="btn btn-outline-secondary" 
                      title="Share"
                      @click="shareReport(report)"
                    >
                      <i class="bi bi-share"></i>
                    </button>
                    <button 
                      v-if="report.status === 'in_progress' || report.status === 'scheduled'"
                      class="btn btn-outline-warning" 
                      title="Cancel"
                      @click="cancelReport(report)"
                    >
                      <i class="bi bi-x-circle"></i>
                    </button>
                    <button 
                      class="btn btn-outline-danger" 
                      title="Delete"
                      @click="deleteReport(report)"
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

    <!-- Create Report Modal -->
    <div class="modal fade" :class="{ show: showCreateReportModal }" style="display: block;" v-if="showCreateReportModal">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Generate New Report</h5>
            <button type="button" class="btn-close" @click="showCreateReportModal = false"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="generateReport">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="reportName" class="form-label">Report Name <span class="text-danger">*</span></label>
                  <input 
                    type="text" 
                    class="form-control" 
                    id="reportName"
                    v-model="newReport.name"
                    required
                  >
                </div>
                <div class="col-md-6 mb-3">
                  <label for="reportType" class="form-label">Report Type <span class="text-danger">*</span></label>
                  <select class="form-select" id="reportType" v-model="newReport.type" required>
                    <option value="">Select Type</option>
                    <option value="vulnerabilities">Vulnerability Report</option>
                    <option value="assets">Asset Inventory</option>
                    <option value="risks">Risk Assessment</option>
                    <option value="compliance">Compliance Report</option>
                  </select>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="reportDescription" class="form-label">Description</label>
                <textarea 
                  class="form-control" 
                  id="reportDescription"
                  rows="3"
                  v-model="newReport.description"
                  placeholder="Optional description of the report..."
                ></textarea>
              </div>
              
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="reportFormat" class="form-label">Format</label>
                  <select class="form-select" id="reportFormat" v-model="newReport.format">
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="csv">CSV</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="reportSchedule" class="form-label">Schedule</label>
                  <select class="form-select" id="reportSchedule" v-model="newReport.schedule">
                    <option value="immediate">Generate Now</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              
              <!-- Type-specific filters -->
              <div v-if="newReport.type === 'vulnerabilities'" class="mb-3">
                <label class="form-label">Vulnerability Filters</label>
                <div class="row">
                  <div class="col-md-6">
                    <select class="form-select" v-model="newReport.filters.severity">
                      <option value="">All Severities</option>
                      <option value="critical">Critical Only</option>
                      <option value="high">High & Critical</option>
                      <option value="medium">Medium & Above</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <select class="form-select" v-model="newReport.filters.status">
                      <option value="">All Status</option>
                      <option value="open">Open Only</option>
                      <option value="investigating">Under Investigation</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div v-if="newReport.type === 'assets'" class="mb-3">
                <label class="form-label">Asset Filters</label>
                <div class="row">
                  <div class="col-md-6">
                    <select class="form-select" v-model="newReport.filters.assetType">
                      <option value="">All Types</option>
                      <option value="server">Servers</option>
                      <option value="workstation">Workstations</option>
                      <option value="network_device">Network Devices</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <select class="form-select" v-model="newReport.filters.criticality">
                      <option value="">All Criticality</option>
                      <option value="critical">Critical Only</option>
                      <option value="high">High & Critical</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Recipients (Email)</label>
                <input 
                  type="email" 
                  class="form-control" 
                  v-model="newReport.recipients"
                  placeholder="email1@example.com, email2@example.com"
                >
                <div class="form-text">Separate multiple emails with commas</div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showCreateReportModal = false">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="generateReport" :disabled="isGenerating">
              <span v-if="isGenerating" class="spinner-border spinner-border-sm me-2"></span>
              {{ newReport.schedule === 'immediate' ? 'Generate Now' : 'Schedule Report' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" v-if="showCreateReportModal"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

// Report interface
interface Report {
  id: string
  name: string
  description: string
  type: 'vulnerabilities' | 'assets' | 'risks' | 'compliance'
  status: 'completed' | 'in_progress' | 'scheduled' | 'failed'
  format: 'pdf' | 'excel' | 'csv' | 'html'
  createdAt: string
  createdBy: string
  size?: number
  progress?: number
  downloadUrl?: string
}

// Mock data - replace with actual store
const reports = ref<Report[]>([
  {
    id: '1',
    name: 'Monthly Vulnerability Assessment',
    description: 'Comprehensive vulnerability report for January 2024',
    type: 'vulnerabilities',
    status: 'completed',
    format: 'pdf',
    createdAt: '2024-01-15T10:30:00Z',
    createdBy: 'John Doe',
    size: 2048576,
    downloadUrl: '/reports/vuln-jan-2024.pdf'
  },
  {
    id: '2',
    name: 'Asset Inventory Report',
    description: 'Complete asset inventory and status',
    type: 'assets',
    status: 'completed',
    format: 'excel',
    createdAt: '2024-01-14T14:15:00Z',
    createdBy: 'Jane Smith',
    size: 1536000,
    downloadUrl: '/reports/assets-inventory.xlsx'
  },
  {
    id: '3',
    name: 'Risk Assessment Q1',
    description: 'Quarterly risk assessment report',
    type: 'risks',
    status: 'in_progress',
    format: 'pdf',
    createdAt: '2024-01-16T09:00:00Z',
    createdBy: 'Mike Johnson',
    progress: 65
  }
])

const isLoading = ref(false)
const error = ref<string | null>(null)
const isGenerating = ref(false)

// Local reactive data
const selectedType = ref('')
const selectedStatus = ref('')
const showCreateReportModal = ref(false)

const newReport = ref({
  name: '',
  description: '',
  type: '',
  format: 'pdf',
  schedule: 'immediate',
  recipients: '',
  filters: {
    severity: '',
    status: '',
    assetType: '',
    criticality: ''
  }
})

// Computed properties
const reportStats = computed(() => {
  const stats = { total: 0, completed: 0, inProgress: 0, scheduled: 0 }
  reports.value.forEach(report => {
    stats.total++
    if (report.status === 'completed') stats.completed++
    else if (report.status === 'in_progress') stats.inProgress++
    else if (report.status === 'scheduled') stats.scheduled++
  })
  return stats
})

const filteredReports = computed(() => {
  return reports.value.filter(report => {
    const matchesType = !selectedType.value || report.type === selectedType.value
    const matchesStatus = !selectedStatus.value || report.status === selectedStatus.value
    return matchesType && matchesStatus
  })
})

// Methods
const refreshReports = async () => {
  isLoading.value = true
  try {
    // TODO: Implement API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Reports refreshed')
  } catch (err) {
    error.value = 'Failed to refresh reports'
  } finally {
    isLoading.value = false
  }
}

const filterReports = () => {
  // Filtering is handled by computed property
  console.log('Filtering reports:', { type: selectedType.value, status: selectedStatus.value })
}

const generateQuickReport = async (type: string) => {
  isGenerating.value = true
  try {
    // TODO: Implement API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('Quick report generated:', type)
    
    // Add new report to list
    const newReportItem: Report = {
      id: Date.now().toString(),
      name: `${formatType(type)} Report`,
      description: `Auto-generated ${type} report`,
      type: type as Report['type'],
      status: 'completed',
      format: 'pdf',
      createdAt: new Date().toISOString(),
      createdBy: 'Current User',
      size: Math.floor(Math.random() * 5000000),
      downloadUrl: `/reports/${type}-${Date.now()}.pdf`
    }
    
    reports.value.unshift(newReportItem)
  } catch (err) {
    error.value = 'Failed to generate report'
  } finally {
    isGenerating.value = false
  }
}

const generateReport = async () => {
  if (!newReport.value.name || !newReport.value.type) {
    return
  }
  
  isGenerating.value = true
  try {
    // TODO: Implement API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('Custom report generated:', newReport.value)
    
    // Add new report to list
    const reportItem: Report = {
      id: Date.now().toString(),
      name: newReport.value.name,
      description: newReport.value.description,
      type: newReport.value.type as Report['type'],
      status: newReport.value.schedule === 'immediate' ? 'in_progress' : 'scheduled',
      format: newReport.value.format as Report['format'],
      createdAt: new Date().toISOString(),
      createdBy: 'Current User',
      progress: newReport.value.schedule === 'immediate' ? 0 : undefined
    }
    
    reports.value.unshift(reportItem)
    showCreateReportModal.value = false
    
    // Reset form
    newReport.value = {
      name: '',
      description: '',
      type: '',
      format: 'pdf',
      schedule: 'immediate',
      recipients: '',
      filters: {
        severity: '',
        status: '',
        assetType: '',
        criticality: ''
      }
    }
  } catch (err) {
    error.value = 'Failed to generate report'
  } finally {
    isGenerating.value = false
  }
}

const downloadReport = (report: Report) => {
  if (report.downloadUrl) {
    // Create a temporary link and trigger download
    const link = document.createElement('a')
    link.href = report.downloadUrl
    link.download = `${report.name}.${report.format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  console.log('Download report:', report.name)
}

const viewReport = (report: Report) => {
  console.log('View report:', report.name)
  // TODO: Open report in new tab or modal
}

const shareReport = (report: Report) => {
  console.log('Share report:', report.name)
  // TODO: Open share modal with email/link options
}

const cancelReport = (report: Report) => {
  if (confirm(`Are you sure you want to cancel "${report.name}"?`)) {
    report.status = 'failed'
    console.log('Report cancelled:', report.name)
  }
}

const deleteReport = (report: Report) => {
  if (confirm(`Are you sure you want to delete "${report.name}"?`)) {
    const index = reports.value.findIndex(r => r.id === report.id)
    if (index !== -1) {
      reports.value.splice(index, 1)
    }
    console.log('Report deleted:', report.name)
  }
}

const retryLoad = () => {
  error.value = null
  refreshReports()
}

// Utility methods
const getTypeClass = (type: string) => {
  const classes = {
    vulnerabilities: 'bg-danger',
    assets: 'bg-primary',
    risks: 'bg-warning',
    compliance: 'bg-success'
  }
  return classes[type as keyof typeof classes] || 'bg-secondary'
}

const getStatusClass = (status: string) => {
  const classes = {
    completed: 'bg-success',
    in_progress: 'bg-info',
    scheduled: 'bg-warning',
    failed: 'bg-danger'
  }
  return classes[status as keyof typeof classes] || 'bg-secondary'
}

const formatType = (type: string) => {
  const labels = {
    vulnerabilities: 'Vulnerabilities',
    assets: 'Assets',
    risks: 'Risks',
    compliance: 'Compliance'
  }
  return labels[type as keyof typeof labels] || type
}

const formatStatus = (status: string) => {
  const labels = {
    completed: 'Completed',
    in_progress: 'In Progress',
    scheduled: 'Scheduled',
    failed: 'Failed'
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

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatFileSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

// Lifecycle
onMounted(() => {
  refreshReports()
})
</script>

<style scoped>
.reports-view {
  padding: 1rem;
}

.report-template {
  cursor: pointer;
  transition: all 0.2s ease;
}

.report-template:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  border-color: var(--bs-primary) !important;
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

.stat-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
</style>