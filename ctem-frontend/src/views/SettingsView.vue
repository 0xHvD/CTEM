<!-- src/views/SettingsView.vue -->
<template>
  <div class="settings-view">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1>Settings</h1>
        <p class="text-muted mb-0">Configure system settings and preferences</p>
      </div>
    </div>
    
    <div class="row">
      <div class="col-md-3">
        <div class="list-group">
          <a class="list-group-item list-group-item-action active">
            <i class="bi bi-gear me-2"></i>General
          </a>
          <a class="list-group-item list-group-item-action">
            <i class="bi bi-shield me-2"></i>Security
          </a>
          <a class="list-group-item list-group-item-action">
            <i class="bi bi-bell me-2"></i>Notifications
          </a>
          <a class="list-group-item list-group-item-action">
            <i class="bi bi-people me-2"></i>Users
          </a>
        </div>
      </div>
      <div class="col-md-9">
        <div class="card">
          <div class="card-body">
            <h5>General Settings</h5>
            <p class="text-muted">Settings configuration coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Settings logic will be implemented here
</script>