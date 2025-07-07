const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Admin User erstellen
  const adminPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ctem.local' },
    update: {},
    create: {
      email: 'admin@ctem.local',
      password: adminPassword,
      name: 'CTEM Administrator',
      role: 'ADMIN',
      permissions: ['*'], // Alle Berechtigungen
      isActive: true,
      department: 'IT Security'
    }
  });
  console.log('✅ Admin user created:', adminUser.email);

  // 2. Analyst User erstellen
  const analystPassword = await bcrypt.hash('analyst123', 12);
  
  const analystUser = await prisma.user.upsert({
    where: { email: 'analyst@ctem.local' },
    update: {},
    create: {
      email: 'analyst@ctem.local',
      password: analystPassword,
      name: 'Security Analyst',
      role: 'ANALYST',
      permissions: [
        'assets:read', 'assets:create', 'assets:update',
        'vulnerabilities:read', 'vulnerabilities:update',
        'risks:read', 'risks:create', 'risks:update',
        'reports:read', 'reports:create',
        'scans:read', 'scans:create'
      ],
      isActive: true,
      department: 'Security Operations'
    }
  });
  console.log('✅ Analyst user created:', analystUser.email);

  // 3. Viewer User erstellen
  const viewerPassword = await bcrypt.hash('viewer123', 12);
  
  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@ctem.local' },
    update: {},
    create: {
      email: 'viewer@ctem.local',
      password: viewerPassword,
      name: 'Security Viewer',
      role: 'VIEWER',
      permissions: [
        'assets:read',
        'vulnerabilities:read',
        'risks:read',
        'reports:read'
      ],
      isActive: true,
      department: 'Management'
    }
  });
  console.log('✅ Viewer user created:', viewerUser.email);

  // 4. Sample Assets erstellen
  const sampleAssets = [
    {
      name: 'Web Server 01',
      type: 'SERVER',
      status: 'ACTIVE',
      criticality: 'HIGH',
      ipAddress: '192.168.1.10',
      hostname: 'web01.company.local',
      operatingSystem: 'Ubuntu 22.04 LTS',
      owner: 'IT Department',
      tags: ['web', 'production', 'ubuntu'],
      createdById: adminUser.id
    },
    {
      name: 'Database Server',
      type: 'DATABASE',
      status: 'ACTIVE',
      criticality: 'CRITICAL',
      ipAddress: '192.168.1.20',
      hostname: 'db01.company.local',
      operatingSystem: 'CentOS 8',
      owner: 'Database Team',
      tags: ['database', 'production', 'mysql'],
      createdById: adminUser.id
    },
    {
      name: 'Employee Workstation',
      type: 'WORKSTATION',
      status: 'ACTIVE',
      criticality: 'MEDIUM',
      ipAddress: '192.168.1.100',
      hostname: 'ws01.company.local',
      operatingSystem: 'Windows 11',
      owner: 'John Doe',
      tags: ['workstation', 'windows'],
      createdById: adminUser.id
    }
  ];

  // Check if assets already exist, if not create them
  for (const asset of sampleAssets) {
    const existingAsset = await prisma.asset.findFirst({
      where: { name: asset.name }
    });

    if (!existingAsset) {
      const createdAsset = await prisma.asset.create({
        data: asset
      });
      console.log('✅ Asset created:', createdAsset.name);
    } else {
      console.log('⏭️  Asset already exists:', asset.name);
    }
  }

  // 5. Sample Vulnerabilities erstellen
  const sampleVulnerabilities = [
    {
      cveId: 'CVE-2024-1234',
      title: 'Remote Code Execution in Apache',
      description: 'A critical vulnerability allows remote code execution',
      severity: 'CRITICAL',
      cvssScore: 9.8,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      publishedDate: new Date('2024-01-15'),
      lastModifiedDate: new Date('2024-01-20'),
      category: 'Web Application',
      solution: 'Update to Apache version 2.4.58 or later',
      references: ['https://httpd.apache.org/security/vulnerabilities_24.html'],
      exploitAvailable: true,
      patchAvailable: true
    },
    {
      cveId: 'CVE-2024-5678',
      title: 'SQL Injection in Web Application',
      description: 'SQL injection vulnerability in login form',
      severity: 'HIGH',
      cvssScore: 8.1,
      publishedDate: new Date('2024-02-01'),
      lastModifiedDate: new Date('2024-02-05'),
      category: 'Web Application',
      solution: 'Implement parameterized queries',
      exploitAvailable: false,
      patchAvailable: true
    }
  ];

  for (const vuln of sampleVulnerabilities) {
    const existingVuln = await prisma.vulnerability.findUnique({
      where: { cveId: vuln.cveId }
    });

    if (!existingVuln) {
      const createdVuln = await prisma.vulnerability.create({
        data: vuln
      });
      console.log('✅ Vulnerability created:', createdVuln.cveId);
    } else {
      console.log('⏭️  Vulnerability already exists:', vuln.cveId);
    }
  }

  // 6. Sample System Settings erstellen
  const systemSettings = [
    { key: 'general.organizationName', value: '"ACME Corporation"', category: 'general' },
    { key: 'general.timezone', value: '"Europe/Berlin"', category: 'general' },
    { key: 'security.sessionTimeout', value: '60', category: 'security' },
    { key: 'notifications.email.enabled', value: 'false', category: 'notifications' },
    { key: 'scanning.automated.enabled', value: 'true', category: 'scanning' }
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        ...setting,
        createdById: adminUser.id
      }
    });
    console.log('✅ System setting created:', setting.key);
  }

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📝 Test Users:');
  console.log('Admin: admin@ctem.local / admin123');
  console.log('Analyst: analyst@ctem.local / analyst123');
  console.log('Viewer: viewer@ctem.local / viewer123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });