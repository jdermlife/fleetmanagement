import LendingScorecard from './components/LendingScorecard'
import DashboardSnapshot from './components/DashboardSnapshot'
import AuditTrailPanel from './components/AuditTrailPanel'
import CreditScoring from './components/CreditScoring'
import FuelManagement from './components/FuelManagement'
import VehicleDetailPage from './components/VehicleDetailPage'
import VehicleMasterPage from './components/VehicleMasterPage'


type FleetPage = {
  id: string
  title: string
  description: string
  features: string[]
}


const productPages: FleetPage[] = [
  { id: 'dashboard', title: 'Dashboard', description: 'Executive overview of fleet operations.', features: ['KPI cards', 'Active vehicles', 'Vehicle availability', 'Alerts', 'Fuel usage', 'Cost summary', 'Utilization graphs', 'Map overview'] },
  { id: 'lending-scorecard', title: 'Lending Scorecard', description: 'Interactive credit scorecard with weighted computation.', features: ['Weighted sections', 'Risk grading', 'Critical override', 'Relationship manager notes'] },
  { id: 'vehicle-master', title: 'Vehicle Master Page', description: 'Central registry of all vehicles.', features: ['Add/edit/delete vehicles', 'Plate number', 'VIN', 'Make/model', 'Registration', 'Ownership', 'Status', 'Photos', 'Assigned branch'] },
  { id: 'vehicle-detail', title: 'Vehicle Detail Page', description: 'Full vehicle record with history and documents.', features: ['Maintenance history', 'Mileage logs', 'Insurance details', 'Fuel records', 'GPS history', 'Attached documents'] },
  { id: 'driver-management', title: 'Driver Management', description: 'Manage drivers and operators.', features: ['Driver profiles', 'Licenses', 'Certifications', 'Shifts', 'Assigned vehicles', 'Incident records'] },
  { id: 'driver-detail', title: 'Driver Detail Page', description: 'Individual driver performance and records.', features: ['Driving score', 'Attendance', 'License expiry', 'Penalties', 'Completed trips'] },
  { id: 'dispatch-scheduling', title: 'Dispatch / Trip Scheduling', description: 'Plan trips and allocate resources efficiently.', features: ['Assign driver+vehicle', 'Route planning', 'Trip calendar', 'ETA', 'Priority scheduling'] },
  { id: 'live-gps', title: 'Live GPS Tracking', description: 'Monitor vehicles in real time.', features: ['Live map', 'Speed tracking', 'Route replay', 'Geofencing', 'Stop detection', 'Unauthorized movement alerts'] },
  { id: 'route-optimization', title: 'Route Optimization', description: 'Optimize routes for efficiency.', features: ['Best route suggestions', 'Traffic avoidance', 'Multi-stop planning', 'Fuel-saving route engine'] },
  { id: 'fuel-management', title: 'Fuel Management', description: 'Control fuel usage and prevent fraud.', features: ['Fuel logs', 'Fuel card integration', 'Consumption trends', 'Theft detection', 'Abnormal refill alerts'] },
  { id: 'maintenance-management', title: 'Maintenance Management', description: 'Keep the fleet roadworthy.', features: ['Preventive maintenance scheduler', 'Work orders', 'Repair requests', 'Service vendor logs'] },
  { id: 'workshop-garage', title: 'Workshop / Garage Page', description: 'Manage internal repair center operations.', features: ['Mechanic assignment', 'Parts usage', 'Labor tracking', 'Repair completion status'] },
  { id: 'parts-inventory', title: 'Parts & Inventory', description: 'Manage spare parts and stock.', features: ['Inventory stock', 'Reorder alerts', 'Issuance logs', 'Supplier database'] },
  { id: 'tires-management', title: 'Tires Management', description: 'Track tire lifecycle and condition.', features: ['Tire serial tracking', 'Rotation schedule', 'Wear level', 'Replacement alerts'] },
  { id: 'incident-management', title: 'Incident / Accident Management', description: 'Manage fleet incidents and claims.', features: ['Accident reporting', 'Photo uploads', 'Claim process', 'Investigation notes'] },
  { id: 'insurance-management', title: 'Insurance Management', description: 'Monitor coverage and renewals.', features: ['Policies', 'Renewals', 'Claims', 'Expiry reminders'] },
  { id: 'compliance-registration', title: 'Compliance / Registration', description: 'Track legal obligations for vehicles.', features: ['Registration renewal', 'Permits', 'Inspections', 'Road tax reminders'] },
  { id: 'driver-safety', title: 'Driver Safety / Telematics', description: 'Improve driving behavior and safety.', features: ['Harsh braking alerts', 'Speeding logs', 'Fatigue detection', 'Scorecards'] },
  { id: 'fuel-card-expense', title: 'Fuel Card / Expense Page', description: 'Reconcile fuel expenses and receipts.', features: ['Fuel card transactions', 'Receipts', 'Suspicious transaction detection'] },
  { id: 'purchase-leasing', title: 'Purchase / Leasing Page', description: 'Manage vehicle acquisition and leasing.', features: ['Vehicle procurement', 'Lease contracts', 'Vendor comparison'] },
  { id: 'utilization-management', title: 'Utilization Management', description: 'Monitor asset productivity.', features: ['Idle vehicles', 'Underused assets', 'Load factor', 'Trip frequency'] },
  { id: 'billing-invoicing', title: 'Billing / Invoicing', description: 'Handle fleet billing and invoices.', features: ['Per trip billing', 'Mileage billing', 'Customer invoices'] },
  { id: 'customer-portal', title: 'Customer Portal', description: 'Provide logistics clients with shipment visibility.', features: ['Shipment status', 'Live tracking', 'Proof of delivery', 'Invoices'] },
  { id: 'warehouse-cargo', title: 'Warehouse / Cargo Page', description: 'Manage cargo, loading, and capacity.', features: ['Cargo assignment', 'Loading schedule', 'Capacity planning'] },
  { id: 'employee-hr', title: 'Employee / HR Page', description: 'Integrate workforce and HR data.', features: ['Staff roster', 'Payroll sync', 'Leave management affecting dispatch'] },
  { id: 'vendor-management', title: 'Vendor Management', description: 'Manage external providers and contracts.', features: ['Repair shops', 'Fuel vendors', 'Insurers', 'Contracts'] },
  { id: 'document-management', title: 'Document Management', description: 'Store fleet documents in one place.', features: ['Upload PDF/Excel/images', 'OCR', 'Search', 'Versioning'] },
  { id: 'alerts-center', title: 'Alerts Center', description: 'View critical fleet alerts in one place.', features: ['Expiry alerts', 'Overdue maintenance', 'Unauthorized use', 'Route deviation'] },
  { id: 'reports-center', title: 'Reports Center', description: 'Generate standard fleet reports.', features: ['Fleet cost', 'Mileage', 'Fuel efficiency', 'Accident trends'] },
  { id: 'analytics-bi', title: 'Analytics / BI Page', description: 'Get advanced fleet intelligence.', features: ['Predictive maintenance', 'Driver ranking', 'Cost forecasting'] },
  { id: 'ai-command-center', title: 'AI Command Center', description: 'Use AI for automation and recommendations.', features: ['Chat assistant', 'Anomaly detection', 'Recommendations', 'Auto scheduling'] },
  { id: 'settings-configuration', title: 'Settings / Configuration', description: 'Control system settings and workflows.', features: ['Branches', 'Units', 'Workflow setup', 'Thresholds'] },
  { id: 'api-integration-center', title: 'API / Integration Center', description: 'Connect the fleet system with external tools.', features: ['ERP', 'SAP', 'GPS devices', 'HRIS', 'Fuel cards'] },
  { id: 'audit-trail', title: 'Audit Trail Page', description: 'Review all system changes and events.', features: ['What changed', 'When it happened', 'Detailed logs'] },
  { id: 'mobile-app-sync', title: 'Mobile App Sync Page', description: 'Sync field user apps and offline workflow.', features: ['Driver app sync', 'Offline mode', 'Proof-of-delivery uploads'] },
]


