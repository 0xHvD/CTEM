import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService, type Risk, type ApiError } from '@/services/api'

interface RiskFilters {
  search: string
  category: string
  status: string
  owner: string
  page: number
  limit: number
}

interface RiskStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  identified: number
  assessed: number
  mitigating: number
  mitigated: number
  accepted: number
  overdue: number
}

export const useRisksStore = defineStore('risks', () => {
  // State
  const risks = ref<Risk[]>([])
  const selectedRisk = ref<Risk | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  const filters = ref<RiskFilters>({
    search: '',
    category: '',
    status: '',
    owner: '',
    page: 1,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  // Getters
  const riskStats = computed<RiskStats>(() => {
    const now = new Date()
    return {
      total: risks.value.length,
      critical: risks.value.filter(r => r.riskScore >= 8).length,
      high: risks.value.filter(r => r.riskScore >= 6 && r.riskScore < 8).length,
      medium: risks.value.filter(r => r.riskScore >= 4 && r.riskScore < 6).length,
      low: risks.value.filter(r => r.riskScore < 4).length,
      identified: risks.value.filter(r => r.status === 'identified').length,
      assessed: risks.value.filter(r => r.status === 'assessed').length,
      mitigating: risks.value.filter(r => r.status === 'mitigating').length,
      mitigated: risks.value.filter(r => r.status === 'mitigated').length,
      accepted: risks.value.filter(r => r.status === 'accepted').length,
      overdue: risks.value.filter(r => r.dueDate && new Date(r.dueDate) < now && r.status !== 'mitigated').length
    }
  })

  const risksByCategory = computed(() => {
    const categoryMap = new Map<string, number>()
    risks.value.forEach(risk => {
      const count = categoryMap.get(risk.category) || 0
      categoryMap.set(risk.category, count + 1)
    })
    return Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }))
  })

  const risksByStatus = computed(() => {
    const statusMap = new Map<string, number>()
    risks.value.forEach(risk => {
      const count = statusMap.get(risk.status) || 0
      statusMap.set(risk.status, count + 1)
    })
    return Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))
  })

  const risksByOwner = computed(() => {
    const ownerMap = new Map<string, number>()
    risks.value.forEach(risk => {
      const count = ownerMap.get(risk.owner) || 0
      ownerMap.set(risk.owner, count + 1)
    })
    return Array.from(ownerMap.entries()).map(([owner, count]) => ({ owner, count }))
  })

  const criticalRisks = computed(() => {
    return risks.value.filter(risk => risk.riskScore >= 8.0)
  })

  const overdueRisks = computed(() => {
    const now = new Date()
    return risks.value.filter(risk => 
      risk.dueDate && 
      new Date(risk.dueDate) < now && 
      risk.status !== 'mitigated' && 
      risk.status !== 'accepted'
    )
  })

  const averageRiskScore = computed(() => {
    if (risks.value.length === 0) return 0
    const total = risks.value.reduce((sum, risk) => sum + risk.riskScore, 0)
    return Math.round((total / risks.value.length) * 10) / 10
  })

  const filteredRisks = computed(() => {
    let filtered = [...risks.value]

    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase()
      filtered = filtered.filter(risk => 
        risk.title.toLowerCase().includes(searchTerm) ||
        risk.description.toLowerCase().includes(searchTerm) ||
        risk.owner.toLowerCase().includes(searchTerm)
      )
    }

    if (filters.value.category) {
      filtered = filtered.filter(risk => risk.category === filters.value.category)
    }

    if (filters.value.status) {
      filtered = filtered.filter(risk => risk.status === filters.value.status)
    }

    if (filters.value.owner) {
      filtered = filtered.filter(risk => risk.owner === filters.value.owner)
    }

    return filtered
  })

  // Actions
  async function fetchRisks() {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getRisks({
        page: filters.value.page,
        limit: filters.value.limit,
        search: filters.value.search || undefined,
        category: filters.value.category || undefined,
        status: filters.value.status || undefined,
        owner: filters.value.owner || undefined
      })

      risks.value = response.data.risks
      pagination.value = {
        page: response.data.page,
        totalPages: response.data.totalPages,
        total: response.data.total,
        limit: filters.value.limit
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch risks:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchRisk(id: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getRisk(id)
      selectedRisk.value = response.data
      
      // Update risk in list if it exists
      const index = risks.value.findIndex(r => r.id === id)
      if (index !== -1) {
        risks.value[index] = response.data
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch risk:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function createRisk(riskData: Omit<Risk, 'id' | 'riskScore'>) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.createRisk(riskData)
      risks.value.unshift(response.data)
      return response.data
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to create risk:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateRisk(id: string, riskData: Partial<Risk>) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.updateRisk(id, riskData)
      
      // Update in list
      const index = risks.value.findIndex(r => r.id === id)
      if (index !== -1) {
        risks.value[index] = response.data
      }

      // Update selected risk if it's the same
      if (selectedRisk.value?.id === id) {
        selectedRisk.value = response.data
      }

      return response.data
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to update risk:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteRisk(id: string) {
    isLoading.value = true
    error.value = null

    try {
      await apiService.deleteRisk(id)
      
      // Remove from list
      const index = risks.value.findIndex(r => r.id === id)
      if (index !== -1) {
        risks.value.splice(index, 1)
      }

      // Clear selected risk if it's the same
      if (selectedRisk.value?.id === id) {
        selectedRisk.value = null
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to delete risk:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function setFilters(newFilters: Partial<RiskFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    
    // Reset page if filters changed (except page itself)
    if ('page' in newFilters === false) {
      filters.value.page = 1
    }
  }

  function clearFilters() {
    filters.value = {
      search: '',
      category: '',
      status: '',
      owner: '',
      page: 1,
      limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
    }
  }

  function setSelectedRisk(risk: Risk | null) {
    selectedRisk.value = risk
  }

  function clearError() {
    error.value = null
  }

  // Calculate risk score based on likelihood and impact
  function calculateRiskScore(likelihood: Risk['likelihood'], impact: Risk['impact']): number {
    const likelihoodScores = {
      very_low: 1,
      low: 2,
      medium: 3,
      high: 4,
      very_high: 5
    }

    const impactScores = {
      very_low: 1,
      low: 2,
      medium: 3,
      high: 4,
      very_high: 5
    }

    const likelihoodScore = likelihoodScores[likelihood] || 3
    const impactScore = impactScores[impact] || 3
    
    // Calculate risk score (1-10 scale)
    return Math.round((likelihoodScore * impactScore * 2) / 5 * 10) / 10
  }

  // Get risk level based on score
  function getRiskLevel(score: number): { level: string; color: string; text: string } {
    if (score >= 8) return { level: 'critical', color: 'danger', text: 'Critical Risk' }
    if (score >= 6) return { level: 'high', color: 'warning', text: 'High Risk' }
    if (score >= 4) return { level: 'medium', color: 'info', text: 'Medium Risk' }
    return { level: 'low', color: 'success', text: 'Low Risk' }
  }

  // Get color class for risk score
  function getRiskScoreColor(score: number): string {
    if (score >= 8) return 'text-danger'
    if (score >= 6) return 'text-warning'
    if (score >= 4) return 'text-info'
    return 'text-success'
  }

  // Check if risk is overdue
  function isRiskOverdue(risk: Risk): boolean {
    if (!risk.dueDate) return false
    const now = new Date()
    const dueDate = new Date(risk.dueDate)
    return dueDate < now && risk.status !== 'mitigated' && risk.status !== 'accepted'
  }

  // Get days until due date
  function getDaysUntilDue(dueDate: string): number {
    const now = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Risk matrix functions
  function getRiskMatrixData() {
    const matrix = {
      very_low: { very_low: 0, low: 0, medium: 0, high: 0, very_high: 0 },
      low: { very_low: 0, low: 0, medium: 0, high: 0, very_high: 0 },
      medium: { very_low: 0, low: 0, medium: 0, high: 0, very_high: 0 },
      high: { very_low: 0, low: 0, medium: 0, high: 0, very_high: 0 },
      very_high: { very_low: 0, low: 0, medium: 0, high: 0, very_high: 0 }
    }

    risks.value.forEach(risk => {
      if (matrix[risk.likelihood] && matrix[risk.likelihood][risk.impact] !== undefined) {
        matrix[risk.likelihood][risk.impact]++
      }
    })

    return matrix
  }

  // Category labels for UI
  const categoryLabels = {
    'technical': 'Technical',
    'operational': 'Operational',
    'compliance': 'Compliance',
    'strategic': 'Strategic'
  }

  // Status labels for UI
  const statusLabels = {
    'identified': 'Identified',
    'assessed': 'Assessed',
    'mitigating': 'Mitigating',
    'mitigated': 'Mitigated',
    'accepted': 'Accepted'
  }

  // Likelihood labels for UI
  const likelihoodLabels = {
    'very_low': 'Very Low',
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'very_high': 'Very High'
  }

  // Impact labels for UI
  const impactLabels = {
    'very_low': 'Very Low',
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'very_high': 'Very High'
  }

  return {
    // State
    risks,
    selectedRisk,
    isLoading,
    error,
    pagination,
    filters,
    
    // Getters
    riskStats,
    risksByCategory,
    risksByStatus,
    risksByOwner,
    criticalRisks,
    overdueRisks,
    averageRiskScore,
    filteredRisks,
    
    // Actions
    fetchRisks,
    fetchRisk,
    createRisk,
    updateRisk,
    deleteRisk,
    setFilters,
    clearFilters,
    setSelectedRisk,
    clearError,
    
    // Utility functions
    calculateRiskScore,
    getRiskLevel,
    getRiskScoreColor,
    isRiskOverdue,
    getDaysUntilDue,
    getRiskMatrixData,
    
    // Constants
    categoryLabels,
    statusLabels,
    likelihoodLabels,
    impactLabels
  }
})