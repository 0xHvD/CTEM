<template>
  <div class="vulnerabilities-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Vulnerability Management</h1>
        <p class="text-muted mb-0">Track and manage security vulnerabilities</p>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary">
          <i class="bi bi-download me-2"></i>Export
        </button>
        <button class="btn btn-primary">
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
                <h4>{{ stats.critical }}</h4>
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
                <h4>{{ stats.high }}</h4>
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
                <h4>{{ stats.medium }}</h4>
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
                <h4>{{ stats.low }}</h4>
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
            <input 
              type="text" 
              class="form-control" 
              placeholder="Search vulnerabilities..."
              v-model="searchTerm"
            >
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedSeverity">
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-select" v-model="selectedStatus">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select" v-model="selectedAsset">
              <option value="">All Assets</option>
              <option value="web-server-01">Web Server 01</option>
              <option value="database-server">Database Server</option>
              <option value="mail-server">Mail Server</option>
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-outline-primary w-100" @click="clearFilters">
              <i class="bi bi-x-circle"></i> Clear
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Vulnerabilities Table -->
    <div class="card">
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
              <tr v-for="vuln in filteredVulnerabilities" :key="vuln.id">
                <td>
                  <div class="fw-bold">{{ vuln.title }}</div>
                  <div class="text-muted small">{{ vuln.cve }}</div>
                  <div class="text-muted small">{{ vuln.category }}</div>
                </td>
                <td>
                  <div class="fw-bold">{{ vuln.asset }}</div>
                  <div class="text-muted small">{{ vuln.assetType }}</div>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="`severity-${vuln.severity.toLowerCase()}`"
                  >
                    {{ vuln.severity }}
                  </span>
                </td>
                <td>
                  <div class="fw-bold">{{ vuln.cvssScore }}</div>
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
                    {{ formatStatus(vuln.status) }}
                  </span>
                </td>
                <td>
                  <small>{{ formatDate(vuln.detected) }}</small>
                </td>
                <td>
                  <span class="badge bg-light text-dark">
                    {{ calculateAge(vuln.detected) }} days
                  </span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button 
                      class="btn btn-outline-primary" 
                      title="View Details"
                      @click="viewDetails(vuln)"
                    >
                      <i class="bi bi-eye"></i>
                    </button>
                    <button 
                      class="btn btn-outline-success" 
                      title="Remediate"
                      @click="remediate(vuln)"
                    >
                      <i class="bi bi-tools"></i>
                    </button>
                    <button 
                      class="btn btn-outline-secondary" 
                      title="More"
                      data-bs-toggle="dropdown"
                    >
                      <i class="bi bi-three-dots"></i>
                    </button>
                    <ul class="dropdown-menu">
                      <li><a class="dropdown-item" href="#">Mark as False Positive</a></li>
                      <li><a class="dropdown-item" href="#">Accept Risk</a></li>
                      <li><a class="dropdown-item" href="#">Assign to...</a></li>
                    </ul>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// Reactive data
const searchTerm = ref('')
const selectedSeverity = ref('')
const selectedStatus = ref('')
const selectedAsset = ref('')

const stats = ref({
  critical: 12,
  high: 28,
  medium: 34,
  low: 15
})

const vulnerabilities = ref([
  {
    id: 1,
    title: 'SQL Injection Vulnerability',
    cve: 'CVE-2024-0001',
    category: 'Injection',
    asset: 'Web Server 01',
    assetType: 'Apache HTTP Server',
    severity: 'Critical',
    cvssScore: 9.8,
    status: 'open',
    detected: new Date('2024-01-10')
  },
  {
    id: 2,
    title: 'Authentication Bypass',
    cve: 'CVE-2024-0002',
    category: 'Authentication',
    asset: 'Database Server',
    assetType: 'MySQL 8.0',
    severity: 'High',
    cvssScore: 8.1,
    status: 'in_progress',
    detected: new Date('2024-01-12')
  },
  {
    id: 3,
    title: 'Cross-Site Scripting (XSS)',
    cve: 'CVE-2024-0003',
    category: 'XSS',
    asset: 'Web Server 01',
    assetType: 'Apache HTTP Server', 
    severity: 'Medium',
    cvssScore: 6.1,
    status: 'open',
    detected: new Date('2024-01-14')
  }
])

// Computed properties
const filteredVulnerabilities = computed(() => {
  return vulnerabilities.value.filter(vuln => {
    const matchesSearch = vuln.title.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         vuln.cve.toLowerCase().includes(searchTerm.value.toLowerCase())
    const matchesSeverity = !selectedSeverity.value || vuln.severity.toLowerCase() === selectedSeverity.value
    const matchesStatus = !selectedStatus.value || vuln.status === selectedStatus.value
    const matchesAsset = !selectedAsset.value || vuln.asset.toLowerCase().replace(/\s+/g, '-') === selectedAsset.value
    
    return matchesSearch && matchesSeverity && matchesStatus && matchesAsset
  })
})

// Methods
const clearFilters = () => {
  searchTerm.value = ''
  selectedSeverity.value = ''
  selectedStatus.value = ''
  selectedAsset.value = ''
}

const getCvssProgressClass = (score: number) => {
  if (score >= 9.0) return 'bg-danger'
  if (score >= 7.0) return 'bg-warning'
  if (score >= 4.0) return 'bg-info'
  return 'bg-success'
}

const getStatusClass = (status: string) => {
  const classes = {
    open: 'bg-danger',
    in_progress: 'bg-warning',
    resolved: 'bg-success',
    false_positive: 'bg-secondary'
  }
  return classes[status as keyof typeof classes] || 'bg-secondary'
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('de-DE')
}

const calculateAge = (detected: Date) => {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - detected.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const viewDetails = (vuln: any) => {
  console.log('View details for:', vuln.title)
  // Hier würde ein Modal oder eine Detail-Seite geöffnet werden
}

const remediate = (vuln: any) => {
  console.log('Start remediation for:', vuln.title)
  // Hier würde der Remediation-Workflow gestartet werden
}
</script>