function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>The Best Car and Fleet Rental</h2>
        <p>Demo Version. Access Rights Integrated in Actual</p>
        <div className="sidebar-link-group">
          <a href="#lending-scorecard">Lending Scorecard</a>
          <a href="#vehicle-master">Vehicle Registry</a>
          <a href="#vehicle-detail">Vehicle Detail</a>
          <a href="#fuel-management">Fuel Management</a>
          <a href="#credit-scoring">Credit Scoring</a>
          <a href="#audit-trail">Audit Trail</a>
        </div>
        <nav>
          <ul>
            {productPages.map((page) => (
              <li key={page.id}>
                <a href={`#${page.id}`}>{page.title}</a>
              </li>
            ))}
            <li>
              <a href="#credit-scoring">Credit Scoring</a>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="content">
        <div className="container">
          <h1>Fleet Management System</h1>
          <p className="intro">
            This build now opens directly into the fleet workspace without authentication. Vehicles, fuel logs,
            credit scoring, and audit history are available immediately against the backend API.
          </p>

          {productPages.map((page) => (
            <section id={page.id} key={page.id} className="card">
              {renderPageContent(page.id)}
            </section>
          ))}

          <section id="credit-scoring" className="card">
            <CreditScoring />
          </section>
        </div>
      </main>
    </div>
  )
}


function renderPageContent(pageId: string) {
  if (pageId === 'dashboard') {
    return <DashboardSnapshot />
  }

  if (pageId === 'lending-scorecard') {
    return <LendingScorecard />
  }

  if (pageId === 'vehicle-master') {
    return <VehicleMasterPage />
  }

  if (pageId === 'vehicle-detail') {
    return <VehicleDetailPage />
  }

  if (pageId === 'fuel-management') {
    return <FuelManagement />
  }

  if (pageId === 'audit-trail') {
    return <AuditTrailPanel />
  }

  const page = productPages.find((candidate) => candidate.id === pageId)
  if (!page) {
    return null
  }

  return (
    <>
      <h2>{page.title}</h2>
      <p>{page.description}</p>
      <ul>
        {page.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </>
  )
}


export default App
