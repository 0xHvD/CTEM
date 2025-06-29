import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService, type Vulnerability, type ApiError } from '@/services/api'

interface VulnerabilityFilters {
  search: string
  severity: string
  status: string
  assetId: string
  page: number
  limit: number
}

interface VulnerabilityStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
  open: number
  investigating: number
  mitigated: number
  withExploits: number
  withPatches: number
}

export const useVulnerabilitiesStore = defineStore('vulnerabilities', () => {
  // State
  const vulnerabilities = ref<Vulnerability[]>([])
  const selectedVulnerability = ref<Vulnerability | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  const filters = ref<VulnerabilityFilters>({
    search: '',
    severity: '',
    status: '',
    assetId: '',
    page: 1,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  // Getters
  const vulnerabilityStats = computed<VulnerabilityStats>(() => {
    return {
      total: vulnerabilities.value.length,
      critical: vulnerabilities.value.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.value.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.value.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.value.filter(v => v.severity === 'low').length,
      info: vulnerabilities.value.filter(v => v.severity === 'info').length,
      open: vulnerabilities.value.filter(v => v.status === 'open').length,
      investigating: vulnerabilities.value.filter(v => v.status === 'investigating').length,
      mitigated: vulnerabilities.value.filter(v => v.status === 'mitigated').length,
      withExploits: vulnerabilities.value.filter(v => v.exploitAvailable).length,
      withPatches: vulnerabilities.value.filter(v => v.patchAvailable).length
    }
  })

  const vulnerabilitiesBySeverity = computed(() => {
    const severityMap = new Map<string, number>()
    vulnerabilities.value.forEach(vuln => {
      const count = severityMap.get(vuln.severity) || 0
      severityMap.set(vuln.severity, count + 1)
    })
    return Array.from(severityMap.entries()).map(([severity, count]) => ({ severity, count }))
  })

  const vulnerabilitiesByStatus = computed(() => {
    const statusMap = new Map<string, number>()
    vulnerabilities.value.forEach(vuln => {
      const count = statusMap.get(vuln.status) || 0
      statusMap.set(vuln.status, count + 1)
    })
    return Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))
  })

  const vulnerabilitiesByCategory = computed(() => {
    const categoryMap = new Map<string, number>()
    vulnerabilities.value.forEach(vuln => {
      const count = categoryMap.get(vuln.category) || 0
      categoryMap.set(vuln.category, count + 1)
    })
    return Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }))
  })

  const criticalVulnerabilities = computed(() => {
    return vulnerabilities.value.filter(vuln => vuln.severity === 'critical' && vuln.status === 'open')
  })

  const exploitableVulnerabilities = computed(() => {
    return vulnerabilities.value.filter(vuln => vuln.exploitAvailable && vuln.status === 'open')
  })

  const averageCvssScore = computed(() => {
    if (vulnerabilities.value.length === 0) return 0
    const total = vulnerabilities.value.reduce((sum, vuln) => sum + vuln.cvssScore, 0)
    return Math.round((total / vulnerabilities.value.length) * 10) / 10
  })

  const filteredVulnerabilities = computed(() => {
    let filtered = [...vulnerabilities.value]

    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase()
      filtered = filtered.filter(vuln => 
        vuln.title.toLowerCase().includes(searchTerm) ||
        vuln.description.toLowerCase().includes(searchTerm) ||
        vuln.cveId?.toLowerCase().includes(searchTerm) ||
        vuln.category.toLowerCase().includes(searchTerm)
      )
    }

    if (filters.value.severity) {
      filtered = filtered.filter(vuln => vuln.severity === filters.value.severity)
    }

    if (filters.value.status) {
      filtered = filtered.filter(vuln => vuln.status === filters.value.status)
    }

    if (filters.value.assetId) {
      filtered = filtered.filter(vuln => vuln.affectedAssets.includes(filters.value.assetId))
    }

    return filtered
  })

  // Actions
  async function fetchVulnerabilities() {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getVulnerabilities({
        page: filters.value.page,
        limit: filters.value.limit,
        search: filters.value.search || undefined,
        severity: filters.value.severity || undefined,
        status: filters.value.status || undefined,
        assetId: filters.value.assetId || undefined
      })

      vulnerabilities.value = response.data.vulnerabilities
      pagination.value = {
        page: response.data.page,
        totalPages: response.data.totalPages,
        total: response.data.total,
        limit: filters.value.limit
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch vulnerabilities:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchVulnerability(id: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getVulnerability(id)
      selectedVulnerability.value = response.data
      
      // Update vulnerability in list if it exists
      const index = vulnerabilities.value.findIndex(v => v.id === id)
      if (index !== -1) {
        vulnerabilities.value[index] = response.data
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch vulnerability:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function updateVulnerabilityStatus(id: string, status: Vulnerability['status']) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.updateVulnerabilityStatus(id, status)
      
      // Update in list
      const index = vulnerabilities.value.findIndex(v => v.id === id)
      if (index !== -1) {
        vulnerabilities.value[index] = response.data
      }

      // Update selected vulnerability if it's the same
      if (selectedVulnerability.value?.id === id) {
        selectedVulnerability.value = response.data
      }

      return response.data
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to update vulnerability status:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function setFilters(newFilters: Partial<VulnerabilityFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    
    // Reset page if filters changed (except page itself)
    if ('page' in newFilters === false) {
      filters.value.page = 1
    }
  }

  function clearFilters() {
    filters.value = {
      search: '',
      severity: '',
      status: '',
      assetId: '',
      page: 1,
      limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
    }
  }

  function setSelectedVulnerability(vulnerability: Vulnerability | null) {
    selectedVulnerability.value = vulnerability
  }

  function clearError() {
    error.value = null
  }

  // Get vulnerability severity color class
  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-danger'
      case 'high': return 'text-warning'
      case 'medium': return 'text-info'
      case 'low': return 'text-success'
      case 'info': return 'text-secondary'
      default: return 'text-muted'
    }
  }

  // Get vulnerability status color class
  function getStatusColor(status: string): string {
    switch (status) {
      case 'open': return 'text-danger'
      case 'investigating': return 'text-warning'
      case 'mitigated': return 'text-success'
      case 'false_positive': return 'text-secondary'
      case 'risk_accepted': return 'text-info'
      default: return 'text-muted'
    }
  }

  // Get CVSS score color class
  function getCvssColor(score: number): string {
    if (score >= 9.0) return 'text-danger'
    if (score >= 7.0) return 'text-warning'
    if (score >= 4.0) return 'text-info'
    return 'text-success'
  }

  // Severity labels for UI
  const severityLabels = {
    'critical': 'Critical',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
    'info': 'Info'
  }

  // Status labels for UI
  const statusLabels = {
    'open': 'Open',
    'investigating': 'Investigating',
    'mitigated': 'Mitigated',
    'false_positive': 'False Positive',
    'risk_accepted': 'Risk Accepted'
  }

  return {
    // State
    vulnerabilities,
    selectedVulnerability,
    isLoading,
    error,
    pagination,
    filters,
    
    // Getters
    vulnerabilityStats,
    vulnerabilitiesBySeverity,
    vulnerabilitiesByStatus,
    vulnerabilitiesByCategory,
    criticalVulnerabilities,
    exploitableVulnerabilities,
    averageCvssScore,
    filteredVulnerabilities,
    
    // Actions
    fetchVulnerabilities,
    fetchVulnerability,
    updateVulnerabilityStatus,
    setFilters,
    clearFilters,
    setSelectedVulnerability,
    clearError,
    getSeverityColor,
    getStatusColor,
    getCvssColor,
    
    // Constants
    severityLabels,
    statusLabels
  }
})

  