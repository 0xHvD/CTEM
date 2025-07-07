# CTEM Tool – MVP Briefing für Sprachmodell

## 🧭 Projektüberblick

**Projektname:** Continuous Threat and Exposure Management (CTEM) Tool  
**Ziel:** Eine moderne Webanwendung zur Zusammenführung und Visualisierung sicherheitsrelevanter Daten für Unternehmen. Sie soll einen Echtzeit-Überblick über den aktuellen Informationssicherheitsstatus bieten.

---

## 🧱 Technologien

- **Frontend Framework:** Vue.js 3
- **Sprache:** TypeScript
- **Build Tool:** Vite
- **UI-Framework:** Bootstrap 5 + Bootstrap Icons
- **State Management:** Pinia
- **Testing:** Vitest (Unit), Playwright (E2E)
- **Sonstiges:** ESLint, Prettier, vue-tsc, Vue Router

---

## 📦 Aktueller Projektstand

Die Grundstruktur der Anwendung steht:
- Routen und Views: Dashboard, Assets, Vulnerabilities, Risks, Reports, Settings, Remediation, Compliance
- Stores für zentrale Datenbereiche vorhanden (auth, assets, vulnerabilities, dashboard, notifications)
- Beispielhafte Komponenten, Icons, Styling via Bootstrap
- Toast-System für Benachrichtigungen integriert
- Erste Tests vorhanden (Vitest, Playwright)

---

## 🔜 Nächste Schritte (Anweisungen für Weiterarbeit)

### 1. 🔌 Backend-Integration
- [ ] `services/api.ts` erstellen und `axios` als zentrales Modul nutzen
- [ ] `.env` für API-Base-URL verwenden
- [ ] Pinia-Stores mit echten API-Aufrufen erweitern (`fetchAssets()`, `fetchVulnerabilities()` etc.)
- [ ] Fehler- und Ladezustände implementieren (`isLoading`, `error`)

### 2. 📊 Visualisierung mit Charts
- [ ] Chart.js via `vue-chartjs` einbinden
- [ ] Reusable `ChartCard.vue`-Komponente entwickeln
- [ ] Visualisierung im Dashboard und in Reports (z. B. Risikotrends, Asset-Verteilung, Schwachstellenkategorien)

### 3. 🛠️ Risikobewertung
- [ ] Risikoberechnung pro Asset/Vulnerability (z. B. mit CVSS)
- [ ] Risikolevel (critical, high, medium, low) farblich codieren
- [ ] Dashboard-Metriken wie "Avg. Risk Score", "Critical Vulnerabilities" integrieren

### 4. 🧩 Abstraktion von Datenquellen
- [ ] Mapping-Modul (`mapping.ts`) erstellen, um Daten aus externen Tools zu standardisieren
- [ ] Beispielhafte Eingabestruktur für z. B. Tenable, Qualys, Rapid7, lokale Scanner definieren

### 5. 🧪 Tests
- [ ] Vitest-Tests für neue Store-Funktionen und Komponenten hinzufügen
- [ ] Playwright-Tests für User-Flows: Login, Navigation, Datenfilterung

### 6. 🔒 Authentifizierung
- [ ] `LoginView.vue` erstellen
- [ ] Auth-Store (`auth.ts`) mit Login/Logout-Mechanik (z. B. JWT)
- [ ] Router Guards für geschützte Seiten

### 7. 🔍 Filterung & Interaktivität
- [ ] Filterkomponenten (Dropdowns, Chips, Badge-Facetten) erstellen
- [ ] `FilterPanel.vue` für Filter in Asset-, Risk- und Vulnerability-Ansicht
- [ ] Real-time Suche implementieren

---

## ✅ Ziel des MVP

- Visuelle Übersicht zu Assets, Schwachstellen und Risiken
- Daten aus mehreren Quellen einlesen und normalisieren
- Kritische Risiken hervorheben
- Interaktive Dashboards mit Filter- und Detailfunktionen
- Basis-Auth und UI-Tests integriert

---

Bitte halte dich bei der Umsetzung an Vue 3-Komponenten mit `<script setup lang="ts">`, verwende `Pinia` zur State-Verwaltung und Bootstrap für UI-Elemente.

Die generierten Komponenten sollen übersichtlich, responsiv und modular sein. Bei Fragen zu Struktur, UX oder Integration: Kontext nutzen oder Rückfrage generieren.
