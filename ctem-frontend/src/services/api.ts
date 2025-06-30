import axios from 'axios'
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios'

// Types für API-Responses
export interface ApiResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

export interface ApiError {
  message: string
  code?: string
  status?: number
}

// Asset-Typen
export interface Asset {
  id: string
  name: string
  type: 'server' | 'workstation' | 'network_device' | 'application' | 'database' | 'cloud_resource'
  status: 'active' | 'inactive' | 'maintenance'
  criticality: 'critical' | 'high' | 'medium' | 'low'
  ipAddress?: string
  hostname?: string
  operatingSystem?: string
  lastSeen: string
  owner: string
  tags: string[]
  riskScore: number
  vulnerabilityCount: number
}

// Vulnerability-Typen
export interface Vulnerability {
  id: string
  cveId?: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cvssScore: number
  cvssVector?: string
  publishedDate: string
  lastModifiedDate: string
  affectedAssets: string[]
  status: 'open' | 'investigating' | 'mitigated' | 'false_positive' | 'risk_accepted'
  category: string
  solution?: string
  references: string[]
  exploitAvailable: boolean
  patchAvailable: boolean
}

// Risk-Typen
export interface Risk {
  id: string
  title: string
  description: string
  category: 'technical' | 'operational' | 'compliance' | 'strategic'
  likelihood: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
  impact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
  riskScore: number
  status: 'identified' | 'assessed' | 'mitigating' | 'mitigated' | 'accepted'
  owner: string
  dueDate?: string
  relatedAssets: string[]
  relatedVulnerabilities: string[]
  mitigationPlan?: string
}

// Dashboard-Statistiken
export interface DashboardStats {
  totalAssets: number
  activeAssets: number
  criticalVulnerabilities: number
  highRiskAssets: number
  averageRiskScore: number
  complianceScore: number
  recentAlerts: number
  patchingEfficiency: number
}

// Report-Typen
export interface Report {
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

// Compliance-Typen
export interface ComplianceFramework {
  id: string
  name: string
  version: string
  description?: string
  status: 'active' | 'inactive'
  controls: ComplianceControl[]
  score: number
  lastAssessed: string
}

export interface ComplianceControl {
  id: string
  frameworkId: string
  controlId: string
  title: string
  description: string
  category: string
  status: 'implemented' | 'partial' | 'missing'
  lastAssessed: string
  evidence?: string[]
  notes?: string
}

export interface ComplianceStatus {
  frameworkId: string
  overallScore: number
  controlCounts: {
    total: number
    implemented: number
    partial: number
    missing: number
  }
  gaps: ComplianceGap[]
}

export interface ComplianceGap {
  id: string
  frameworkId: string
  controlId: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  recommendation: string
}

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request Interceptor - für Auth Token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response Interceptor - für Error Handling
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      (error: AxiosError) => {
        const apiError: ApiError = {
          message: 'An unexpected error occurred',
          status: error.response?.status
        }

        if (error.response?.data) {
          const responseData = error.response.data as any
          apiError.message = responseData.message || responseData.error || apiError.message
          apiError.code = responseData.code
        } else if (error.request) {
          apiError.message = 'Network error - please check your connection'
        }

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token')
          window.location.href = '/login'
        }

