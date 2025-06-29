import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface Vulnerability {
  id: string
  asset: string
  assetType: string
  title: string
  description?: string
  cve: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  riskScore: number
  detected: Date
  status: 'Open' | 'In Progress' | 'Resolved' | 'Accepted'
  assignee?: string
}

export const useVulnerabilitiesStore = defineStore('vulnerabilities', () => {
  // State
  const vulnerabilities = ref<Vulnerability[]>([
    {
      id: '1',
      asset: 'Web Server 01',
      assetType: 'Apache HTTP Server',
      title: 'SQL Injection Vulnerability',
      cve: 'CVE-2024-0001',
      severity: 'Critical',
      riskScore: 9.8,
      detected: new Date('2024-01-15'),
      status: 'Open'
    },
    {
      id: '2',
      asset: 'Database Server',
      assetType: 'MySQL 8.0',
      title: 'Authentication Bypass',
      cve: 'CVE-2024-0002',
      severity: 'High',
      riskScore: 8.5,
      detected: new Date('2024-01-14'),
      status: 'In Progress',
      assignee: 'John Doe'
    },
    {
      id: '3',
      asset: 'Mail Server',
      assetType: 'Postfix',
      title: 'Buffer Overflow',
      cve: 'CVE-2024-0003',
      severity: 'Medium',
      riskScore: 6.2,
      detected: new Date('2024-01-13'),
      status: 'Open'
    }
  ])

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const recentVulnerabilities = computed(() => 
    vulnerabilities.value
      .sort((a, b) => b.detected.getTime() - a.detected.getTime())
      .slice(0, 5)
  )

  const criticalVulnerabilities = computed(() =>
    vulnerabilities.value.filter(v => v.severity === 'Critical')
  )

  const openVulnerabilities = computed(() =>
    vulnerabilities.value.filter(v => v.status === 'Open')
  )

  const vulnerabilitiesBySeverity = computed(() => {
    return vulnerabilities.value.reduce((acc, vuln) => {
      acc[vuln.severity.toLowerCase()] = (acc[vuln.severity.toLowerCase()] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  })

  // Actions
  async function fetchVulnerabilities(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Data is already set in state
    } catch (err) {
      error.value = 'Failed to fetch vulnerabilities'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function updateVulnerabilityStatus(id: string, status: Vulnerability['status']): void {
    const vuln = vulnerabilities.value.find(v => v.id === id)
    if (vuln) {
      vuln.status = status
    }
  }

  function assignVulnerability(id: string, assignee: string): void {
    const vuln = vulnerabilities.value.find(v => v.id === id)
    if (vuln) {
      vuln.assignee = assignee
      vuln.status = 'In Progress'
    }
  }

  return {
    // State
    vulnerabilities,
    isLoading,
    error,
    // Getters
    recentVulnerabilities,
    criticalVulnerabilities,
    openVulnerabilities,
    vulnerabilitiesBySeverity,
    // Actions
    fetchVulnerabilities,
    updateVulnerabilityStatus,
    assignVulnerability
  }
})