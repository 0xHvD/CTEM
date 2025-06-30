import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService, type ApiError } from '@/services/api'

interface Report {
  id: string
  name: string
  description: string
  type: 'assets' | 'vulnerabilities' | 'risks' | 'compliance'
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'scheduled'
  format: 'pdf' | 'excel' | 'csv' | 'html'
  createdAt: string
  completedAt?: string
  createdBy: string
  size?: number
  downloadUrl?: string
  progress?: number
  parameters?: Record<string, any>
  schedule?: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly'
    nextRun?: string
    lastRun?: string
  }
  recipients?: string[]
  error?: string
}

interface ReportFilters {
  search: string
  type: string
  status: string
  createdBy: string
  page: number
  limit: number
}

interface ReportStats {
  total: number
  completed: number
  inProgress: number
  scheduled: number
  failed: number
  byType: Record<string, number>
  byStatus: Record<string, number>
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  type: Report['type']
  icon: string
  color: string
  defaultParameters: Record<string, any>
}

export const useReportsStore = defineStore('reports', () => {
  // State
  const reports = ref<Report[]>([])
  const selectedReport = ref<Report | null>(null)
  const isLoading = ref(false)
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  const filters = ref<ReportFilters>({
    search: '',
    type: '',
    status: '',
    createdBy: '',
    page: 1,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  // Predefined report templates
  const reportTemplates = ref<ReportTemplate[]>([
    {
      id: 'vulnerability-assessment',
      name: 'Vulnerability Assessment',
      description: 'Comprehensive vulnerability assessment and analysis',
      type: 'vulnerabilities',
      icon: 'bi-shield-exclamation',
      color: 'danger',
      defaultParameters: {
        includeCritical: true,
        includeHigh: true,
        includeMedium: true,
        includeLow: false,
        includeInfo: false,
        includeExploitable: true,
        groupBySeverity: true,
        includeAssetDetails: true
      }
    },
    {
      id: 'asset-inventory',
      name: 'Asset Inventory',
      description: 'Complete asset inventory and status report',
      type: 'assets',
      icon: 'bi-hdd-stack',
      color: 'primary',
      defaultParameters: {
        includeInactive: false,
        groupByType: true,
        includeVulnerabilities: true,
        includeRiskScores: true,
        includeTags: true,
        includeOwnership: true
      }
    },
    {
      id: 'risk-assessment',
      name: 'Risk Assessment',
      description: 'Risk analysis and mitigation status',
      type: 'risks',
      icon: 'bi-exclamation-triangle',
      color: 'warning',
      defaultParameters: {
        includeCritical: true,
        includeHigh: true,
        includeMedium: true,
        includeLow: false,
        includeRiskMatrix: true,
        includeMitigationPlans: true,
        groupByCategory: true,
        includeOverdue: true
      }
    },
    {
      id: 'compliance-status',
      name: 'Compliance Status',
      description: 'Compliance framework status and gaps',
      type: 'compliance',
      icon: 'bi-check2-square',
      color: 'success',
      defaultParameters: {
        includeFrameworks: ['ISO27001', 'NIST', 'SOC2'],
        includeGaps: true,
        includeRecommendations: true,
        includeTimeline: true,
        groupByFramework: true
      }
    }
  ])

  // Getters
  const reportStats = computed<ReportStats>(() => {
    const stats: ReportStats = {
      total: reports.value.length,
      completed: 0,
      inProgress: 0,
      scheduled: 0,
      failed: 0,
      byType: {},
      byStatus: {}
    }

    reports.value.forEach(report => {
      // Count by status
      switch (report.status) {
        case 'completed':
          stats.completed++
          break
        case 'generating':
        case 'pending':
          stats.inProgress++
          break
        case 'scheduled':
          stats.scheduled++
          break
        case 'failed':
          stats.failed++
          break
      }

      // Count by type
      stats.byType[report.type] = (stats.byType[report.type] || 0) + 1

      // Count by status
      stats.byStatus[report.status] = (stats.byStatus[report.status] || 0) + 1
    })

    return stats
  })

  const filteredReports = computed(() => {
    let filtered = [...reports.value]

    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase()
      filtered = filtered.filter(report => 
        report.name.toLowerCase().includes(searchTerm) ||
        report.description.toLowerCase().includes(searchTerm) ||
        report.createdBy.toLowerCase().includes(searchTerm)
      )
    }

    if (filters.value.type) {
      filtered = filtered.filter(report => report.type === filters.value.type)
    }

    if (filters.value.status) {
      filtered = filtered.filter(report => report.status === filters.value.status)
    }

    if (filters.value.createdBy) {
      filtered = filtered.filter(report => 
        report.createdBy.toLowerCase().includes(filters.value.createdBy.toLowerCase())
      )
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return filtered
  })

  const recentReports = computed(() => {
    return reports.value
      .filter(report => report.status === 'completed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  })

  const scheduledReports = computed(() => {
    return reports.value.filter(report => report.status === 'scheduled')
  })

  const failedReports = computed(() => {
    return reports.value.filter(report => report.status === 'failed')
  })

  // Actions
  async function fetchReports() {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getReports()
      reports.value = response.data || []
      
      // Update pagination if available
      if (response.data && Array.isArray(response.data)) {
        pagination.value.total = response.data.length
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch reports:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchReport(reportId: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getReport(reportId)
      selectedReport.value = response.data
      
      // Update report in list if it exists
      const index = reports.value.findIndex(r => r.id === reportId)
      if (index !== -1) {
        reports.value[index] = response.data
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch report:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function generateReport(type: Report['type'], parameters?: Record<string, any>, name?: string, description?: string) {
    isGenerating.value = true
    error.value = null

    try {
      const response = await apiService.generateReport(type, {
        name,
        description,
        parameters
      })

      // Create new report entry
      const newReport: Report = {
        id: response.data.reportId,
        name: name || `${formatType(type)} Report`,
        description: description || `Auto-generated ${type} report`,
        type,
        status: 'generating',
        format: 'pdf',
        createdAt: new Date().toISOString(),
        createdBy: 'Current User', // This should come from auth store
        parameters,
        progress: 0
      }

      reports.value.unshift(newReport)
      
      // Start polling for status updates
      pollReportStatus(response.data.reportId)
      
      return newReport

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to generate report:', apiError)
      throw err
    } finally {
      isGenerating.value = false
    }
  }

  async function scheduleReport(
    type: Report['type'], 
    schedule: Report['schedule'], 
    parameters?: Record<string, any>,
    name?: string,
    description?: string,
    recipients?: string[]
  ) {
    isLoading.value = true
    error.value = null

    try {
      // For now, create a scheduled report entry
      // In a real implementation, this would call an API endpoint
      const scheduledReport: Report = {
        id: Date.now().toString(),
        name: name || `Scheduled ${formatType(type)} Report`,
        description: description || `Scheduled ${type} report`,
        type,
        status: 'scheduled',
        format: 'pdf',
        createdAt: new Date().toISOString(),
        createdBy: 'Current User',
        parameters,
        schedule,
        recipients
      }

      reports.value.unshift(scheduledReport)
      return scheduledReport

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to schedule report:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function cancelReport(reportId: string) {
    try {
      const report = reports.value.find(r => r.id === reportId)
      if (report && (report.status === 'generating' || report.status === 'scheduled')) {
        report.status = 'failed'
        report.error = 'Cancelled by user'
      }
      
      // In a real implementation, this would call an API to cancel the report
      console.log('Report cancelled:', reportId)

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to cancel report:', apiError)
    }
  }

  async function deleteReport(reportId: string) {
    try {
      const index = reports.value.findIndex(r => r.id === reportId)
      if (index !== -1) {
        reports.value.splice(index, 1)
      }

      if (selectedReport.value?.id === reportId) {
        selectedReport.value = null
      }

      // In a real implementation, this would call an API to delete the report
      console.log('Report deleted:', reportId)

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to delete report:', apiError)
    }
  }

  async function downloadReport(reportId: string) {
    try {
      const report = reports.value.find(r => r.id === reportId)
      if (!report || report.status !== 'completed' || !report.downloadUrl) {
        throw new Error('Report not available for download')
      }

      // Create download link
      const link = document.createElement('a')
      link.href = report.downloadUrl
      link.download = `${report.name}.${report.format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to download report:', apiError)
    }
  }

  function pollReportStatus(reportId: string) {
    const pollInterval = setInterval(async () => {
      try {
        const response = await apiService.getReport(reportId)
        const updatedReport = response.data

        const index = reports.value.findIndex(r => r.id === reportId)
        if (index !== -1) {
          reports.value[index] = updatedReport
        }

        // Stop polling if report is completed or failed
        if (updatedReport.status === 'completed' || updatedReport.status === 'failed') {
          clearInterval(pollInterval)
        }

      } catch (err) {
        console.error('Failed to poll report status:', err)
        clearInterval(pollInterval)
      }
    }, 5000) // Poll every 5 seconds
  }

  function setFilters(newFilters: Partial<ReportFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    
    if ('page' in newFilters === false) {
      filters.value.page = 1
    }
  }

  function clearFilters() {
    filters.value = {
      search: '',
      type: '',
      status: '',
      createdBy: '',
      page: 1,
      limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
    }
  }

  function setSelectedReport(report: Report | null) {
    selectedReport.value = report
  }

  function clearError() {
    error.value = null
  }

  // Utility functions
  function getReportTemplate(templateId: string): ReportTemplate | undefined {
    return reportTemplates.value.find(template => template.id === templateId)
  }

  function formatType(type: string): string {
    const typeLabels = {
      vulnerabilities: 'Vulnerability',
      assets: 'Asset',
      risks: 'Risk',
      compliance: 'Compliance'
    }
    return typeLabels[type as keyof typeof typeLabels] || type
  }

  function formatStatus(status: string): string {
    const statusLabels = {
      pending: 'Pending',
      generating: 'Generating',
      completed: 'Completed',
      failed: 'Failed',
      scheduled: 'Scheduled'
    }
    return statusLabels[status as keyof typeof statusLabels] || status
  }

  function getStatusColor(status: string): string {
    const colors = {
      pending: 'warning',
      generating: 'info',
      completed: 'success',
      failed: 'danger',
      scheduled: 'secondary'
    }
    return colors[status as keyof typeof colors] || 'secondary'
  }

  function getTypeColor(type: string): string {
    const colors = {
      vulnerabilities: 'danger',
      assets: 'primary',
      risks: 'warning',
      compliance: 'success'
    }
    return colors[type as keyof typeof colors] || 'secondary'
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  function isReportOverdue(report: Report): boolean {
    if (!report.schedule?.nextRun) return false
    
    const now = new Date()
    const nextRun = new Date(report.schedule.nextRun)
    
    return nextRun < now && report.status === 'scheduled'
  }

  function getReportProgress(reportId: string): number {
    const report = reports.value.find(r => r.id === reportId)
    return report?.progress || 0
  }

  // Report type labels for UI
  const reportTypeLabels = {
    'vulnerabilities': 'Vulnerability Report',
    'assets': 'Asset Report',
    'risks': 'Risk Report',
    'compliance': 'Compliance Report'
  }

  // Report status labels for UI
  const reportStatusLabels = {
    'pending': 'Pending',
    'generating': 'Generating',
    'completed': 'Completed',
    'failed': 'Failed',
    'scheduled': 'Scheduled'
  }

  // Report format options
  const reportFormats = [
    { value: 'pdf', label: 'PDF', icon: 'bi-file-pdf' },
    { value: 'excel', label: 'Excel', icon: 'bi-file-excel' },
    { value: 'csv', label: 'CSV', icon: 'bi-file-csv' },
    { value: 'html', label: 'HTML', icon: 'bi-file-code' }
  ]

  // Schedule frequency options
  const scheduleFrequencies = [
    { value: 'once', label: 'Generate Once' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ]

  return {
    // State
    reports,
    selectedReport,
    isLoading,
    isGenerating,
    error,
    pagination,
    filters,
    reportTemplates,
    
    // Getters
    reportStats,
    filteredReports,
    recentReports,
    scheduledReports,
    failedReports,
    
    // Actions
    fetchReports,
    fetchReport,
    generateReport,
    scheduleReport,
    cancelReport,
    deleteReport,
    downloadReport,
    setFilters,
    clearFilters,
    setSelectedReport,
    clearError,
    
    // Utility functions
    getReportTemplate,
    formatType,
    formatStatus,
    getStatusColor,
    getTypeColor,
    formatFileSize,
    isReportOverdue,
    getReportProgress,
    
    // Constants
    reportTypeLabels,
    reportStatusLabels,
    reportFormats,
    scheduleFrequencies
  }
})