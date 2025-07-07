<template>
  <div class="home-view">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="row align-items-center min-vh-100">
          <div class="col-lg-6">
            <div class="hero-content">
              <h1 class="display-4 fw-bold mb-4">
                Continuous Threat 
                <span class="text-primary">Exposure Management</span>
              </h1>
              <p class="lead mb-4">
                Proactive security posture management through continuous discovery, 
                assessment, and prioritization of security exposures across your entire attack surface.
              </p>
              
              <div class="feature-highlights mb-5">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <div class="feature-item d-flex align-items-center">
                      <i class="bi bi-shield-check text-success me-3" style="font-size: 1.5rem;"></i>
                      <div>
                        <h6 class="mb-1">Real-time Monitoring</h6>
                        <small class="text-muted">24/7 threat surveillance</small>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <div class="feature-item d-flex align-items-center">
                      <i class="bi bi-graph-up-arrow text-primary me-3" style="font-size: 1.5rem;"></i>
                      <div>
                        <h6 class="mb-1">Risk Analytics</h6>
                        <small class="text-muted">AI-powered insights</small>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <div class="feature-item d-flex align-items-center">
                      <i class="bi bi-lightning text-warning me-3" style="font-size: 1.5rem;"></i>
                      <div>
                        <h6 class="mb-1">Rapid Response</h6>
                        <small class="text-muted">Automated remediation</small>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <div class="feature-item d-flex align-items-center">
                      <i class="bi bi-patch-check text-info me-3" style="font-size: 1.5rem;"></i>
                      <div>
                        <h6 class="mb-1">Compliance</h6>
                        <small class="text-muted">Industry standards</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="cta-buttons">
                <router-link 
                  to="/login" 
                  class="btn btn-primary btn-lg me-3 px-4"
                >
                  <i class="bi bi-box-arrow-in-right me-2"></i>
                  Access Dashboard
                </router-link>
                <button 
                  class="btn btn-outline-secondary btn-lg px-4"
                  @click="scrollToFeatures"
                >
                  <i class="bi bi-info-circle me-2"></i>
                  Learn More
                </button>
              </div>
            </div>
          </div>
          
          <div class="col-lg-6">
            <div class="hero-visual">
              <!-- Security Dashboard Preview -->
              <div class="dashboard-preview">
                <div class="browser-frame">
                  <div class="browser-header">
                    <div class="browser-controls">
                      <span class="control red"></span>
                      <span class="control yellow"></span>
                      <span class="control green"></span>
                    </div>
                    <div class="url-bar">
                      <i class="bi bi-shield-lock text-success me-2"></i>
                      ctem.security/dashboard
                    </div>
                  </div>
                  <div class="browser-content">
                    <div class="dashboard-mockup">
                      <div class="metric-cards">
                        <div class="metric-card">
                          <div class="metric-value text-success">98.5%</div>
                          <div class="metric-label">Security Score</div>
                        </div>
                        <div class="metric-card">
                          <div class="metric-value text-warning">12</div>
                          <div class="metric-label">Active Threats</div>
                        </div>
                        <div class="metric-card">
                          <div class="metric-value text-primary">1,247</div>
                          <div class="metric-label">Assets Monitored</div>
                        </div>
                      </div>
                      <div class="chart-area">
                        <div class="chart-placeholder">
                          <i class="bi bi-graph-up text-muted"></i>
                          <span class="text-muted">Threat Trends</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="features-section py-5 bg-light">
      <div class="container">
        <div class="text-center mb-5">
          <h2 class="fw-bold">Comprehensive Security Management</h2>
          <p class="text-muted">Everything you need to protect your digital assets</p>
        </div>
        
        <div class="row">
          <div class="col-lg-4 mb-4">
            <div class="feature-card card h-100 border-0 shadow-sm">
              <div class="card-body text-center p-4">
                <div class="feature-icon mb-3">
                  <i class="bi bi-search text-primary" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title">Asset Discovery</h5>
                <p class="card-text text-muted">
                  Automatically discover and inventory all assets across your infrastructure, 
                  including shadow IT and cloud resources.
                </p>
              </div>
            </div>
          </div>
          
          <div class="col-lg-4 mb-4">
            <div class="feature-card card h-100 border-0 shadow-sm">
              <div class="card-body text-center p-4">
                <div class="feature-icon mb-3">
                  <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title">Vulnerability Assessment</h5>
                <p class="card-text text-muted">
                  Continuous vulnerability scanning with intelligent prioritization 
                  based on real-world threat intelligence.
                </p>
              </div>
            </div>
          </div>
          
          <div class="col-lg-4 mb-4">
            <div class="feature-card card h-100 border-0 shadow-sm">
              <div class="card-body text-center p-4">
                <div class="feature-icon mb-3">
                  <i class="bi bi-shield-exclamation text-danger" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title">Risk Quantification</h5>
                <p class="card-text text-muted">
                  Translate technical vulnerabilities into business risk metrics 
                  that executives can understand and act upon.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Statistics Section -->
    <section class="stats-section py-5">
      <div class="container">
        <div class="row text-center">
          <div class="col-lg-3 col-md-6 mb-4">
            <div class="stat-item">
              <h2 class="stat-number text-primary mb-2">99.9%</h2>
              <p class="stat-label text-muted mb-0">Uptime Guarantee</p>
            </div>
          </div>
          <div class="col-lg-3 col-md-6 mb-4">
            <div class="stat-item">
              <h2 class="stat-number text-success mb-2">< 5min</h2>
              <p class="stat-label text-muted mb-0">Average Detection Time</p>
            </div>
          </div>
          <div class="col-lg-3 col-md-6 mb-4">
            <div class="stat-item">
              <h2 class="stat-number text-warning mb-2">24/7</h2>
              <p class="stat-label text-muted mb-0">Monitoring Coverage</p>
            </div>
          </div>
          <div class="col-lg-3 col-md-6 mb-4">
            <div class="stat-item">
              <h2 class="stat-number text-info mb-2">500+</h2>
              <p class="stat-label text-muted mb-0">Enterprise Customers</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section py-5 bg-primary text-white">
      <div class="container text-center">
        <div class="row justify-content-center">
          <div class="col-lg-8">
            <h2 class="fw-bold mb-3">Ready to Secure Your Infrastructure?</h2>
            <p class="lead mb-4">
              Join hundreds of organizations that trust our CTEM platform 
              to protect their digital assets and reduce cyber risk.
            </p>
            <router-link 
              to="/login" 
              class="btn btn-light btn-lg px-5"
            >
              <i class="bi bi-arrow-right me-2"></i>
              Get Started Now
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer-section py-4 bg-dark text-white-50">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-md-6">
            <div class="d-flex align-items-center">
              <i class="bi bi-shield-check text-primary me-2" style="font-size: 1.5rem;"></i>
              <span class="fw-bold">CTEM Platform</span>
            </div>
            <small>© 2024 Continuous Threat Exposure Management. All rights reserved.</small>
          </div>
          <div class="col-md-6 text-end">
            <small>Secure by design • Enterprise ready • Compliance focused</small>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

