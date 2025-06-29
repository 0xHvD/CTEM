// stores/notifications.ts - System Notifications
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface Notification {
  id: string
  type: 'vulnerability' | 'asset' | 'compliance' | 'system'
  title: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'success'
  timestamp: Date
  read: boolean
  actionUrl?: string
}

export const useNotificationsStore = defineStore('notifications', () => {
  // State
  const notifications = ref<Notification[]>([
    {
      id: '1',
      type: 'vulnerability',
      title: 'New Critical Vulnerability Detected',
      message: 'SQL Injection vulnerability found on Web Server 01',
      severity: 'error',
      timestamp: new Date(),
      read: false,
      actionUrl: '/vulnerabilities/1'
    },
    {
      id: '2',
      type: 'compliance',
      title: 'Compliance Score Updated',
      message: 'Monthly compliance score increased to 87%',
      severity: 'success',
      timestamp: new Date(Date.now() - 3600000),
      read: false
    },
    {
      id: '3',
      type: 'asset',
      title: 'Asset Scan Completed',
      message: 'Scheduled scan completed for 15 assets',
      severity: 'info',
      timestamp: new Date(Date.now() - 7200000),
      read: true
    }
  ])

  // Getters
  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  )

  const criticalNotifications = computed(() =>
    notifications.value.filter(n => n.severity === 'error' && !n.read)
  )

  const recentNotifications = computed(() =>
    notifications.value
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
  )

  // Actions
  function markAsRead(id: string): void {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
    }
  }

  function markAllAsRead(): void {
    notifications.value.forEach(n => n.read = true)
  }

  function addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    notifications.value.unshift({
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    })
  }

  return {
    // State
    notifications,
    // Getters
    unreadCount,
    criticalNotifications,
    recentNotifications,
    // Actions
    markAsRead,
    markAllAsRead,
    addNotification
  }
})