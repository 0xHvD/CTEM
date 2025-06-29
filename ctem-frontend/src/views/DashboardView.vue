<template>
  <div class="dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header mb-4">
      <div class="container-fluid">
        <div class="row align-items-center">
          <div class="col-md-8">
            <h1 class="mb-0">Security Dashboard</h1>
            <p class="mb-0 opacity-75">Continuous Threat Exposure Management</p>
          </div>
          <div class="col-md-4 text-end">
            <div class="text-white">
              <small>Last updated: {{ lastUpdated }}</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Key Metrics Cards -->
    <div class="row mb-4">
      <div class="col-xl-3 col-md-6 mb-3">
        <div class="card stat-card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2 text-muted">Total Assets</h6>
                <h2 class="card-title mb-0">{{ metrics.totalAssets }}</h2>
                <small class="text-success">
                  <i class="bi bi-arrow-up"></i> +12 this month
                </small>
              </div>
              <div class="text-primary">
                <i class="bi bi-hdd-stack" style="font-size: 2rem;"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-3 col-md-6 mb-3">
        <div class="card stat-card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2 text-muted">Active Vulnerabilities</h6>
                <h2 class="card-title mb-0">{{ metrics.activeVulnerabilities }}</h2>
                <small class="text-danger">
                  <i class="bi bi-arrow-down"></i> -8 this week
                </small>
              </div>
              <div class="text-danger">
                <i class="bi bi-exclamation-triangle" style="font-size: 2rem;"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-3 col-md-6 mb-3">
        <div class="card stat-card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2 text-muted">Average Risk Score</h6>
                <h2 class="card-title mb-0">{{ metrics.avgRiskScore }}</h2>
                <small class="text-warning">
                  <i class="bi bi-dash"></i> No change
                </small>
              </div>
              <div class="text-warning">
                <i class="bi bi-speedometer" style="font-size: 2rem;"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-3 col-md-6 mb-3">
        <div class="card stat-card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h6 class="card-subtitle mb-2 text-muted">Compliance Score</h6>
                <h2 class="card-title mb-0">{{ metrics.complianceScore }}%</h2>
                <small class="text-success">
                  <i class="bi bi-arrow-up"></i> +5% this month
                </small>
              </div>
              <div class="text-success">
                <i class="bi bi-shield-check" style="font-size: 2rem;"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts and Tables Row -->
    <div class="row">
      <!-- Vulnerability Trend Chart -->
      <div class="col-lg-8 mb-4">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">Vulnerability Trends</h5>
            <div class="btn-group btn-group-sm" role="group">
              <button 
                type="button" 
                class="btn btn-outline-primary"
                :class="{ active: chartPeriod === '7d' }"
                @click="chartPeriod = '7d'"
              >
                7 Days
              </button>
              <button 
                type="button" 
                class="btn btn-outline-primary"
                :class="{ active: chartPeriod === '30d' }"
                @click="chartPeriod = '30d'"
              >
                30 Days
              </button>
              <button 
                type="button" 
                class="btn btn-outline-primary"
                :class="{ active: chartPeriod === '90d' }"
                @click="chartPeriod = '90d'"
              >
                90 Days
              </button>
            </div>
          </div>
          <div class="card-body">
            <canvas id="vulnerabilityChart" height="300"></canvas>
          </div>
        </div>
      </div>

      <!-- Severity Distribution -->
      <div class="col-lg-4 mb-4">
        <div class="card h-100">
          <div class="card-header">
            <h5 class="card-title mb-0">Severity Distribution</h5>
          </div>
          <div class="card-body">
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge severity-critical">Critical</span>
                <span class="fw-bold">{{ severityData.critical }}</span>
              </div>
              <div class="progress mb-2">
                <div 
                  class="progress-bar bg-danger" 
                  :style="{ width: (severityData.critical / metrics.activeVulnerabilities * 100) + '%' }"
                ></div>
              </div>
            </div>

            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge severity-high">High</span>
                <span class="fw-bold">{{ severityData.high }}</span>
              </div>
              <div class="progress mb-2">
                <div 
                  class="progress-bar bg-warning" 
                  :style="{ width: (severityData.high / metrics.activeVulnerabilities * 100) + '%' }"
                ></div>
              </div>
            </div>

            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge severity-medium">Medium</span>
                <span class="fw-bold">{{ severityData.medium }}</span>
              </div>
              <div class="progress mb-2">
                <div 
                  class="progress-bar bg-info" 
                  :style="{ width: (severityData.medium / metrics.activeVulnerabilities * 100) + '%' }"
                ></div>
              </div>
            </div>

            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge severity-low">Low</span>
                <span class="fw-bold">{{ severityData.low }}</span>
              </div>
              <div class="progress mb-2">
                <div 
                  class="progress-bar bg-success" 
                  :style="{ width: (severityData.low / metrics.activeVulnerabilities * 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activities and Top Risks -->
    <div class="row">
      <!-- Recent Vulnerabilities -->
      <div class="col-lg-6 mb-4">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">Recent Vulnerabilities</h5>
            <router-link to="/vulnerabilities" class="btn btn-sm btn-outline-primary">
              View All
            </router-link>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Asset</th>
                    <th>Vulnerability</th>
                    <th>Severity</th>
                    <th>Detected</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="vuln in recentVulnerabilities" :key="vuln.id">
                    <td>
                      <strong>{{ vuln.asset }}</strong>
                      <br>
                      <small class="text-muted">{{ vuln.assetType }}</small>
                    </td>
                    <td>
                      <div class="fw-bold">{{ vuln.title }}</div>
                      <small class="text-muted">{{ vuln.cve }}</small>
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
                      <small>{{ formatDate(vuln.detected) }}</small>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Risk Assets -->
      <div class="col-lg-6 mb-4">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">Highest Risk Assets</h5>
            <router-link to="/risks" class="btn btn-sm btn-outline-primary">
              View All
            </router-link>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Asset</th>
                    <th>Risk Score</th>
                    <th>Vulnerabilities</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="asset in topRiskAssets" :key="asset.id">
                    <td>
                      <strong>{{ asset.name }}</strong>
                      <br>
                      <small class="text-muted">{{ asset.type }}</small>
                    </td>
                    <td>
                      <div class="d-flex align-items-center">
                        <span class="fw-bold me-2">{{ asset.riskScore }}</span>
                        <div 
                          class="progress flex-grow-1" 
                          style="height: 6px; max-width: 60px;"
                        >
                          <div 
                            class="progress-bar bg-danger" 
                            :style="{ width: (asset.riskScore / 10 * 100) + '%' }"
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="badge bg-secondary">{{ asset.vulnCount }}</span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-eye"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Reactive data
const chartPeriod = ref('30d')
const lastUpdated = ref(new Date().toLocaleString())

