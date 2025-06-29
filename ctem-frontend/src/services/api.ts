import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'

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

  async getReport(reportId: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/reports/${reportId}`)
    return response.data
  }

  async getReports(): Promise<ApiResponse<any[]>> {
    const response = await this.api.get('/reports')
    return response.data
  }

  // Compliance API
  async getComplianceFrameworks(): Promise<ApiResponse<any[]>> {
    const response = await this.api.get('/compliance/frameworks')
    return response.data
  }

  async getComplianceStatus(frameworkId?: string): Promise<ApiResponse<any>> {
    const response = await this.api.get('/compliance/status', { params: { frameworkId } })
    return response.data
  }
}

// Singleton Instance
export const apiService = new ApiService()
export default apiService