        return Promise.reject(apiError)
      }
    )
  }

  // Authentication
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    const response = await this.api.post('/auth/login', { email, password })
    return response.data
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.api.post('/auth/logout')
    return response.data
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    const response = await this.api.post('/auth/refresh')
    return response.data
  }

  // Assets API
  async getAssets(params?: {
    page?: number
    limit?: number
    type?: string
    status?: string
    criticality?: string
    search?: string
  }): Promise<ApiResponse<{ assets: Asset[]; total: number; page: number; totalPages: number }>> {
    const response = await this.api.get('/assets', { params })
    return response.data
  }

  async getAsset(id: string): Promise<ApiResponse<Asset>> {
    const response = await this.api.get(`/assets/${id}`)
    return response.data
  }

  async createAsset(asset: Omit<Asset, 'id' | 'lastSeen' | 'riskScore' | 'vulnerabilityCount'>): Promise<ApiResponse<Asset>> {
    const response = await this.api.post('/assets', asset)
    return response.data
  }

  async updateAsset(id: string, asset: Partial<Asset>): Promise<ApiResponse<Asset>> {
    const response = await this.api.put(`/assets/${id}`, asset)
    return response.data
  }

  async deleteAsset(id: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/assets/${id}`)
    return response.data
  }

  // Vulnerabilities API
  async getVulnerabilities(params?: {
    page?: number
    limit?: number
    severity?: string
    status?: string
    assetId?: string
    search?: string
  }): Promise<ApiResponse<{ vulnerabilities: Vulnerability[]; total: number; page: number; totalPages: number }>> {
    const response = await this.api.get('/vulnerabilities', { params })
    return response.data
  }

  async getVulnerability(id: string): Promise<ApiResponse<Vulnerability>> {
    const response = await this.api.get(`/vulnerabilities/${id}`)
    return response.data
  }

  async updateVulnerabilityStatus(id: string, status: Vulnerability['status']): Promise<ApiResponse<Vulnerability>> {
    const response = await this.api.patch(`/vulnerabilities/${id}/status`, { status })
    return response.data
  }

  async createVulnerability(vulnerability: Omit<Vulnerability, 'id'>): Promise<ApiResponse<Vulnerability>> {
    const response = await this.api.post('/vulnerabilities', vulnerability)
    return response.data
  }

  async updateVulnerability(id: string, vulnerability: Partial<Vulnerability>): Promise<ApiResponse<Vulnerability>> {
    const response = await this.api.put(`/vulnerabilities/${id}`, vulnerability)
    return response.data
  }

  async deleteVulnerability(id: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/vulnerabilities/${id}`)
    return response.data
  }

  // Risks API
  async getRisks(params?: {
    page?: number
    limit?: number
    category?: string
    status?: string
    owner?: string
    search?: string
  }): Promise<ApiResponse<{ risks: Risk[]; total: number; page: number; totalPages: number }>> {
    const response = await this.api.get('/risks', { params })
    return response.data
  }

  async getRisk(id: string): Promise<ApiResponse<Risk>> {
    const response = await this.api.get(`/risks/${id}`)
    return response.data
  }

  async createRisk(risk: Omit<Risk, 'id' | 'riskScore'>): Promise<ApiResponse<Risk>> {
    const response = await this.api.post('/risks', risk)
    return response.data
  }

  async updateRisk(id: string, risk: Partial<Risk>): Promise<ApiResponse<Risk>> {
    const response = await this.api.put(`/risks/${id}`, risk)
    return response.data
  }

  async deleteRisk(id: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/risks/${id}`)
    return response.data
  }

  // Dashboard API
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const response = await this.api.get('/dashboard/stats')
    return response.data
  }

  async getAssetTrends(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<ApiResponse<any[]>> {
    const response = await this.api.get(`/dashboard/trends/assets?timeframe=${timeframe}`)
    return response.data
  }

  async getVulnerabilityTrends(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<ApiResponse<any[]>> {
    const response = await this.api.get(`/dashboard/trends/vulnerabilities?timeframe=${timeframe}`)
    return response.data
  }

  async getRiskTrends(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<ApiResponse<any[]>> {
    const response = await this.api.get(`/dashboard/trends/risks?timeframe=${timeframe}`)
    return response.data
  }

  // Reports API
  async generateReport(type: 'assets' | 'vulnerabilities' | 'risks' | 'compliance', params?: any): Promise<ApiResponse<{ reportId: string }>> {
    const response = await this.api.post('/reports/generate', { type, params })
    return response.data
  }

  async getReport(reportId: string): Promise<ApiResponse<Report>> {
    const response = await this.api.get(`/reports/${reportId}`)
    return response.data
  }

  async getReports(): Promise<ApiResponse<Report[]>> {
    const response = await this.api.get('/reports')
    return response.data
  }

  async deleteReport(reportId: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/reports/${reportId}`)
    return response.data
  }

  async downloadReport(reportId: string): Promise<Blob> {
    const response = await this.api.get(`/reports/${reportId}/download`, {
      responseType: 'blob'
    })
    return response.data
  }

  async scheduleReport(reportData: {
    type: string
    name: string
    schedule: any
    parameters?: any
  }): Promise<ApiResponse<Report>> {
    const response = await this.api.post('/reports/schedule', reportData)
    return response.data
  }

  async cancelReport(reportId: string): Promise<ApiResponse> {
    const response = await this.api.post(`/reports/${reportId}/cancel`)
    return response.data
  }

  // Compliance API
  async getComplianceFrameworks(): Promise<ApiResponse<ComplianceFramework[]>> {
    const response = await this.api.get('/compliance/frameworks')
    return response.data
  }

  async getComplianceFramework(frameworkId: string): Promise<ApiResponse<ComplianceFramework>> {
    const response = await this.api.get(`/compliance/frameworks/${frameworkId}`)
    return response.data
  }

  async createComplianceFramework(framework: Omit<ComplianceFramework, 'id' | 'score' | 'lastAssessed' | 'controls'>): Promise<ApiResponse<ComplianceFramework>> {
    const response = await this.api.post('/compliance/frameworks', framework)
    return response.data
  }

  async updateComplianceFramework(frameworkId: string, framework: Partial<ComplianceFramework>): Promise<ApiResponse<ComplianceFramework>> {
    const response = await this.api.put(`/compliance/frameworks/${frameworkId}`, framework)
    return response.data
  }

  async deleteComplianceFramework(frameworkId: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/compliance/frameworks/${frameworkId}`)
    return response.data
  }

  async getComplianceStatus(frameworkId?: string): Promise<ApiResponse<ComplianceStatus>> {
    const response = await this.api.get('/compliance/status', { params: { frameworkId } })
    return response.data
  }

  async getComplianceControls(frameworkId: string): Promise<ApiResponse<ComplianceControl[]>> {
    const response = await this.api.get(`/compliance/frameworks/${frameworkId}/controls`)
    return response.data
  }

  async updateComplianceControl(frameworkId: string, controlId: string, control: Partial<ComplianceControl>): Promise<ApiResponse<ComplianceControl>> {
    const response = await this.api.put(`/compliance/frameworks/${frameworkId}/controls/${controlId}`, control)
    return response.data
  }

  async assessComplianceControl(frameworkId: string, controlId: string, assessment: {
    status: ComplianceControl['status']
    evidence?: string[]
    notes?: string
  }): Promise<ApiResponse<ComplianceControl>> {
    const response = await this.api.post(`/compliance/frameworks/${frameworkId}/controls/${controlId}/assess`, assessment)
    return response.data
  }

  async getComplianceGaps(frameworkId?: string): Promise<ApiResponse<ComplianceGap[]>> {
    const response = await this.api.get('/compliance/gaps', { params: { frameworkId } })
    return response.data
  }

  // User Management API (for admin users)
  async getUsers(): Promise<ApiResponse<any[]>> {
    const response = await this.api.get('/users')
    return response.data
  }

  async getUser(userId: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/users/${userId}`)
    return response.data
  }

  async createUser(user: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/users', user)
    return response.data
  }

  async updateUser(userId: string, user: any): Promise<ApiResponse<any>> {
    const response = await this.api.put(`/users/${userId}`, user)
    return response.data
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/users/${userId}`)
    return response.data
  }

  // Settings API
  async getSettings(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/settings')
    return response.data
  }

  async updateSettings(settings: any): Promise<ApiResponse<any>> {
    const response = await this.api.put('/settings', settings)
    return response.data
  }

  // System API
  async getSystemInfo(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/system/info')
    return response.data
  }

  async getSystemHealth(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/system/health')
    return response.data
  }

  async getSystemLogs(params?: {
    level?: string
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<ApiResponse<any[]>> {
    const response = await this.api.get('/system/logs', { params })
    return response.data
  }

  // Scanning API
  async startScan(assetIds?: string[]): Promise<ApiResponse<{ scanId: string }>> {
    const response = await this.api.post('/scan/start', { assetIds })
    return response.data
  }

  async getScanStatus(scanId: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/scan/${scanId}/status`)
    return response.data
  }

  async getScanHistory(params?: {
    page?: number
    limit?: number
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<any>> {
    const response = await this.api.get('/scan/history', { params })
    return response.data
  }

  async cancelScan(scanId: string): Promise<ApiResponse> {
    const response = await this.api.post(`/scan/${scanId}/cancel`)
    return response.data
  }

  // Notifications API
  async getNotifications(params?: {
    page?: number
    limit?: number
    read?: boolean
    type?: string
  }): Promise<ApiResponse<any>> {
    const response = await this.api.get('/notifications', { params })
    return response.data
  }

  async markNotificationAsRead(notificationId: string): Promise<ApiResponse> {
    const response = await this.api.put(`/notifications/${notificationId}/read`)
    return response.data
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse> {
    const response = await this.api.put('/notifications/read-all')
    return response.data
  }

  async deleteNotification(notificationId: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/notifications/${notificationId}`)
    return response.data
  }
}

// Singleton Instance
export const apiService = new ApiService()
export default apiService