<template>
  <div class="dashboard">
    <!-- Loading Spinner -->
    <div v-if="isLoading" class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ error }}
      <button type="button" class="btn-close" @click="clearError"></button>
    </div>

    <template v-if="!isLoading">
      <!-- Dashboard Header -->
      <div class="dashboard-header mb-4">
        <div class="container-fluid">
          <div class="row align-items-center">
            <div class="col-md-8">
              <h1 class="mb-0">Security Dashboard</h1>
              <p class="mb-0 opacity-75">Continuous Threat Exposure Management</p>
            </div>
            <div class="col-md-4 text-end">
              <div class="d-flex align-items-center justify-content-end gap-3">
                <div class="text-muted">
                  <small>Last updated: {{ formatLastUpdated }}</small>
                </div>
                <button 
                  class="btn btn-sm btn-outline-primary" 
                  @click="refreshData"
                  :disabled="isLoading"
                >
                  <i class="bi bi-arrow-clockwise me-1"></i>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Key Metrics Cards -->
      <div class="row mb-4">
        <div 
          v-for="kpi in kpiDefinitions" 
          :key="kpi.id"
          class="col-xl-3 col-md-6 mb-3"
        >
          <div class="card stat-card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between">
                <div>
                  <h6 class="card-subtitle mb-2 text-muted">{{ kpi.title }}</h6>
                  <h2 class="card-title mb-0">{{ kpi.format(kpi.getValue()) }}</h2>
                  <small 
                    class="text-muted"
                    v-if="kpi.id === 'criticalVulnerabilities' && kpi.getValue() > 0"
                  >
                    <i class="bi bi-exclamation-triangle text-danger"></i>
                    Action required
                  </small>
                  <small 
                    class="text-success"
                    v-else-if="kpi.id === 'criticalVulnerabilities'"
                  >
                    <i class="bi bi-check-circle"></i>
                    All clear
                  </small>
                </div>
                <div :class="`text-${kpi.getColor()}`">
                  <i :class="kpi.icon" style="font-size: 2rem;"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Risk Level Alert -->
      <div v-if="riskLevel.level === 'critical' || riskLevel.level === 'high'" class="row mb-4">
        <div class="col-12">
          <div :class="`alert alert-${riskLevel.color === 'danger' ? 'danger' : 'warning'}`" role="alert">
            <i class="bi bi-shield-exclamation me-2"></i>
            <strong>{{ riskLevel.text }} detected!</strong>
            Your organization has a {{ riskLevel.text.toLowerCase() }} with an average risk score of {{ stats.averageRiskScore.toFixed(1) }}.
            Immediate attention is recommended.
          </div>
        </div>
      </div>

      <!-- Charts and Visualizations Row -->
      <div class="row mb-4">
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
                  @click="updateChartPeriod('7d')"
                >
                  7 Days
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline-primary"
                  :class="{ active: chartPeriod === '30d' }"
                  @click="updateChartPeriod('30d')"
                >
                  30 Days
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline-primary"
                  :class="{ active: chartPeriod === '90d' }"
                  @click="updateChartPeriod('90d')"
                >
                  90 Days
                </button>
              </div>
            </div>
            <div class="card-body">
              <canvas 
                ref="vulnerabilityChartRef" 
                id="vulnerabilityChart"
                style="max-height: 300px;"
              ></canvas>
            </div>
          </div>
        </div>

        <!-- Risk Distribution Pie Chart -->
        <div class="col-lg-4 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Risk Distribution</h5>
            </div>
            <div class="card-body">
              <canvas 
                ref="riskDistributionChartRef" 
                id="riskDistributionChart"
                style="max-height: 250px;"
              ></canvas>
              <div class="mt-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div class="d-flex align-items-center">
                    <div class="bg-danger rounded me-2" style="width: 12px; height: 12px;"></div>
                    <small>High Risk</small>
                  </div>
                  <small class="fw-bold">{{ stats.highRiskAssets }}</small>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div class="d-flex align-items-center">
                    <div class="bg-warning rounded me-2" style="width: 12px; height: 12px;"></div>
                    <small>Medium Risk</small>
                  </div>
                  <small class="fw-bold">{{ Math.max(0, stats.totalAssets - stats.highRiskAssets - Math.floor(stats.totalAssets * 0.3)) }}</small>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                  <div class="d-flex align-items-center">
                    <div class="bg-success rounded me-2" style="width: 12px; height: 12px;"></div>
                    <small>Low Risk</small>
                  </div>
                  <small class="fw-bold">{{ Math.floor(stats.totalAssets * 0.3) }}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Secondary Charts Row -->
      <div class="row mb-4">
        <!-- Asset Trends -->
        <div class="col-lg-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Asset Trends</h5>
            </div>
            <div class="card-body">
              <canvas 
                ref="assetTrendChartRef" 
                id="assetTrendChart"
                style="max-height: 250px;"
              ></canvas>
            </div>
          </div>
        </div>

        <!-- Risk Score Trends -->
        <div class="col-lg-6 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Risk Score Trends</h5>
            </div>
            <div class="card-body">
              <canvas 
                ref="riskTrendChartRef" 
                id="riskTrendChart"
                style="max-height: 250px;"
              ></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Cards Row -->
      <div class="row mb-4">
        <!-- Asset Health Summary -->
        <div class="col-lg-4 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Asset Health</h5>
            </div>
            <div class="card-body">
              <div class="text-center mb-3">
                <div class="display-4 fw-bold" :class="`text-${assetHealthPercentage >= 90 ? 'success' : assetHealthPercentage >= 70 ? 'warning' : 'danger'}`">
                  {{ assetHealthPercentage }}%
                </div>
                <small class="text-muted">Assets Active</small>
              </div>
              <div class="progress mb-3" style="height: 10px;">
                <div 
                  class="progress-bar"
                  :class="`bg-${assetHealthPercentage >= 90 ? 'success' : assetHealthPercentage >= 70 ? 'warning' : 'danger'}`"
                  :style="{ width: assetHealthPercentage + '%' }"
                ></div>
              </div>
              <div class="d-flex justify-content-between text-sm">
                <span>Active: {{ stats.activeAssets }}</span>
                <span>Total: {{ stats.totalAssets }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Compliance Score -->
        <div class="col-lg-4 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Compliance</h5>
            </div>
            <div class="card-body">
              <div class="text-center mb-3">
                <div class="display-4 fw-bold" :class="`text-${complianceLevel.color}`">
                  {{ stats.complianceScore.toFixed(0) }}%
                </div>
                <small class="text-muted">{{ complianceLevel.text }}</small>
              </div>
              <div class="progress mb-3" style="height: 10px;">
                <div 
                  class="progress-bar"
                  :class="`bg-${complianceLevel.color}`"
                  :style="{ width: stats.complianceScore + '%' }"
                ></div>
              </div>
              <div class="text-center">
                <small class="text-muted">Based on security frameworks</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="col-lg-4 mb-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Recent Activity</h5>
            </div>
            <div class="card-body">
              <div class="d-flex align-items-center mb-3">
                <i class="bi bi-bell text-warning me-3" style="font-size: 1.5rem;"></i>
                <div>
                  <div class="fw-bold">{{ stats.recentAlerts }}</div>
                  <small class="text-muted">New Alerts</small>
                </div>
              </div>
              <div class="d-flex align-items-center mb-3">
                <i class="bi bi-patch-check text-success me-3" style="font-size: 1.5rem;"></i>
                <div>
                  <div class="fw-bold">{{ stats.patchingEfficiency.toFixed(0) }}%</div>
                  <small class="text-muted">Patching Efficiency</small>
                </div>
              </div>
              <div class="d-flex align-items-center">
                <i class="bi bi-graph-up text-info me-3" style="font-size: 1.5rem;"></i>
                <div>
                  <div class="fw-bold">{{ stats.averageRiskScore.toFixed(1) }}</div>
                  <small class="text-muted">Avg Risk Score</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">Quick Actions</h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-3 mb-2">
                  <router-link to="/assets" class="btn btn-outline-primary w-100">
                    <i class="bi bi-hdd-stack me-2"></i>
                    Manage Assets
                  </router-link>
                </div>
                <div class="col-md-3 mb-2">
                  <router-link to="/vulnerabilities" class="btn btn-outline-danger w-100">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    View Vulnerabilities
                  </router-link>
                </div>
                <div class="col-md-3 mb-2">
                  <router-link to="/risks" class="btn btn-outline-warning w-100">
                    <i class="bi bi-shield-exclamation me-2"></i>
                    Risk Assessment
                  </router-link>
                </div>
                <div class="col-md-3 mb-2">
                  <router-link to="/reports" class="btn btn-outline-info w-100">
                    <i class="bi bi-file-earmark-text me-2"></i>
                    Generate Report
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import { storeToRefs } from 'pinia'

// Chart.js (würde normalerweise importiert werden)
// import Chart from 'chart.js/auto'

// Dashboard Store
const dashboardStore = useDashboardStore()
const {
  stats,
  assetTrends,
  vulnerabilityTrends,
  riskTrends,
  isLoading,
  error,
  lastUpdated,
  riskLevel,
  complianceLevel,
  assetHealthPercentage,
  criticalVulnerabilityPercentage,
  assetTrendChartData,
  vulnerabilityTrendChartData,
  riskTrendChartData,
  riskDistributionChartData,
  kpiDefinitions
} = storeToRefs(dashboardStore)

const {
  refreshDashboard,
  clearError,
  fetchAssetTrends,
  fetchVulnerabilityTrends,
  fetchRiskTrends
} = dashboardStore

// Local reactive data
const chartPeriod = ref<'7d' | '30d' | '90d'>('30d')
const vulnerabilityChartRef = ref<HTMLCanvasElement>()
const riskDistributionChartRef = ref<HTMLCanvasElement>()
const assetTrendChartRef = ref<HTMLCanvasElement>()
const riskTrendChartRef = ref<HTMLCanvasElement>()

// Chart instances (würde Chart.js verwenden)
const vulnerabilityChart = ref<any>(null)
const riskDistributionChart = ref<any>(null)
const assetTrendChart = ref<any>(null)
const riskTrendChart = ref<any>(null)

// Auto-refresh interval - Browser Timer Type
const refreshInterval = ref<number | null>(null)

// Computed properties
const formatLastUpdated = computed(() => {
  if (!lastUpdated.value) return 'Never'
  return lastUpdated.value.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

// Methods
const refreshData = async () => {
  await refreshDashboard(chartPeriod.value)
  updateCharts()
}

const updateChartPeriod = async (period: '7d' | '30d' | '90d') => {
  chartPeriod.value = period
  await Promise.all([
    fetchAssetTrends(period),
    fetchVulnerabilityTrends(period),
    fetchRiskTrends(period)
  ])
  updateCharts()
}

const initializeCharts = () => {
  // Chart.js Initialisierung würde hier stehen
  // Beispiel für Vulnerability Trend Chart:
  /*
  if (vulnerabilityChartRef.value) {
    vulnerabilityChart.value = new Chart(vulnerabilityChartRef.value, {
      type: 'line',
      data: vulnerabilityTrendChartData.value,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    })
  }
  */
  
  console.log('Charts initialized with data:', {
    vulnerabilityTrends: vulnerabilityTrendChartData.value,
    riskDistribution: riskDistributionChartData.value,
    assetTrends: assetTrendChartData.value,
    riskTrends: riskTrendChartData.value
  })
}

const updateCharts = () => {
  // Chart.js Update würde hier stehen
  /*
  if (vulnerabilityChart.value) {
    vulnerabilityChart.value.data = vulnerabilityTrendChartData.value
    vulnerabilityChart.value.update()
  }
  */
  
  console.log('Charts updated with new data')
}

const setupAutoRefresh = () => {
  // Auto-refresh every 5 minutes
  refreshInterval.value = window.setInterval(() => {
    refreshData()
  }, 5 * 60 * 1000)
}

const destroyCharts = () => {
  // Chart.js Cleanup würde hier stehen
  /*
  if (vulnerabilityChart.value) {
    vulnerabilityChart.value.destroy()
  }
  if (riskDistributionChart.value) {
    riskDistributionChart.value.destroy()
  }
  if (assetTrendChart.value) {
    assetTrendChart.value.destroy()
  }
  if (riskTrendChart.value) {
    riskTrendChart.value.destroy()
  }
  */
}

// Lifecycle hooks
onMounted(async () => {
  // Initial data load
  await refreshData()
  
  // Initialize charts after data is loaded
  setTimeout(() => {
    initializeCharts()
  }, 100)
  
  // Setup auto-refresh
  setupAutoRefresh()
})

onUnmounted(() => {
  // Cleanup
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
  destroyCharts()
})
</script>

<style scoped>
.dashboard {
  padding: 1rem;
}

.dashboard-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0.5rem;
  padding: 2rem;
  color: white;
  margin-bottom: 2rem;
}

.stat-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.severity-critical {
  background-color: #dc3545;
  color: white;
}

.severity-high {
  background-color: #fd7e14;
  color: white;
}

.severity-medium {
  background-color: #ffc107;
  color: black;
}

.severity-low {
  background-color: #198754;
  color: white;
}

.progress {
  height: 6px;
}

.card {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border: none;
}

.card-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.btn-group .btn.active {
  background-color: #0d6efd;
  border-color: #0d6efd;
  color: white;
}

@media (max-width: 768px) {
  .dashboard-header .col-md-4 {
    text-align: center !important;
    margin-top: 1rem;
  }
  
  .stat-card {
    margin-bottom: 1rem;
  }
}
</style>