const router = useRouter()
const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

// Methods
const scrollToFeatures = () => {
  const featuresSection = document.getElementById('features')
  if (featuresSection) {
    featuresSection.scrollIntoView({ behavior: 'smooth' })
  }
}

// Lifecycle
onMounted(async () => {
  // Initialize auth store
  await authStore.initializeAuth()
  
  // Redirect if already authenticated
  if (isAuthenticated.value) {
    router.push('/dashboard')
  }
})
</script>

<style scoped>
.home-view {
  min-height: 100vh;
}

.hero-section {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="%23dee2e6" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
  opacity: 0.5;
}

.hero-content {
  position: relative;
  z-index: 2;
}

.feature-item {
  transition: transform 0.2s ease;
}

.feature-item:hover {
  transform: translateY(-2px);
}

.dashboard-preview {
  position: relative;
  z-index: 2;
}

.browser-frame {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  overflow: hidden;
}

.browser-header {
  background: #f1f3f4;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
}

.browser-controls {
  display: flex;
  gap: 6px;
  margin-right: 16px;
}

.control {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.control.red { background: #ff5f56; }
.control.yellow { background: #ffbd2e; }
.control.green { background: #27ca3f; }

.url-bar {
  background: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #5f6368;
  flex: 1;
}

.dashboard-mockup {
  padding: 20px;
}

.metric-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.metric-card {
  flex: 1;
  background: #f8f9fa;
  padding: 16px;
  border-radius: 6px;
  text-align: center;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 0.8rem;
  color: #6c757d;
}

.chart-area {
  background: #f8f9fa;
  height: 120px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
}

.chart-placeholder i {
  font-size: 2rem;
}

.feature-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
}

.feature-icon {
  transition: transform 0.3s ease;
}

.feature-card:hover .feature-icon {
  transform: scale(1.1);
}

.stats-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-number {
  font-size: 3rem;
  font-weight: 700;
}

.cta-section {
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
}

.btn-primary {
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  border: none;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(30, 58, 138, 0.4);
}

.btn-outline-secondary {
  border-color: #6c757d;
  color: #6c757d;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .hero-section {
    text-align: center;
  }
  
  .metric-cards {
    flex-direction: column;
  }
  
  .stat-number {
    font-size: 2rem;
  }
  
  .cta-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .cta-buttons .btn {
    width: 100%;
  }
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}
</style>