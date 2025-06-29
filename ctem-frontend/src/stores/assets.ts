import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface Asset {
  id: string
  name: string
  type: 'Web Server' | 'Database' | 'Load Balancer' | 'API Gateway' | 'Mail Server'
  ipAddress?: string
  location?: string
  riskScore: number
  vulnCount: number
  status: 'Active' | 'Inactive' | 'Maintenance'
  lastScan?: Date
  tags?: string[]
}

export const useAssetsStore = defineStore('assets', () => {
  // State
  const assets = ref<Asset[]>([
    {
      id: '1',
      name: 'Production Web Server',
      type: 'Web Server',
      ipAddress: '192.168.1.100',
      location: 'Data Center A',
      riskScore: 9.2,
      vulnCount: 5,
      status: 'Active',
      lastScan: new Date('2024-01-15'),
      tags: ['production', 'critical']
    },
    {
      id: '2',
      name: 'Customer Database',
      type: 'Database',
      ipAddress: '192.168.1.200',
      location: 'Data Center A',
      riskScore: 8.7,
      vulnCount: 3,
      status: 'Active',
      lastScan: new Date('2024-01-14'),
      tags: ['production', 'sensitive']
    },
    {
      id: '3',
      name: 'API Gateway',
      type: 'API Gateway',
      ipAddress: '192.168.1.50',
      location: 'Data Center B',
      riskScore: 7.4,
      vulnCount: 7,
      status: 'Active',
      lastScan: new Date('2024-01-13'),
      tags: ['production']
    }
  ])

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const topRiskAssets = computed(() =>
    assets.value
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5)
  )

  const activeAssets = computed(() =>
    assets.value.filter(a => a.status === 'Active')
  )

  const criticalAssets = computed(() =>
    assets.value.filter(a => a.riskScore >= 8.0)
  )

  const assetsByType = computed(() => {
    return assets.value.reduce((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  })

  // Actions
  async function fetchAssets(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      // Data is already set
    } catch (err) {
      error.value = 'Failed to fetch assets'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function updateAssetStatus(id: string, status: Asset['status']): void {
    const asset = assets.value.find(a => a.id === id)
    if (asset) {
      asset.status = status
    }
  }

  return {
    // State
    assets,
    isLoading,
    error,
    // Getters
    topRiskAssets,
    activeAssets,
    criticalAssets,
    assetsByType,
    // Actions
    fetchAssets,
    updateAssetStatus
  }
})
