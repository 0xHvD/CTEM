import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface DashboardMetrics {
  totalAssets: number
  activeVulnerabilities: number
  avgRiskScore: number
  complianceScore: number
  lastUpdated: Date
}

export interface SeverityDistribution {
  critical: number
  high: number
  medium: number
  low: number
}

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const metrics = ref<DashboardMetrics>({
    totalAssets: 247,
    activeVulnerabilities: 89,
    avgRiskScore: 6.7,
    complianceScore: 87,
    lastUpdated: new Date()
  })

  const severityData = ref<SeverityDistribution>({
    critical: 12,
    high: 28,
    medium: 34,
    low: 15
  })

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const totalVulnerabilities = computed(() => 
    severityData.value.critical + 
    severityData.value.high + 
    severityData.value.medium + 
    severityData.value.low
  )

  const criticalPercentage = computed(() => 
    Math.round((severityData.value.critical / totalVulnerabilities.value) * 100)
  )

  const riskLevel = computed(() => {
    if (metrics.value.avgRiskScore >= 8) return 'high'
    if (metrics.value.avgRiskScore >= 5) return 'medium'
    return 'low'
  })

  // Actions
  async function fetchMetrics(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Mock data update with some variance
      metrics.value = {
        totalAssets: 247 + Math.floor(Math.random() * 10 - 5),
        activeVulnerabilities: 89 + Math.floor(Math.random() * 20 - 10),
        avgRiskScore: Number((6.7 + (Math.random() * 2 - 1)).toFixed(1)),
        complianceScore: 87 + Math.floor(Math.random() * 6 - 3),
        lastUpdated: new Date()
      }
    } catch (err) {
      error.value = 'Failed to fetch dashboard metrics'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function updateSeverityData(newData: Partial<SeverityDistribution>): void {
    severityData.value = { ...severityData.value, ...newData }
  }

  return {
    // State
    metrics,
    severityData,
    isLoading,
    error,
    // Getters
    totalVulnerabilities,
    criticalPercentage,
    riskLevel,
    // Actions
    fetchMetrics,
    updateSeverityData
  }
})