<template>
  <div class="assets-view">
    <!-- Page Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Asset Management</h1>
        <p class="text-muted mb-0">Manage and monitor your IT assets</p>
      </div>
      <button class="btn btn-primary">
        <i class="bi bi-plus-circle me-2"></i>Add Asset
      </button>
    </div>

    <!-- Filters and Search -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row">
          <div class="col-md-4">
            <div class="input-group">
              <span class="input-group-text">
                <i class="bi bi-search"></i>
              </span>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Search assets..."
                v-model="searchTerm"
              >
            </div>
          </div>
          <div class="col-md-3">
            <select class="form-select" v-model="selectedType">
              <option value="">All Types</option>
              <option value="server">Server</option>
              <option value="application">Application</option>
              <option value="network_device">Network Device</option>
              <option value="database">Database</option>
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select" v-model="selectedCriticality">
              <option value="">All Criticality</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-outline-secondary w-100">
              <i class="bi bi-funnel"></i> Filter
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Assets Table -->
    <div class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Criticality</th>
                <th>IP Address</th>
                <th>Owner</th>
                <th>Vulnerabilities</th>
                <th>Last Scan</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="asset in filteredAssets" :key="asset.id">
                <td>
                  <div class="fw-bold">{{ asset.name }}</div>
                  <small class="text-muted">{{ asset.description }}</small>
                </td>
                <td>
                  <span class="badge bg-light text-dark">{{ asset.type }}</span>
                </td>
                <td>
                  <span 
                    class="badge"
                    :class="getCriticalityClass(asset.criticality)"
                  >
                    {{ asset.criticality }}
                  </span>
                </td>
                <td>
                  <code>{{ asset.ipAddress }}</code>
                </td>
                <td>{{ asset.owner }}</td>
                <td>
                  <span 
                    class="badge"
                    :class="asset.vulnCount > 0 ? 'bg-danger' : 'bg-success'"
                  >
                    {{ asset.vulnCount }}
                  </span>
                </td>
                <td>
                  <small>{{ formatDate(asset.lastScan) }}</small>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" title="View Details">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-secondary" title="Edit">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-info" title="Scan">
                      <i class="bi bi-arrow-clockwise"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <nav class="mt-4">
      <ul class="pagination justify-content-center">
        <li class="page-item">
          <a class="page-link" href="#" aria-label="Previous">
            <span aria-hidden="true">&laquo;</span>
          </a>
        </li>
        <li class="page-item active"><a class="page-link" href="#">1</a></li>
        <li class="page-item"><a class="page-link" href="#">2</a></li>
        <li class="page-item"><a class="page-link" href="#">3</a></li>
        <li class="page-item">
          <a class="page-link" href="#" aria-label="Next">
            <span aria-hidden="true">&raquo;</span>
          </a>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// Reactive data
const searchTerm = ref('')
const selectedType = ref('')
const selectedCriticality = ref('')

// Mock data
const assets = ref([
  {
    id: 1,
    name: 'Web Server 01',
    description: 'Production web server',
    type: 'server',
    criticality: 'critical',
    ipAddress: '192.168.1.10',
    owner: 'IT Team',
    vulnCount: 5,
    lastScan: new Date('2024-01-15')
  },
  {
    id: 2,
    name: 'Database Server',
    description: 'Customer database',
    type: 'database',
    criticality: 'critical',
    ipAddress: '192.168.1.20',
    owner: 'DBA Team',
    vulnCount: 2,
    lastScan: new Date('2024-01-14')
  },
  {
    id: 3,
    name: 'Mail Server',
    description: 'Corporate email server',
    type: 'server',
    criticality: 'high',
    ipAddress: '192.168.1.30',
    owner: 'IT Team',
    vulnCount: 1,
    lastScan: new Date('2024-01-13')
  }
])

// Computed properties
const filteredAssets = computed(() => {
  return assets.value.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         asset.description.toLowerCase().includes(searchTerm.value.toLowerCase())
    const matchesType = !selectedType.value || asset.type === selectedType.value
    const matchesCriticality = !selectedCriticality.value || asset.criticality === selectedCriticality.value
    
    return matchesSearch && matchesType && matchesCriticality
  })
})

// Methods
const getCriticalityClass = (criticality: string) => {
  const classes = {
    critical: 'severity-critical',
    high: 'severity-high', 
    medium: 'severity-medium',
    low: 'severity-low'
  }
  return classes[criticality as keyof typeof classes] || 'bg-secondary'
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('de-DE')
}
</script>