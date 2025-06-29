import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService, type Asset, type ApiError } from '@/services/api'

interface AssetFilters {
  search: string
  type: string
  status: string
  criticality: string
  page: number
  limit: number
}

interface AssetStats {
  total: number
  active: number
  inactive: number
  critical: number
  high: number
  medium: number
  low: number
}

export const useAssetsStore = defineStore('assets', () => {
  // State
  const assets = ref<Asset[]>([])
  const selectedAsset = ref<Asset | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  const filters = ref<AssetFilters>({
    search: '',
    type: '',
    status: '',
    criticality: '',
    page: 1,
    limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
  })

  // Getters
  const assetStats = computed<AssetStats>(() => {
    return {
      total: assets.value.length,
      active: assets.value.filter(a => a.status === 'active').length,
      inactive: assets.value.filter(a => a.status === 'inactive').length,
      critical: assets.value.filter(a => a.criticality === 'critical').length,
      high: assets.value.filter(a => a.criticality === 'high').length,
      medium: assets.value.filter(a => a.criticality === 'medium').length,
      low: assets.value.filter(a => a.criticality === 'low').length
    }
  })

  const assetsByType = computed(() => {
    const typeMap = new Map<string, number>()
    assets.value.forEach(asset => {
      const count = typeMap.get(asset.type) || 0
      typeMap.set(asset.type, count + 1)
    })
    return Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }))
  })

  const assetsByCriticality = computed(() => {
    const criticalityMap = new Map<string, number>()
    assets.value.forEach(asset => {
      const count = criticalityMap.get(asset.criticality) || 0
      criticalityMap.set(asset.criticality, count + 1)
    })
    return Array.from(criticalityMap.entries()).map(([criticality, count]) => ({ criticality, count }))
  })

  const highRiskAssets = computed(() => {
    return assets.value.filter(asset => asset.riskScore >= 7.0)
  })

  const filteredAssets = computed(() => {
    let filtered = [...assets.value]

    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase()
      filtered = filtered.filter(asset => 
        asset.name.toLowerCase().includes(searchTerm) ||
        asset.hostname?.toLowerCase().includes(searchTerm) ||
        asset.ipAddress?.toLowerCase().includes(searchTerm) ||
        asset.owner.toLowerCase().includes(searchTerm)
      )
    }

    if (filters.value.type) {
      filtered = filtered.filter(asset => asset.type === filters.value.type)
    }

    if (filters.value.status) {
      filtered = filtered.filter(asset => asset.status === filters.value.status)
    }

    if (filters.value.criticality) {
      filtered = filtered.filter(asset => asset.criticality === filters.value.criticality)
    }

    return filtered
  })

  // Actions
  async function fetchAssets() {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getAssets({
        page: filters.value.page,
        limit: filters.value.limit,
        search: filters.value.search || undefined,
        type: filters.value.type || undefined,
        status: filters.value.status || undefined,
        criticality: filters.value.criticality || undefined
      })

      assets.value = response.data.assets
      pagination.value = {
        page: response.data.page,
        totalPages: response.data.totalPages,
        total: response.data.total,
        limit: filters.value.limit
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch assets:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAsset(id: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.getAsset(id)
      selectedAsset.value = response.data
      
      // Update asset in list if it exists
      const index = assets.value.findIndex(a => a.id === id)
      if (index !== -1) {
        assets.value[index] = response.data
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to fetch asset:', apiError)
    } finally {
      isLoading.value = false
    }
  }

  async function createAsset(assetData: Omit<Asset, 'id' | 'lastSeen' | 'riskScore' | 'vulnerabilityCount'>) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.createAsset(assetData)
      assets.value.unshift(response.data)
      return response.data
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to create asset:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateAsset(id: string, assetData: Partial<Asset>) {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiService.updateAsset(id, assetData)
      
      // Update in list
      const index = assets.value.findIndex(a => a.id === id)
      if (index !== -1) {
        assets.value[index] = response.data
      }

      // Update selected asset if it's the same
      if (selectedAsset.value?.id === id) {
        selectedAsset.value = response.data
      }

      return response.data
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to update asset:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteAsset(id: string) {
    isLoading.value = true
    error.value = null

    try {
      await apiService.deleteAsset(id)
      
      // Remove from list
      const index = assets.value.findIndex(a => a.id === id)
      if (index !== -1) {
        assets.value.splice(index, 1)
      }

      // Clear selected asset if it's the same
      if (selectedAsset.value?.id === id) {
        selectedAsset.value = null
      }

    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError.message
      console.error('Failed to delete asset:', apiError)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function setFilters(newFilters: Partial<AssetFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    
    // Reset page if filters changed (except page itself)
    if ('page' in newFilters === false) {
      filters.value.page = 1
    }
  }

  function clearFilters() {
    filters.value = {
      search: '',
      type: '',
      status: '',
      criticality: '',
      page: 1,
      limit: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20
    }
  }

  function setSelectedAsset(asset: Asset | null) {
    selectedAsset.value = asset
  }

  function clearError() {
    error.value = null
  }

  // Asset type labels for UI
  const assetTypeLabels = {
    'server': 'Server',
    'workstation': 'Workstation',
    'network_device': 'Network Device',
    'application': 'Application',
    'database': 'Database',
    'cloud_resource': 'Cloud Resource'
  }

  // Asset status labels for UI
  const assetStatusLabels = {
    'active': 'Active',
    'inactive': 'Inactive',
    'maintenance': 'Maintenance'
  }

  // Criticality labels for UI
  const criticalityLabels = {
    'critical': 'Critical',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
  }

  return {
    // State
    assets,
    selectedAsset,
    isLoading,
    error,
    pagination,
    filters,
    
    // Getters
    assetStats,
    assetsByType,
    assetsByCriticality,
    highRiskAssets,
    filteredAssets,
    
    // Actions
    fetchAssets,
    fetchAsset,
    createAsset,
    updateAsset,
    deleteAsset,
    setFilters,
    clearFilters,
    setSelectedAsset,
    clearError,
    
    // Constants
    assetTypeLabels,
    assetStatusLabels,
    criticalityLabels
  }
})