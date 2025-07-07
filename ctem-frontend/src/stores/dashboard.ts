import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService, type DashboardStats, type ApiError } from '@/services/api'
import { useAuthStore } from './auth'

interface TrendData {
  date: string
  value: number
  label?: string
}

interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }[]
}

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const stats = ref<DashboardStats>({
    totalAssets: 0,
    activeAssets: 0,
    criticalVulnerabilities: 0,
    highRiskAssets: 0,
    averageRiskScore: 0,
    complianceScore: 0,
    recentAlerts: 0,
    patchingEfficiency: 0
  })

  const assetTrends = ref<TrendData[]>([])
  const vulnerabilityTrends = ref<TrendData[]>([])
  const riskTrends = ref<TrendData[]>([])
  
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<Date | null>(null)

  // Getters
  const riskLevel = computed(() => {
    const score = stats.value.averageRiskScore
    if (score >= 8) return { level: 'critical', color: 'danger', text: 'Critical Risk' }
    if (score >= 6) return { level: 'high', color: 'warning', text: 'High Risk' }
    if (score >= 4) return { level: 'medium', color: 'info', text: 'Medium Risk' }
    return { level: 'low', color: 'success', text: 'Low Risk' }
  })

  const complianceLevel = computed(() => {
    const score = stats.value.complianceScore
    if (score >= 90) return { level: 'excellent', color: 'success', text: 'Excellent' }
    if (score >= 75) return { level: 'good', color: 'info', text: 'Good' }
    if (score >= 60) return { level: 'fair', color: 'warning', text: 'Fair' }
    return { level: 'poor', color: 'danger', text: 'Poor' }
  })

  const assetHealthPercentage = computed(() => {
    if (stats.value.totalAssets === 0) return 0
    return Math.round((stats.value.activeAssets / stats.value.totalAssets) * 100)
  })

  const criticalVulnerabilityPercentage = computed(() => {
    if (stats.value.totalAssets === 0) return 0
    return Math.round((stats.value.criticalVulnerabilities / stats.value.totalAssets) * 100)
  })

  // Chart data for visualizations
  const assetTrendChartData = computed<ChartData>(() => ({
    labels: assetTrends.value.map(d => d.date),
    datasets: [{
      label: 'Assets',
      data: assetTrends.value.map(d => d.value),
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2
    }]
  }))

  const vulnerabilityTrendChartData = computed<ChartData>(() => ({
    labels: vulnerabilityTrends.value.map(d => d.date),
    datasets: [{
      label: 'Vulnerabilities',
      data: vulnerabilityTrends.value.map(d => d.value),
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 2
    }]
  }))

  const riskTrendChartData = computed<ChartData>(() => ({
    labels: riskTrends.value.map(d => d.date),
    datasets: [{
      label: 'Risk Score',
      data: riskTrends.value.map(d => d.value),
      backgroundColor: 'rgba(255, 206, 86, 0.2)',
      borderColor: 'rgba(255, 206, 86, 1)',
      borderWidth: 2
    }]
  }))

  const riskDistributionChartData = computed<ChartData>(() => {
    const total = stats.value.totalAssets
    const high = stats.value.highRiskAssets
    const medium = Math.max(0, total - high - (total * 0.2)) // Estimate medium risk
    const low = Math.max(0, total - high - medium)

    return {
      labels: ['High Risk', 'Medium Risk', 'Low Risk'],
      datasets: [{
        label: 'Assets by Risk Level',
        data: [high, medium, low],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1
      }]
    }
  })

  // Actions
  async function fetchDashboardStats() {
    const authStore = useAuthStore()
    
    // Check authentication before making API calls
    if (!authStore.isAuthenticated) {
      console.log('Not authenticated, skipping dashboard stats fetch')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getDashboardStats()
      stats.value = response.data
      lastUpdated.value = new Date()
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch dashboard stats:', apiError)
      
      // Use mock data for development if API is not available
      if (apiError.status === 401) {
        // Don't use mock data for auth errors
        console.log('Authentication error, not loading mock data')
      } else if (apiError.status === undefined || apiError.status >= 500) {
        // Use mock data for network/server errors during development
        console.log('Using mock data due to API unavailability')
        setMockData()
      }
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAssetTrends(timeframe: '7d' | '30d' | '90d' = '30d') {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    try {
      const response = await apiService.getAssetTrends(timeframe)
      assetTrends.value = response.data
    } catch (err) {
      const apiError = err as ApiError
      console.error('Failed to fetch asset trends:', apiError)
      
      // Generate mock trend data for development
      if (apiError.status !== 401) {
        assetTrends.value = generateMockTrends(timeframe)
      }
    }
  }

  async function fetchVulnerabilityTrends(timeframe: '7d' | '30d' | '90d' = '30d') {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    try {
      const response = await apiService.getVulnerabilityTrends(timeframe)
      vulnerabilityTrends.value = response.data
    } catch (err) {
      const apiError = err as ApiError
      console.error('Failed to fetch vulnerability trends:', apiError)
      
      // Generate mock trend data for development
      if (apiError.status !== 401) {
        vulnerabilityTrends.value = generateMockTrends(timeframe, 5, 25)
      }
    }
  }

  async function fetchRiskTrends(timeframe: '7d' | '30d' | '90d' = '30d') {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    try {
      const response = await apiService.getRiskTrends(timeframe)
      riskTrends.value = response.data
    } catch (err) {
      const apiError = err as ApiError
      console.error('Failed to fetch risk trends:', apiError)
      
      // Generate mock trend data for development
      if (apiError.status !== 401) {
        riskTrends.value = generateMockTrends(timeframe, 3, 8)
      }
    }
  }

  async function refreshDashboard(timeframe: '7d' | '30d' | '90d' = '30d') {
    const authStore = useAuthStore()
    
    if (!authStore.isAuthenticated) {
      console.log('Cannot refresh dashboard: not authenticated')
      return
    }

    await Promise.all([
      fetchDashboardStats(),
      fetchAssetTrends(timeframe),
      fetchVulnerabilityTrends(timeframe),
      fetchRiskTrends(timeframe)
    ])
  }

  function clearError() {
    error.value = null
  }

  // Mock data functions for development
  function setMockData() {
    stats.value = {
      totalAssets: 1247,
      activeAssets: 1189,
      criticalVulnerabilities: 23,
      highRiskAssets: 87,
      averageRiskScore: 6.2,
      complianceScore: 78.5,
      recentAlerts: 12,
      patchingEfficiency: 82.3
    }
    lastUpdated.value = new Date()
    console.log('Mock dashboard data loaded')
  }

  function generateMockTrends(timeframe: string, minValue: number = 100, maxValue: number = 200): TrendData[] {
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
    const trends: TrendData[] = []
    
    for (let i = days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      // Generate realistic trending data
      const baseValue = minValue + (maxValue - minValue) * Math.random()
      const trend = Math.sin(i * 0.1) * 20 + baseValue
      
      trends.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(Math.max(minValue, trend))
      })
    }
    
    return trends
  }

  // Helper functions for formatting
  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  function formatPercentage(num: number): string {
    return num.toFixed(1) + '%'
  }

  function getScoreColor(score: number): string {
    if (score >= 8) return 'danger'
    if (score >= 6) return 'warning'
    if (score >= 4) return 'info'
    return 'success'
  }

  // KPI definitions for dashboard cards
  const kpiDefinitions = [
    {
      id: 'totalAssets',
      title: 'Total Assets',
      icon: 'bi-hdd-stack',
      getValue: () => stats.value.totalAssets,
      getColor: () => 'primary',
      format: formatNumber
    },
    {
      id: 'activeAssets',
      title: 'Active Assets',
      icon: 'bi-check-circle',
      getValue: () => stats.value.activeAssets,
      getColor: () => 'success',
      format: formatNumber
    },
    {
      id: 'criticalVulnerabilities',
      title: 'Critical Vulnerabilities',
      icon: 'bi-exclamation-triangle',
      getValue: () => stats.value.criticalVulnerabilities,
      getColor: () => stats.value.criticalVulnerabilities > 0 ? 'danger' : 'success',
      format: formatNumber
    },
    {
      id: 'highRiskAssets',
      title: 'High Risk Assets',
      icon: 'bi-shield-exclamation',
      getValue: () => stats.value.highRiskAssets,
      getColor: () => stats.value.highRiskAssets > 0 ? 'warning' : 'success',
      format: formatNumber
    },
    {
      id: 'averageRiskScore',
      title: 'Average Risk Score',
      icon: 'bi-graph-up',
      getValue: () => stats.value.averageRiskScore,
      getColor: () => getScoreColor(stats.value.averageRiskScore),
      format: (num: number) => num.toFixed(1)
    },
    {
      id: 'complianceScore',
      title: 'Compliance Score',
      icon: 'bi-check2-square',
      getValue: () => stats.value.complianceScore,
      getColor: () => complianceLevel.value.color,
      format: formatPercentage
    },
    {
      id: 'recentAlerts',
      title: 'Recent Alerts',
      icon: 'bi-bell',
      getValue: () => stats.value.recentAlerts,
      getColor: () => stats.value.recentAlerts > 0 ? 'warning' : 'success',
      format: formatNumber
    },
    {
      id: 'patchingEfficiency',
      title: 'Patching Efficiency',
      icon: 'bi-patch-check',
      getValue: () => stats.value.patchingEfficiency,
      getColor: () => stats.value.patchingEfficiency >= 80 ? 'success' : 'warning',
      format: formatPercentage
    }
  ]

  return {
    // State
    stats,
    assetTrends,
    vulnerabilityTrends,
    riskTrends,
    isLoading,
    error,
    lastUpdated,
    
    // Getters
    riskLevel,
    complianceLevel,
    assetHealthPercentage,
    criticalVulnerabilityPercentage,
    assetTrendChartData,
    vulnerabilityTrendChartData,
    riskTrendChartData,
    riskDistributionChartData,
    
    // Actions
    fetchDashboardStats,
    fetchAssetTrends,
    fetchVulnerabilityTrends,
    fetchRiskTrends,
    refreshDashboard,
    clearError,
    
    // Helpers
    formatNumber,
    formatPercentage,
    getScoreColor,
    kpiDefinitions
  }
})