const metrics = ref({
  totalAssets: 247,
  activeVulnerabilities: 89,
  avgRiskScore: 6.7,
  complianceScore: 87
})

const severityData = ref({
  critical: 12,
  high: 28,
  medium: 34,
  low: 15
})

const recentVulnerabilities = ref([
  {
    id: 1,
    asset: 'Web Server 01',
    assetType: 'Apache HTTP Server',
    title: 'SQL Injection Vulnerability',
    cve: 'CVE-2024-0001',
    severity: 'Critical',
    detected: new Date('2024-01-15')
  },
  {
    id: 2,
    asset: 'Database Server',
    assetType: 'MySQL 8.0',
    title: 'Authentication Bypass',
    cve: 'CVE-2024-0002',
    severity: 'High',
    detected: new Date('2024-01-14')
  },
  {
    id: 3,
    asset: 'Mail Server',
    assetType: 'Postfix',
    title: 'Buffer Overflow',
    cve: 'CVE-2024-0003',
    severity: 'Medium',
    detected: new Date('2024-01-13')
  }
])

const topRiskAssets = ref([
  {
    id: 1,
    name: 'Production Web Server',
    type: 'Web Server',
    riskScore: 9.2,
    vulnCount: 5
  },
  {
    id: 2,
    name: 'Customer Database',
    type: 'Database',
    riskScore: 8.7,
    vulnCount: 3
  },
  {
    id: 3,
    name: 'API Gateway',
    type: 'Load Balancer',
    riskScore: 7.4,
    vulnCount: 7
  }
])

// Methods
const formatDate = (date: Date) => {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

onMounted(() => {
  // Hier würde später die Chart.js Initialisierung stehen
  console.log('Dashboard mounted - Charts will be initialized here')
})
</script>