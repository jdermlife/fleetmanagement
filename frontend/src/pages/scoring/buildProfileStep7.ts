export type CollateralField = {
  key: string
  label: string
  type?: 'number' | 'select' | 'text' | 'textarea'
  options?: string[]
}

export type AdditionalCollateral = {
  id: string
  collateralType: string
  propertyType: string
  maker: string
  brand: string
  model: string
  year: string
  appraisedValue: string
  insuranceProviderCompany: string
  policyNumber: string
  orNumber: string
  crNumber: string
  tctCctNumber: string
  notes: string
}

export const AUTO_LOAN_FIELDS: CollateralField[] = [
  { key: 'assetType', label: 'Type', type: 'select', options: ['Passenger Cars', 'SUVs & Crossovers', 'Pickup Trucks', 'Motorcycles & Scooters', 'Buses & Minivans', 'Commercial Trucks'] },
  { key: 'maker', label: 'Maker' }, { key: 'brand', label: 'Brand' }, { key: 'model', label: 'Model' }, { key: 'year', label: 'Year' },
  { key: 'vehicleConditionCategory', label: 'Vehicle Age / Condition', type: 'select', options: ['Brand New', 'Used (1–3 years), Excellent Condition', 'Used (4–6 years), Good Condition', 'More than 6 years old or Fair/Poor Condition'] },
  { key: 'vehicleTypeCategory', label: 'Vehicle Type', type: 'select', options: ['Passenger vehicle for personal use', 'SUV / MPV / Pickup in good condition', 'Commercial vehicle (van, light truck)', 'Heavy equipment / Specialized vehicles', 'Salvage, rebuilt, or unregistered vehicle'] },
  { key: 'appraisedValue', label: 'Appraised Value / Brand New Price', type: 'number' },
  { key: 'insuranceProviderCompany', label: 'Insurance Provider / Company' }, { key: 'policyNumber', label: 'Policy Number' },
  { key: 'orNumber', label: 'OR Number' }, { key: 'crNumber', label: 'CR Number' },
]

export const MOTORCYCLE_LOAN_FIELDS: CollateralField[] = [
  { key: 'assetType', label: 'Type', type: 'select', options: ['Motorcycle', 'Scooter', 'Underbone', 'Standard Bike', 'Delivery Bike'] },
  { key: 'maker', label: 'Maker' }, { key: 'brand', label: 'Brand' }, { key: 'model', label: 'Model' }, { key: 'year', label: 'Year' },
  { key: 'appraisedValue', label: 'Motorcycle Value', type: 'number' },
  { key: 'motorcycleIntendedUse', label: 'Intended Use', type: 'select', options: ['Personal use', 'Personal & occasional business', 'Full-time delivery/ride-hailing', 'Commercial/high mileage'] },
]

export const HOME_LOAN_FIELDS: CollateralField[] = [
  { key: 'propertyAddress', label: 'Property Address' }, { key: 'registeredOwner', label: 'Registered Owner' },
  { key: 'lotNumber', label: 'Lot Number' }, { key: 'blockNumber', label: 'Block Number' }, { key: 'tctCctNumber', label: 'TCT/CCT Number' },
  { key: 'propertyMarketabilityCategory', label: 'Marketability of the Property', type: 'select', options: ['Subdivision / Condominium (Class A,B,C)', 'Lowcost Subdivision / Condominium', 'Outside'] },
  { key: 'houseUnitModelCategory', label: 'House / Unit Model', type: 'select', options: ['Single detached', 'Single attached / Condominium', 'Townhouse', 'Row house'] },
  { key: 'collateralOccupancyType', label: 'Type of Collateral', type: 'select', options: ['Residential property used by applicant / borrower as primary residence', 'Residential property not used by applicant / borrower'] },
  { key: 'propertyAppraisedValue', label: 'Property Appraised Value', type: 'number' },
]

export const ADDITIONAL_COLLATERAL_FIELDS: CollateralField[] = [
  { key: 'collateralType', label: 'Type' }, { key: 'propertyType', label: 'Property Type' }, { key: 'maker', label: 'Maker' },
  { key: 'brand', label: 'Brand' }, { key: 'model', label: 'Model' }, { key: 'year', label: 'Year' },
  { key: 'appraisedValue', label: 'Appraised Value', type: 'number' }, { key: 'insuranceProviderCompany', label: 'Insurance Provider / Company' },
  { key: 'policyNumber', label: 'Policy Number' }, { key: 'orNumber', label: 'OR Number' }, { key: 'crNumber', label: 'CR Number' },
  { key: 'tctCctNumber', label: 'TCT / CTC Number' }, { key: 'notes', label: 'Notes', type: 'textarea' },
]

export const createAdditionalCollateral = (): AdditionalCollateral => ({
  id: `COL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  collateralType: '', propertyType: '', maker: '', brand: '', model: '', year: '', appraisedValue: '',
  insuranceProviderCompany: '', policyNumber: '', orNumber: '', crNumber: '', tctCctNumber: '', notes: '',
})