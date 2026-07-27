import { useEffect, useMemo, useState } from 'react'
import { NumericFormat } from 'react-number-format'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  fetchLoanApplication,
  recomputeStoredLoanApplicationScores,
  updateLoanApplication,
  type LoanApplicationPayload,
  type LoanApplicationRecord,
} from '../../api/loan'

import { computeNetWorthBuildingScore } from './netWorthBuildingEngine'
import {
  CURRENCY_OPTIONS,
  FINANCIAL_GOAL_OPTIONS as NET_WORTH_FINANCIAL_GOAL_OPTIONS,
  NET_WORTH_STATEMENT_ENTRIES,
  STEP1_SECTION_ORDER,
  STEP1_SECTION_SHORT_LABELS,
  type StatementSection,
} from './NetWorthPositioningPage'

import {
  CREDIT_VALUES_QUESTIONS,
  CREDIT_VALUES_SECTIONS,
  STEP_3_FIELDS,
  STEP_3_SECTIONS,
  type Step3Field,
} from './buildProfileStep3'
import {
  CO_BORROWER_FIELDS,
  GUARANTOR_FIELDS,
  SPOUSE_FIELDS,
  SPOUSE_EMPLOYMENT_FIELDS,
  createCoBorrower,
  createGuarantor,
  type CoBorrower,
  type Guarantor,
  type RelatedPartyField,
} from './buildProfileStep4'
import {
  BANKING_RELATIONSHIP_FIELDS,
  BANKING_RELATIONSHIP_SECTIONS,
  type BankingField,
} from './buildProfileStep5'
import {
  GOAL_SETTING_FIELDS,
  calculateMonthlyAmortization,
} from './buildProfileStep6'
import {
  ADDITIONAL_COLLATERAL_FIELDS,
  AUTO_LOAN_FIELDS,
  HOME_LOAN_FIELDS,
  MOTORCYCLE_LOAN_FIELDS,
  createAdditionalCollateral,
  type AdditionalCollateral,
  type CollateralField,
} from './buildProfileStep7'
import { BUILD_PROFILE_STORAGE_KEY } from './buildProfileReplication'

type ProfileStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

type ProfileData = {
  profileId: string
  step: ProfileStep
  values: Record<string, string>
  documents: string[]
  suitabilityAnswers: Record<string, string>
  coBorrowers: CoBorrower[]
  guarantors: Guarantor[]
  additionalCollaterals: AdditionalCollateral[]
  dependents: Dependent[]
}

type Dependent = {
  id: string
  name: string
  dateOfBirth: string
}

type FieldDefinition = {
  key: string
  label: string
  type?: 'date' | 'email' | 'number' | 'select' | 'tel' | 'text'
  options?: string[]
  readOnly?: boolean
  wide?: boolean
}

const STORAGE_KEY = BUILD_PROFILE_STORAGE_KEY
const profileApplicationRequests = new Map<string, Promise<LoanApplicationRecord>>()

const WORKFLOW_STEPS: Array<{ id: ProfileStep; label: string; description: string }> = [
  { id: 1, label: 'Tell Us About Yourself', description: 'Start with your essential personal and contact details.' },
  { id: 2, label: 'Spouse and Dependents', description: 'Complete applicable spouse and dependent information.' },
  { id: 3, label: 'Source of Income & Wealth and Credit Values', description: 'Record income, wealth, employment, verification, and Credit Values information.' },
  { id: 4, label: 'Spouse Employment, Co-Borrower, and Guarantor Information (as applicable)', description: 'Add applicable spouse employment, co-borrower, and guarantor information.' },
  { id: 5, label: 'Banking Relationships', description: 'Describe credit cards, bank accounts, and existing loans.' },
  { id: 6, label: 'Goal Setting', description: 'Define the financial purpose, product, amount, and timeframe.' },
  { id: 7, label: 'Collateral Assets (based on Goal and Product Requested).', description: 'Identify security and assets based on the goal and product requested.' },
  { id: 8, label: 'Wealth Position Base Setting', description: 'Set the date, goal, target, and complete the personal net worth statement.' },
  { id: 9, label: 'Targeted Goal', description: 'Review the wealth baseline, reconcile expense allocation, and save the targeted goal setup.' },
  { id: 10, label: 'Actual vs Target', description: 'Enter actual values and review variance against the saved targeted goal.' },
  { id: 11, label: 'Suitability Assessment', description: 'Assess investment objectives, horizon, and risk capacity.' },
  { id: 12, label: 'FILSCORE Score Links', description: 'Continue to your Credit Health and Wealth Building scores.' },
]

const STEP_FIELDS: Record<Exclude<ProfileStep, 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12>, FieldDefinition[]> = {
  1: [
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email Address', type: 'email' },
    { key: 'mobileNumber', label: 'Mobile Number', type: 'tel' },
    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    { key: 'age', label: 'Age', type: 'number', readOnly: true },
    { key: 'governmentId', label: 'Government ID Number' },
    { key: 'placeOfBirth', label: 'Place of Birth' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Prefer not to say'] },
    { key: 'dependents', label: 'Number of Dependents', type: 'number' },
    { key: 'citizenship', label: 'Citizenship', type: 'select', options: ['Filipino', 'American', 'Australian', 'British', 'Canadian', 'Chinese', 'Indian', 'Indonesian', 'Japanese', 'Korean', 'Malaysian', 'Singaporean', 'Thai', 'Vietnamese', 'Dual Citizen', 'Other'] },
    { key: 'civilStatus', label: 'Civil Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Legally Separated'] },
    { key: 'homePhoneNumber', label: 'Home Phone Number', type: 'tel' },
    { key: 'tin', label: 'TIN Number' },
    { key: 'sssGsis', label: 'SSS / GSIS Number' },
    { key: 'otherGovernmentId', label: 'Other Government ID Type' },
    { key: 'otherGovernmentIdNumber', label: 'Other Government ID Number' },
    { key: 'idIssueDate', label: 'ID Issue Date', type: 'date' },
    { key: 'idExpiryDate', label: 'ID Expiry Date', type: 'date' },
    { key: 'address', label: 'Present Address', wide: true },
    { key: 'permanentAddress', label: 'Permanent Address', wide: true },
    { key: 'mailingAddress', label: 'Mailing Address', wide: true },
    { key: 'lengthOfStay', label: 'Length of Stay at Present Address' },
    { key: 'homeOwnership', label: 'Home Ownership', type: 'select', options: ['Own', 'Mortgaged', 'Renting', 'Living with Relative'] },
    { key: 'education', label: 'Educational Attainment', type: 'select', options: ['PHD', 'PostGraduate', 'College Degree', 'HighSchool'] },
    { key: 'numberOfVehiclesOwned', label: 'Number of Vehicles Owned', type: 'number' },
  ],
  2: [],
}

const SUITABILITY_QUESTIONS = [
  { key: 'suitability-q1', prompt: 'What is your key investment objective?', options: ['To protect principal and preserve income.', 'To preserve real value and generate returns.', 'To grow through income and capital appreciation.', 'To grow aggressively for significant capital appreciation.'] },
  { key: 'suitability-q2', prompt: 'What portion of your investments can be placed for long-term growth (1 to 3 years)?', options: ['10% to 30%', 'More than 30% up to 60%', 'More than 60% up to 80%', 'More than 80% up to 100%'] },
  { key: 'suitability-q3', prompt: 'Do you have regular liquidity requirements?', options: ['I need regular income and may use principal in the short term.', 'I do not need regular income but may use some principal.', 'I have other liquidity and do not expect to use these funds for 5 to 10 years.', 'I have other liquidity and do not expect to use these funds for more than 10 years.'] },
  { key: 'suitability-q4', prompt: 'Which investments have you previously owned or are currently invested in?', options: ['Savings, time deposits, and similar cash instruments.', 'Government securities and similar fixed-income products.', 'Corporate bonds or corporate notes.', 'Equities, derivatives, or hedged investments.'] },
  { key: 'suitability-q5', prompt: 'How many years of investment experience do you have through a fund manager?', options: ['1 year or less', 'More than 1 year up to 5 years', 'More than 5 years up to 10 years', 'More than 10 years'] },
  { key: 'suitability-q6', prompt: 'What is your tolerance for risk?', options: ['I accept steady returns and minimal principal fluctuation.', 'I accept minimal principal fluctuations in pursuit of better returns.', 'I accept fair volatility to pursue above-average growth.', 'I am prepared for high volatility and possible short-term losses for higher long-term returns.'] },
  { key: 'suitability-q7', prompt: 'If your investments decline by 30% in one year, what would you do?', options: ['I would be very concerned and move to cash immediately.', 'I would be very concerned and move to safer investments.', 'I would review my profile and risk level.', 'I would stay invested and focus on long-term performance.'] },
  { key: 'suitability-q8', prompt: 'What is your average net worth over the last 2 years?', options: ['Below PHP 5 million', 'Over PHP 5 million up to PHP 30 million', 'Over PHP 30 million up to PHP 60 million', 'Over PHP 60 million'] },
]

const SUITABILITY_RESULT_BANDS = [
  { min: 1, max: 8, profile: 'Risk Averse', description: 'Client wants to preserve capital and ensure income is secured.', recommendedProduct: 'Savings / Time Deposits' },
  { min: 9, max: 16, profile: 'Conservative', description: 'Client prefers low-risk assets and limited volatility.', recommendedProduct: 'Fixed Income and Savings Bonds' },
  { min: 17, max: 27, profile: 'Moderate', description: 'Client accepts moderate risk for potentially higher returns.', recommendedProduct: 'Income Deposits, Government and Corporate Bonds, and Top-Tier Equities' },
  { min: 28, max: Number.POSITIVE_INFINITY, profile: 'Aggressive', description: 'Client accepts higher volatility and capital risk for stronger long-term growth.', recommendedProduct: 'Fixed Income, Equities, and High Yield Securities' },
]

function createProfileId(): string {
  return `PRO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function createEmptyProfile(): ProfileData {
  return { profileId: createProfileId(), step: 1, values: {}, documents: [], suitabilityAnswers: {}, coBorrowers: [], guarantors: [], additionalCollaterals: [], dependents: [] }
}

function createDependent(): Dependent {
  return { id: `DEP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, name: '', dateOfBirth: '' }
}

function loadProfile(): ProfileData {
  if (typeof window === 'undefined') return createEmptyProfile()
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return createEmptyProfile()
    const parsed = JSON.parse(saved)
    if (parsed.values) {
      const values = { ...parsed.values }
      if (values.dateOfBirth) values.age = calculateAge(values.dateOfBirth)
      return { ...createEmptyProfile(), ...parsed, values }
    }
    const { profileId, ...legacyValues } = parsed
    if (legacyValues.dateOfBirth) legacyValues.age = calculateAge(legacyValues.dateOfBirth)
    return { ...createEmptyProfile(), profileId: profileId || createProfileId(), values: legacyValues }
  } catch {
    return createEmptyProfile()
  }
}

function persistProfileSnapshot(profile: ProfileData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }))
}

function formatCurrency(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return 'Not set'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function calculateAge(dateOfBirth: string): string {
  if (!dateOfBirth) return ''
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  if (!year || !month || !day) return ''
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1
  return age >= 0 ? String(age) : ''
}

function isCompletedFieldValue(value: string | undefined, type?: FieldDefinition['type']): boolean {
  if (!value?.trim()) return false
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  return true
}

function getWorkflowStepCompletionClass(completion: number): string {
  if (completion === 100) return 'build-profile-workflow-step-complete'
  if (completion > 60) return 'build-profile-workflow-step-progress'
  return 'build-profile-workflow-step-incomplete'
}

function loadProfileApplication(applicationNo: string): Promise<LoanApplicationRecord> {
  const pendingRequest = profileApplicationRequests.get(applicationNo)
  if (pendingRequest) return pendingRequest

  const request = fetchLoanApplication(applicationNo).finally(() => {
    profileApplicationRequests.delete(applicationNo)
  })
  profileApplicationRequests.set(applicationNo, request)
  return request
}

function profileFromLoanApplication(application: LoanApplicationRecord, current: ProfileData): ProfileData {
  const requirements = application.requirements
  const savedBuildProfile = requirements.buildProfile
  const persistedProfile = savedBuildProfile
    && typeof savedBuildProfile === 'object'
    && !Array.isArray(savedBuildProfile)
    ? savedBuildProfile as Partial<ProfileData>
    : null
  const applicant = requirements.applicantPersonal
  const contact = requirements.contactInformation
  const governmentIds = requirements.governmentIds
  const addresses = requirements.addressInformation
  const otherInformation = requirements.otherInformation
  const employment = requirements.employmentInformation
  const banking = requirements.bankingRelationships
  const dueDiligence = requirements.enhancedDueDiligence
  const spouse = requirements.spouseInformation
  const collateral = requirements.collateralAssetDetails
  const property = requirements.collateralInformation
  const isSameProfile = current.profileId === application.application_no
  const profileBase: ProfileData = {
    ...createEmptyProfile(),
    ...(persistedProfile ?? (isSameProfile ? current : {})),
    profileId: application.application_no,
  }
  const dependentRecords = requirements.dependents ?? profileBase.dependents
  const dependents = dependentRecords.length > 0
    ? dependentRecords.map((dependent, index) => ({ id: 'id' in dependent && typeof dependent.id === 'string' ? dependent.id : `DEP-${application.application_no}-${index + 1}`, name: dependent.name, dateOfBirth: dependent.dateOfBirth }))
    : Array.from({ length: applicant.numberOfDependents || 0 }, () => createDependent())
  const values = { ...profileBase.values }

  Object.assign(values, {
    fullName: application.borrower_name,
    email: application.email || contact.emailAddress,
    mobileNumber: application.phone || contact.mobileNumber,
    dateOfBirth: applicant.dateOfBirth,
    age: String(applicant.age || ''),
    citizenship: applicant.citizenship,
    civilStatus: applicant.maritalStatus,
    homePhoneNumber: contact.homePhoneNumber,
    tin: governmentIds.tin,
    sssGsis: governmentIds.sssGsisNumber,
    otherGovernmentId: governmentIds.otherGovernmentId,
    otherGovernmentIdNumber: governmentIds.idNumber || application.gov_id,
    idIssueDate: governmentIds.issueDate,
    idExpiryDate: governmentIds.expiryDate,
    address: application.address || addresses.presentAddress,
    permanentAddress: addresses.permanentAddress,
    mailingAddress: addresses.mailingAddress,
    lengthOfStay: addresses.lengthOfStay,
    homeOwnership: otherInformation.homeOwnership,
    education: otherInformation.educationalAttainment,
    numberOfVehiclesOwned: String(otherInformation.numberOfVehiclesOwned ?? ''),
    governmentId: application.gov_id || governmentIds.idNumber,
    placeOfBirth: applicant.placeOfBirth,
    gender: applicant.gender,
    dependents: String(applicant.numberOfDependents ?? ''),
    employmentHistory: employment.employerBusinessName,
    monthlyIncome: String(application.monthly_income || employment.grossMonthlyIncome || ''),
    otherIncome: String(application.other_income || employment.otherSourcesOfIncome || ''),
    debtObligations: String(application.debt_obligations || ''),
    employmentStatus: employment.employmentStatus,
    employerName: employment.employerBusinessName,
    officeAddress: employment.officeAddress,
    occupation: employment.occupation,
    position: employment.position,
    natureOfWorkBusiness: employment.natureOfWorkBusiness,
    dateHired: employment.dateHired,
    officePhoneNumber: employment.officePhoneNumber,
    previousEmployer: employment.previousEmployer,
    totalYearsWorking: employment.totalYearsWorking,
    monthlyExpenses: String(employment.monthlyLivingExpenses || ''),
    otherSourcesOfIncome: String(employment.otherSourcesOfIncome || ''),
    investmentIncome: String(employment.investmentIncome || ''),
    businessIncome: String(employment.businessIncome || ''),
    pensionIncome: String(employment.pensionIncome || ''),
    employmentLocation: employment.employmentLocation,
    employerBusinessYears: String(employment.employerBusinessYears || ''),
    mobileYearsUsed: contact.mobileYearsUsed,
    emailYearsUsed: contact.emailYearsUsed,
    deviceVerified: String(otherInformation.deviceVerified),
    spouseFullName: spouse.fullName,
    spouseDateOfBirth: spouse.dateOfBirth,
    spousePlaceOfBirth: spouse.placeOfBirth,
    spouseCitizenship: spouse.citizenship,
    spouseMobileNumber: spouse.mobileNumber,
    spousePresentAddress: spouse.presentAddress,
    spouseEmployerBusinessName: spouse.employerBusinessName,
    spouseOfficeAddress: spouse.officeAddress,
    spouseOccupation: spouse.occupation,
    spousePosition: spouse.position,
    spouseNatureOfWork: spouse.natureOfWork,
    spousePreviousEmployer: spouse.previousEmployer,
    spouseYearsWithEmployer: spouse.yearsWithEmployer,
    spouseTotalYearsWorking: spouse.totalYearsWorking,
    spouseGrossMonthlyIncome: String(spouse.grossMonthlyIncome || ''),
    spouseMonthlyExpenses: String(spouse.monthlyExpenses || ''),
    spouseOtherIncomeSources: spouse.otherIncomeSources,
    hasCoBorrower: String((requirements.coBorrowers?.length ?? 0) > 0),
    ...Object.fromEntries(Object.entries(banking).map(([key, value]) => [key, String(value ?? '')])),
    ...Object.fromEntries(Object.entries(dueDiligence).map(([key, value]) => [key, String(value ?? '')])),
    loanPurpose: application.purpose,
    productType: application.product_type,
    requestedAmount: String(application.loan_amount || ''),
    loanTerm: String(application.term_months || ''),
    interestRate: String(application.interest_rate || ''),
    securityClassification: collateral.securityClassification,
    assetType: collateral.assetType,
    maker: collateral.maker,
    brand: collateral.brand,
    model: collateral.model,
    year: collateral.year,
    vehicleConditionCategory: collateral.vehicleConditionCategory,
    vehicleTypeCategory: collateral.vehicleTypeCategory,
    motorcycleIntendedUse: collateral.motorcycleIntendedUse,
    useAsCollateral: String(collateral.useAsCollateral),
    appraisedValue: String(application.appraised_value || ''),
    insuranceProviderCompany: collateral.insuranceProviderCompany,
    policyNumber: collateral.policyNumber,
    orNumber: collateral.orNumber,
    crNumber: collateral.crNumber,
    propertyAddress: property.propertyAddress,
    registeredOwner: property.registeredOwner,
    lotNumber: property.lotNumber,
    blockNumber: property.blockNumber,
    tctCctNumber: property.tctCctNumber,
    propertyMarketabilityCategory: property.propertyMarketabilityCategory,
    houseUnitModelCategory: property.houseUnitModelCategory,
    collateralOccupancyType: property.collateralOccupancyType,
    propertyAppraisedValue: String(property.propertyAppraisedValue || ''),
  })

  return {
    ...profileBase,
    profileId: application.application_no,
    values,
    coBorrowers: (requirements.coBorrowers ?? []).map((item, index) => ({
      id: `CB-${application.application_no}-${index + 1}`,
      name: item.name,
      relationship: item.relationship,
      monthlyIncome: String(item.monthlyIncome || ''),
      debtObligations: String(item.debtObligations || ''),
      creditStanding: item.creditStanding,
    })),
    additionalCollaterals: collateral.additionalCollaterals.map((item, index) => ({
      id: `COL-${application.application_no}-${index + 1}`,
      ...item,
      appraisedValue: String(item.appraisedValue || ''),
    })),
    dependents,
  }
}

function loanPayloadFromProfile(profile: ProfileData, source: LoanApplicationRecord): LoanApplicationPayload {
  const values = profile.values
  const requirements = structuredClone(source.requirements)
  const numberValue = (key: string, fallback = 0) => {
    const parsed = Number(values[key])
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const booleanValue = (key: string, fallback = false) => values[key] === undefined
    ? fallback
    : values[key] === 'true'

  Object.assign(requirements.applicantPersonal, {
    dateOfBirth: values.dateOfBirth || '',
    placeOfBirth: values.placeOfBirth || '',
    age: numberValue('age'),
    gender: values.gender || '',
    citizenship: values.citizenship || '',
    numberOfDependents: numberValue('dependents'),
    maritalStatus: values.civilStatus || '',
  })
  requirements.dependents = profile.dependents.map(({ name, dateOfBirth }) => ({ name, dateOfBirth }))
  Object.assign(requirements.contactInformation, {
    mobileNumber: values.mobileNumber || '',
    homePhoneNumber: values.homePhoneNumber || '',
    emailAddress: values.email || '',
    mobileYearsUsed: values.mobileYearsUsed || '',
    emailYearsUsed: values.emailYearsUsed || '',
  })
  Object.assign(requirements.governmentIds, {
    tin: values.tin || '',
    sssGsisNumber: values.sssGsis || '',
    otherGovernmentId: values.otherGovernmentId || '',
    idNumber: values.otherGovernmentIdNumber || values.governmentId || '',
    issueDate: values.idIssueDate || '',
    expiryDate: values.idExpiryDate || '',
  })
  Object.assign(requirements.addressInformation, {
    presentAddress: values.address || '',
    permanentAddress: values.permanentAddress || '',
    mailingAddress: values.mailingAddress || '',
    lengthOfStay: values.lengthOfStay || '',
  })
  Object.assign(requirements.otherInformation, {
    homeOwnership: values.homeOwnership || '',
    educationalAttainment: values.education || '',
    numberOfVehiclesOwned: numberValue('numberOfVehiclesOwned'),
    deviceVerified: booleanValue('deviceVerified', requirements.otherInformation.deviceVerified),
    hasCoBorrower: profile.coBorrowers.length > 0,
  })
  Object.assign(requirements.employmentInformation, {
    employmentStatus: values.employmentStatus || '',
    employmentLocation: values.employmentLocation || '',
    employerBusinessName: values.employerName || values.employmentHistory || '',
    employerBusinessYears: numberValue('employerBusinessYears'),
    officeAddress: values.officeAddress || '',
    occupation: values.occupation || '',
    position: values.position || '',
    natureOfWorkBusiness: values.natureOfWorkBusiness || '',
    dateHired: values.dateHired || '',
    officePhoneNumber: values.officePhoneNumber || '',
    previousEmployer: values.previousEmployer || '',
    totalYearsWorking: values.totalYearsWorking || '',
    grossMonthlyIncome: numberValue('monthlyIncome'),
    monthlyLivingExpenses: numberValue('monthlyExpenses'),
    otherSourcesOfIncome: numberValue('otherIncome'),
    investmentIncome: numberValue('investmentIncome'),
    businessIncome: numberValue('businessIncome'),
    pensionIncome: numberValue('pensionIncome'),
  })
  Object.assign(requirements.spouseInformation, {
    fullName: values.spouseFullName || '',
    dateOfBirth: values.spouseDateOfBirth || '',
    placeOfBirth: values.spousePlaceOfBirth || '',
    citizenship: values.spouseCitizenship || '',
    mobileNumber: values.spouseMobileNumber || '',
    presentAddress: values.spousePresentAddress || '',
    employerBusinessName: values.spouseEmployerBusinessName || '',
    officeAddress: values.spouseOfficeAddress || '',
    occupation: values.spouseOccupation || '',
    position: values.spousePosition || '',
    natureOfWork: values.spouseNatureOfWork || '',
    yearsWithEmployer: values.spouseYearsWithEmployer || '',
    previousEmployer: values.spousePreviousEmployer || '',
    totalYearsWorking: values.spouseTotalYearsWorking || '',
    grossMonthlyIncome: numberValue('spouseGrossMonthlyIncome'),
    monthlyExpenses: numberValue('spouseMonthlyExpenses'),
    otherIncomeSources: values.spouseOtherIncomeSources || '',
  })
  requirements.coBorrowers = profile.coBorrowers.map((item) => ({
    name: item.name,
    relationship: item.relationship,
    monthlyIncome: Number(item.monthlyIncome) || 0,
    debtObligations: Number(item.debtObligations) || 0,
    creditStanding: item.creditStanding,
  }))

  for (const key of Object.keys(requirements.bankingRelationships)) {
    const currentValue = requirements.bankingRelationships[key as keyof typeof requirements.bankingRelationships]
    const value = values[key]
    if (value === undefined) continue
    Object.assign(requirements.bankingRelationships, {
      [key]: typeof currentValue === 'number' ? numberValue(key) : value,
    })
  }
  for (const key of Object.keys(requirements.enhancedDueDiligence)) {
    const currentValue = requirements.enhancedDueDiligence[key as keyof typeof requirements.enhancedDueDiligence]
    const value = values[key]
    if (value === undefined) continue
    Object.assign(requirements.enhancedDueDiligence, {
      [key]: typeof currentValue === 'boolean'
        ? booleanValue(key)
        : typeof currentValue === 'number' ? numberValue(key) : value,
    })
  }
  Object.assign(requirements.fraudVerification, {
    faceMatchScore: numberValue('faceMatchScore', requirements.fraudVerification.faceMatchScore),
    livenessDetection: values.livenessDetection || requirements.fraudVerification.livenessDetection,
    incomeDocumentsStatus: values.incomeDocumentsStatus || requirements.fraudVerification.incomeDocumentsStatus,
    employmentVerificationStatus: values.employmentVerificationStatus || requirements.fraudVerification.employmentVerificationStatus,
    bankStatementVerificationStatus: values.bankStatementVerificationStatus || requirements.fraudVerification.bankStatementVerificationStatus,
  })
  requirements.documentAnalysis.ocrAnalysisStatus = values.ocrAnalysisStatus || requirements.documentAnalysis.ocrAnalysisStatus
  Object.assign(requirements.collateralAssetDetails, {
    securityClassification: values.securityClassification || '',
    assetType: values.assetType || '',
    maker: values.maker || '',
    brand: values.brand || '',
    model: values.model || '',
    year: values.year || '',
    vehicleConditionCategory: values.vehicleConditionCategory || '',
    vehicleTypeCategory: values.vehicleTypeCategory || '',
    motorcycleIntendedUse: values.motorcycleIntendedUse || '',
    useAsCollateral: booleanValue('useAsCollateral', requirements.collateralAssetDetails.useAsCollateral),
    insuranceProviderCompany: values.insuranceProviderCompany || '',
    policyNumber: values.policyNumber || '',
    orNumber: values.orNumber || '',
    crNumber: values.crNumber || '',
    additionalCollaterals: profile.additionalCollaterals.map((item) => ({
      collateralType: item.collateralType,
      propertyType: item.propertyType,
      maker: item.maker,
      brand: item.brand,
      model: item.model,
      year: item.year,
      appraisedValue: Number(item.appraisedValue) || 0,
      insuranceProviderCompany: item.insuranceProviderCompany,
      policyNumber: item.policyNumber,
      orNumber: item.orNumber,
      crNumber: item.crNumber,
      tctCctNumber: item.tctCctNumber,
      notes: item.notes,
    })),
  })
  Object.assign(requirements.collateralInformation, {
    propertyAddress: values.propertyAddress || '',
    registeredOwner: values.registeredOwner || '',
    lotNumber: values.lotNumber || '',
    blockNumber: values.blockNumber || '',
    tctCctNumber: values.tctCctNumber || '',
    propertyMarketabilityCategory: values.propertyMarketabilityCategory || '',
    houseUnitModelCategory: values.houseUnitModelCategory || '',
    collateralOccupancyType: values.collateralOccupancyType || '',
    propertyAppraisedValue: numberValue('propertyAppraisedValue'),
  })
  requirements.psychometricAssessment = Object.fromEntries(CREDIT_VALUES_QUESTIONS.map((question) => {
    const selected = values[`creditValues.${question.field}`] || ''
    const optionIndex = question.options.indexOf(selected)
    return [question.field.padStart(3, '0'), optionIndex >= 0 ? String(4 - optionIndex) : '']
  }))
  requirements.buildProfile = JSON.parse(JSON.stringify(profile)) as Record<string, unknown>

  return {
    ...source,
    application_no: source.application_no,
    product_type: (values.productType || source.product_type) as LoanApplicationPayload['product_type'],
    borrower_name: values.fullName || source.borrower_name,
    email: values.email || '',
    phone: values.mobileNumber || '',
    gov_id: values.governmentId || values.otherGovernmentIdNumber || '',
    address: values.address || '',
    monthly_income: numberValue('monthlyIncome'),
    other_income: numberValue('otherIncome'),
    debt_obligations: numberValue('debtObligations'),
    loan_amount: numberValue('requestedAmount'),
    term_months: numberValue('loanTerm'),
    interest_rate: numberValue('interestRate'),
    purpose: values.loanPurpose || '',
    vehicle_info: [values.maker, values.brand, values.model, values.year].filter(Boolean).join(' '),
    appraised_value: numberValue('appraisedValue', numberValue('propertyAppraisedValue')),
    requirements,
  }
}

export default function BuildProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedApplicationNo = searchParams.get('applicationNo')?.trim() || ''
  const [profile, setProfile] = useState<ProfileData>(loadProfile)
  const [sourceApplication, setSourceApplication] = useState<LoanApplicationRecord | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [wealthSectionFilter, setWealthSectionFilter] = useState<'all' | StatementSection>('all')
  const [wealthCategoryFilter, setWealthCategoryFilter] = useState('all')
  const [wealthLineSearch, setWealthLineSearch] = useState('')
  const [targetSectionFilter, setTargetSectionFilter] = useState<'all' | StatementSection>('all')
  const [targetCategoryFilter, setTargetCategoryFilter] = useState('all')
  const [targetLineSearch, setTargetLineSearch] = useState('')
  const [isTargetReviewExpanded, setIsTargetReviewExpanded] = useState(false)
  const [varianceSectionFilter, setVarianceSectionFilter] = useState<'all' | StatementSection>('all')
  const [varianceCategoryFilter, setVarianceCategoryFilter] = useState('all')
  const [varianceLineSearch, setVarianceLineSearch] = useState('')
  const currentStep = WORKFLOW_STEPS.find((item) => item.id === profile.step) ?? WORKFLOW_STEPS[0]

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      persistProfileSnapshot(profile)
    }, 150)
    return () => window.clearTimeout(timeout)
  }, [profile])

  useEffect(() => {
    if (!requestedApplicationNo) return

    let cancelled = false
    setSaveMessage(`Loading profile ${requestedApplicationNo}...`)
    void loadProfileApplication(requestedApplicationNo)
      .then((application) => {
        if (cancelled) return
        setProfile((current) => profileFromLoanApplication(application, current))
        setSourceApplication(application)
        setSaveMessage(`Profile ${requestedApplicationNo} loaded.`)
      })
      .catch(() => {
        if (!cancelled) setSaveMessage(`Unable to load profile ${requestedApplicationNo}.`)
      })

    return () => {
      cancelled = true
    }
  }, [requestedApplicationNo])

  const stepCompletion = useMemo(() => {
    const result = {} as Record<ProfileStep, number>
    WORKFLOW_STEPS.forEach(({ id }) => {
      if (id === 8) {
        const completedFields = [profile.values.asOfDate, profile.values.financialGoal, profile.values.wealthCurrency || 'PHP'].filter((value) => value?.trim()).length
        result[id] = Math.round((completedFields / 3) * 100)
      }
      else if (id === 9) {
        const editableEntries = NET_WORTH_STATEMENT_ENTRIES.filter((entry) => !entry.autoGenerated)
        const enteredRatio = editableEntries.filter((entry) => profile.values[entry.id]?.trim()).length / editableEntries.length
        const expenseEntries = editableEntries.filter((entry) => entry.section === 'monthly-expenses' && Number(profile.values[entry.id] || 0) > 0)
        const allocationTotal = expenseEntries.reduce((sum, entry) => sum + Number(profile.values[`wealthAllocation.${entry.id}`] || 0), 0)
        const allocationReady = expenseEntries.length === 0 || Math.abs(100 - allocationTotal) < 0.01
        result[id] = profile.values.wealthSetupSaved === 'true'
          ? 100
          : Math.round(((enteredRatio * 0.65) + (allocationReady ? 0.15 : 0)) * 100)
      }
      else if (id === 10) {
        const targetEntries = NET_WORTH_STATEMENT_ENTRIES.filter((entry) => Number(profile.values[`wealthTarget.${entry.id}`] || 0) > 0)
        if (targetEntries.length === 0) result[id] = 0
        else {
          const actualRatio = targetEntries.filter((entry) => profile.values[`wealthActual.${entry.id}`]?.trim()).length / targetEntries.length
          const notesRatio = targetEntries.filter((entry) => profile.values[`wealthVarianceNote.${entry.id}`]?.trim()).length / targetEntries.length
          result[id] = Math.round(((actualRatio * 0.8) + (notesRatio * 0.2)) * 100)
        }
      }
      else if (id === 11) result[id] = Math.round((SUITABILITY_QUESTIONS.filter((question) => profile.suitabilityAnswers[question.key]).length / SUITABILITY_QUESTIONS.length) * 100)
      else if (id === 12) {
        const openedLinks = ['creditHealthScoreOpened', 'wealthBuildingScoreOpened'].filter((key) => profile.values[key] === 'true').length
        result[id] = openedLinks * 50
      }
      else if (id === 3) {
        const completedFields = STEP_3_FIELDS.filter((field) => {
          if (field.key === 'grossMonthlyIncome') return Number(profile.values.monthlyIncome || 0) + Number(profile.values.otherIncome || 0) > 0
          return profile.values[field.key] !== undefined && profile.values[field.key] !== ''
        }).length
        const answeredQuestions = CREDIT_VALUES_QUESTIONS.filter((question) => profile.values[`creditValues.${question.field}`]?.trim()).length
        result[id] = Math.round(((completedFields + answeredQuestions) / (STEP_3_FIELDS.length + CREDIT_VALUES_QUESTIONS.length)) * 100)
      }
      else if (id === 4) {
        const spouseApplicable = profile.values.civilStatus === 'Married'
        const coBorrowerApplicable = profile.values.hasCoBorrower === 'true'
        const guarantorApplicable = profile.values.hasGuarantor === 'true'
        const applicableChecks = [
          ...(spouseApplicable ? SPOUSE_EMPLOYMENT_FIELDS.map((field) => Boolean(profile.values[field.key]?.trim())) : []),
          ...(coBorrowerApplicable
            ? profile.coBorrowers.length > 0
              ? profile.coBorrowers.flatMap((item) => CO_BORROWER_FIELDS.map((field) => Boolean(item[field.key as keyof CoBorrower]?.trim())))
              : CO_BORROWER_FIELDS.map(() => false)
            : []),
          ...(guarantorApplicable
            ? profile.guarantors.length > 0
              ? profile.guarantors.flatMap((item) => GUARANTOR_FIELDS.map((field) => Boolean(item[field.key as keyof Guarantor]?.trim())))
              : GUARANTOR_FIELDS.map(() => false)
            : []),
        ]
        result[id] = applicableChecks.length === 0 ? 0 : Math.round((applicableChecks.filter(Boolean).length / applicableChecks.length) * 100)
      }
      else if (id === 5) {
        const completedFields = BANKING_RELATIONSHIP_FIELDS.filter((field) => profile.values[field.key]?.trim()).length
        result[id] = Math.round((completedFields / BANKING_RELATIONSHIP_FIELDS.length) * 100)
      }
      else if (id === 6) {
        const completedFields = GOAL_SETTING_FIELDS.filter((field) => field.type === 'number'
          ? Number(profile.values[field.key] || 0) > 0
          : Boolean(profile.values[field.key]?.trim())).length
        result[id] = Math.round((completedFields / GOAL_SETTING_FIELDS.length) * 100)
      }
      else if (id === 7) {
        const productType = profile.values.productType
        const primaryFields = productType === 'Auto Loan' ? AUTO_LOAN_FIELDS
          : productType === 'Motorcycle Loan' ? MOTORCYCLE_LOAN_FIELDS
            : productType === 'Home Loan' ? HOME_LOAN_FIELDS : []
        const securityValid = productType === 'Auto Loan' ? profile.values.securityClassification === 'Secured'
          : ['Credit Card', 'Personal Loan', 'Margin Loan'].includes(productType) ? profile.values.securityClassification === 'Unsecured'
            : Boolean(profile.values.securityClassification?.trim())
        const checks = [
          securityValid,
          ...primaryFields.map((field) => field.type === 'number' ? Number(profile.values[field.key] || 0) > 0 : Boolean(profile.values[field.key]?.trim())),
          ...profile.additionalCollaterals.flatMap((item) => ['collateralType', 'maker', 'brand', 'model', 'year'].map((key) => Boolean(item[key as keyof AdditionalCollateral]?.trim())).concat(Number(item.appraisedValue) > 0)),
        ]
        result[id] = Math.round((checks.filter(Boolean).length / checks.length) * 100)
      }
      else {
        const fields = STEP_FIELDS[id]
        if (id === 2) {
          const spouseApplicable = profile.values.civilStatus === 'Married'
          const checks = [
            ...(spouseApplicable ? SPOUSE_FIELDS.map((field) => Boolean(profile.values[field.key]?.trim())) : []),
            ...profile.dependents.flatMap((dependent) => [Boolean(dependent.name.trim()), Boolean(dependent.dateOfBirth.trim())]),
          ]
          result[id] = checks.length === 0
            ? profile.values.civilStatus && profile.values.dependents !== undefined ? 100 : 0
            : Math.round((checks.filter(Boolean).length / checks.length) * 100)
        } else result[id] = Math.round((fields.filter((field) => isCompletedFieldValue(profile.values[field.key], field.type)).length / fields.length) * 100)
      }
    })
    return result
  }, [profile])

  const completionPercent = Math.round(Object.values(stepCompletion).reduce((sum, percent) => sum + percent, 0) / WORKFLOW_STEPS.length)
  const profileStatus = completionPercent === 100 ? 'Complete' : completionPercent > 0 ? 'In Progress' : 'Getting Started'
  const updateValue = (key: string, value: string) => setProfile((current) => ({
    ...current,
    values: {
      ...current.values,
      [key]: value,
      ...(key === 'dateOfBirth' ? { age: calculateAge(value) } : {}),
    },
    ...(key === 'dependents' ? {
      dependents: Array.from({ length: Math.max(0, Number(value) || 0) }, (_, index) => current.dependents[index] ?? createDependent()),
    } : {}),
  }))
  const goToStep = (step: ProfileStep) => setProfile((current) => ({ ...current, step }))

  const saveProfile = async () => {
    try {
      persistProfileSnapshot(profile)
      if (sourceApplication) {
        const payload = loanPayloadFromProfile(profile, sourceApplication)
        await updateLoanApplication(sourceApplication.application_no, payload)
        setSourceApplication({ ...sourceApplication, ...payload })
        setSaveMessage('Profile saved successfully and synchronized for FILSCORE computation.')
      } else {
        setSaveMessage('Profile saved in this browser. Select or create a loan record before FILSCORE computation.')
      }
    } catch {
      setSaveMessage('Unable to save and synchronize this profile.')
    }
  }

  const openScorePage = async (
    key: 'creditHealthScoreOpened' | 'wealthBuildingScoreOpened',
    destination: '/lending-scorecard/filscore' | '/net-worth-positioning',
  ) => {
    if (!sourceApplication) {
      setSaveMessage('Select or create a loan record before opening FILSCORE computation.')
      return
    }

    const updatedProfile = { ...profile, values: { ...profile.values, [key]: 'true' } }
    setProfile(updatedProfile)
    try {
      persistProfileSnapshot(updatedProfile)
      const payload = loanPayloadFromProfile(updatedProfile, sourceApplication)
      await updateLoanApplication(sourceApplication.application_no, payload)
      await recomputeStoredLoanApplicationScores(sourceApplication.application_no)
      navigate(`${destination}?applicationNo=${encodeURIComponent(sourceApplication.application_no)}`)
    } catch {
      setSaveMessage('Unable to synchronize profile data and compute FILSCORE right now.')
    }
  }

  const updateRelatedParty = <T extends CoBorrower | Guarantor>(
    collection: 'coBorrowers' | 'guarantors',
    id: string,
    field: keyof T,
    value: string,
  ) => setProfile((current) => ({
    ...current,
    [collection]: current[collection].map((item) => item.id === id ? { ...item, [field]: value } : item),
  }))

  const updateAdditionalCollateral = (id: string, field: keyof AdditionalCollateral, value: string) => setProfile((current) => ({
    ...current,
    additionalCollaterals: current.additionalCollaterals.map((item) => item.id === id ? { ...item, [field]: value } : item),
  }))

  const updateDependent = (id: string, field: 'name' | 'dateOfBirth', value: string) => setProfile((current) => ({
    ...current,
    dependents: current.dependents.map((dependent) => dependent.id === id ? { ...dependent, [field]: value } : dependent),
  }))

  const renderRelatedPartyField = (
    field: RelatedPartyField,
    value: string,
    onChange: (value: string) => void,
    labelPrefix: string,
  ) => <label key={field.key}>
    {labelPrefix}{field.label}
    {field.type === 'select' ? (
      <select aria-invalid={!value.trim()} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select...</option>
        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    ) : (
      <input aria-invalid={!value.trim()} type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
    )}
  </label>

  const renderField = (field: FieldDefinition) => (
    <label key={field.key} className={field.wide ? 'build-profile-field-wide' : undefined}>
      {field.label}
      {field.type === 'select' ? (
        <select aria-invalid={!isCompletedFieldValue(profile.values[field.key], field.type)} value={profile.values[field.key] ?? ''} onChange={(event) => updateValue(field.key, event.target.value)}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={profile.values[field.key] ?? ''} readOnly={field.readOnly} aria-readonly={field.readOnly || undefined} aria-invalid={!isCompletedFieldValue(profile.values[field.key], field.type)} onChange={(event) => updateValue(field.key, event.target.value)} />
      )}
    </label>
  )

  const renderStep3Field = (field: Step3Field) => {
    const value = field.key === 'grossMonthlyIncome'
      ? String(Number(profile.values.monthlyIncome || 0) + Number(profile.values.otherIncome || 0))
      : profile.values[field.key] ?? ''

    if (field.type === 'checkbox') {
      return <label key={field.key} className="build-profile-checkbox-field">
        <input aria-invalid={profile.values[field.key] === undefined} type="checkbox" checked={value === 'true'} onChange={(event) => updateValue(field.key, String(event.target.checked))} />
        <span>{field.label}</span>
      </label>
    }

    return <label key={field.key}>
      {field.label}
      {field.type === 'select' ? (
        <select aria-invalid={!value.trim()} value={value} onChange={(event) => updateValue(field.key, event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea aria-invalid={!value.trim()} rows={3} value={value} onChange={(event) => updateValue(field.key, event.target.value)} />
      ) : (
        <input aria-invalid={field.key === 'grossMonthlyIncome' ? Number(value) <= 0 : !value.trim()} type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={value} readOnly={field.readOnly} onChange={(event) => updateValue(field.key, event.target.value)} />
      )}
    </label>
  }

  const renderBankingField = (field: BankingField) => {
    const value = profile.values[field.key] ?? ''
    const datalistId = `build-profile-${field.key}-options`

    if (field.type === 'radio') {
      return <fieldset key={field.key} aria-invalid={!value.trim()} className="build-profile-banking-radio-field build-profile-field-wide">
        <legend>{field.label}</legend>
        <div className="build-profile-banking-radio-options">
          {field.options?.map((option) => <label key={option}>
            <input type="radio" name={field.key} value={option} checked={value === option} onChange={(event) => updateValue(field.key, event.target.value)} />
            <span>{option}</span>
          </label>)}
        </div>
      </fieldset>
    }

    return <label key={field.key}>
      {field.label}
      {field.type === 'select' ? (
        <select aria-invalid={!value.trim()} value={value} onChange={(event) => updateValue(field.key, event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea aria-invalid={!value.trim()} rows={field.rows ?? 3} value={value} onChange={(event) => updateValue(field.key, event.target.value)} />
      ) : field.type === 'datalist' ? (
        <>
          <input aria-invalid={!value.trim()} list={datalistId} value={value} placeholder="Enter card issuer" onChange={(event) => updateValue(field.key, event.target.value)} />
          <datalist id={datalistId}>{field.options?.map((option) => <option key={option} value={option} />)}</datalist>
        </>
      ) : (
        <input aria-invalid={!value.trim()} type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={value} onChange={(event) => updateValue(field.key, event.target.value)} />
      )}
    </label>
  }

  const renderCollateralField = (field: CollateralField, value: string, onChange: (value: string) => void, prefix = '') => <label key={field.key} className={field.type === 'textarea' ? 'build-profile-field-wide' : undefined}>
    {prefix}{field.label}
    {field.type === 'select' ? <select aria-invalid={!value.trim()} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select...</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
    </select> : field.type === 'textarea' ? <textarea aria-invalid={!value.trim()} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      : <input aria-invalid={field.type === 'number' ? Number(value) <= 0 : !value.trim()} type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={value} onChange={(event) => onChange(event.target.value)} />}
  </label>

  const renderCurrentStep = () => {
    if (profile.step === 2) {
      const spouseApplicable = profile.values.civilStatus === 'Married'
      return <div className="build-profile-step-content build-profile-step-two">
        <h3>Step 2: Spouse and Dependents</h3>
        {spouseApplicable ? <section className="build-profile-detail-section">
          <h4>Spouse Information</h4>
          <div className="build-profile-form-grid">
            {SPOUSE_FIELDS.map((field) => renderRelatedPartyField(field, profile.values[field.key] ?? '', (value) => updateValue(field.key, value), ''))}
          </div>
        </section> : <p className="build-profile-applicability-note">Spouse information is required only when Civil Status is Married.</p>}

        <section className="build-profile-detail-section">
          <div className="build-profile-section-heading"><h4>Dependents</h4><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, values: { ...current.values, dependents: String(current.dependents.length + 1) }, dependents: [...current.dependents, createDependent()] }))}>Add Dependent</button></div>
          {profile.dependents.length === 0 ? <p className="build-profile-applicability-note">No dependents added.</p> : <div className="build-profile-related-party-list">
            {profile.dependents.map((dependent, index) => <article key={dependent.id}>
              <div className="build-profile-section-heading"><h5>Dependent #{index + 1}</h5><button type="button" className="loan-footer-button" onClick={() => setProfile((current) => {
                const dependents = current.dependents.filter((item) => item.id !== dependent.id)
                return { ...current, values: { ...current.values, dependents: String(dependents.length) }, dependents }
              })}>Remove</button></div>
              <div className="build-profile-form-grid">
                <label>Dependent {index + 1} Full Name<input aria-invalid={!dependent.name.trim()} value={dependent.name} onChange={(event) => updateDependent(dependent.id, 'name', event.target.value)} /></label>
                <label>Dependent {index + 1} Date of Birth<input aria-invalid={!dependent.dateOfBirth.trim()} type="date" value={dependent.dateOfBirth} onChange={(event) => updateDependent(dependent.id, 'dateOfBirth', event.target.value)} /></label>
              </div>
            </article>)}
          </div>}
        </section>
      </div>
    }

    if (profile.step === 3) {
      const totalHouseholdIncome = Number(profile.values.monthlyIncome || 0) + Number(profile.values.otherIncome || 0)
      const totalExistingDebt = Number(profile.values.debtObligations || 0)
      const answeredCreditValues = CREDIT_VALUES_QUESTIONS.filter((question) => profile.values[`creditValues.${question.field}`]?.trim()).length

      return <div className="build-profile-step-content build-profile-step-three">
        <h3>Step 3: Source of Income &amp; Wealth and Credit Values</h3>
        <p className="psychometric-section-note">Complete employment, income, wealth, verification, and Credit Values details from the Lending Scorecard.</p>
        {STEP_3_SECTIONS.slice(0, 2).map((section, index) => <section key={section.title} className="build-profile-detail-section">
          <h4>{section.title}</h4>
          {section.note ? <p>{section.note}</p> : null}
          <div className="build-profile-form-grid">{section.fields.map(renderStep3Field)}</div>
          {index === 0 ? <div className="build-profile-totals-grid">
            <div><span>Total Household Income</span><strong>{formatCurrency(String(totalHouseholdIncome))}</strong></div>
            <div><span>Total Existing Debt</span><strong>{formatCurrency(String(totalExistingDebt))}</strong></div>
          </div> : null}
        </section>)}

        {STEP_3_SECTIONS.slice(2, 4).map((section) => <section key={section.title} className="build-profile-detail-section">
          <h4>{section.title}</h4>
          {section.note ? <p>{section.note}</p> : null}
          <div className="build-profile-form-grid">{section.fields.map(renderStep3Field)}</div>
        </section>)}

        <section className="build-profile-detail-section build-profile-credit-values">
          <h4>Credit Values Assessment Model</h4>
          <p>This assessment must be completed in less than an hour. No saving and reverting back.</p>
          <p className="psychometric-section-note">Completion: {answeredCreditValues}/{CREDIT_VALUES_QUESTIONS.length} questions answered.</p>
          <div className="build-profile-credit-values-sections">
            {CREDIT_VALUES_SECTIONS.map((section) => <section key={section.id}>
              <h5>Section {section.id}: {section.title}</h5>
              <div className="build-profile-form-grid">
                {section.questions.map((question, index) => <label key={question.field}>
                  {index + 1}. {question.prompt}
                  <select aria-invalid={!profile.values[`creditValues.${question.field}`]?.trim()} value={profile.values[`creditValues.${question.field}`] ?? ''} onChange={(event) => updateValue(`creditValues.${question.field}`, event.target.value)}>
                    <option value="">Select...</option>
                    {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>)}
              </div>
            </section>)}
          </div>
        </section>

        {STEP_3_SECTIONS.slice(4).map((section) => <section key={section.title} className="build-profile-detail-section">
          <h4>{section.title}</h4>
          {section.note ? <p>{section.note}</p> : null}
          <div className="build-profile-form-grid">{section.fields.map(renderStep3Field)}</div>
        </section>)}
      </div>
    }

    if (profile.step === 4) {
      const spouseApplicable = profile.values.civilStatus === 'Married'
      const coBorrowerApplicable = profile.values.hasCoBorrower === 'true'
      const guarantorApplicable = profile.values.hasGuarantor === 'true'
      const addCoBorrower = () => setProfile((current) => ({
        ...current,
        values: { ...current.values, hasCoBorrower: 'true' },
        coBorrowers: [...current.coBorrowers, createCoBorrower()],
      }))

      return <div className="build-profile-step-content build-profile-step-four">
        <h3>Step 4: Spouse Employment, Co-Borrower, and Guarantor Information (as applicable)</h3>
        <p className="psychometric-section-note">Provide details only for the people applicable to your profile.</p>

        <section className="build-profile-detail-section">
          <h4>Applicability</h4>
          <div className="build-profile-form-grid">
            <label>Civil Status
              <input value={profile.values.civilStatus || 'Not selected in Step 1'} readOnly />
            </label>
            <label>Co-Borrower
              <select value={coBorrowerApplicable ? 'true' : 'false'} onChange={(event) => {
                const enabled = event.target.value === 'true'
                updateValue('hasCoBorrower', String(enabled))
                if (enabled && profile.coBorrowers.length === 0) setProfile((current) => ({ ...current, values: { ...current.values, hasCoBorrower: 'true' }, coBorrowers: [createCoBorrower()] }))
              }}>
                <option value="false">No Co-Borrower</option>
                <option value="true">With Co-Borrower - Fill out details below</option>
              </select>
            </label>
            <label>Guarantor
              <select value={guarantorApplicable ? 'true' : 'false'} onChange={(event) => {
                const enabled = event.target.value === 'true'
                updateValue('hasGuarantor', String(enabled))
                if (enabled && profile.guarantors.length === 0) setProfile((current) => ({ ...current, values: { ...current.values, hasGuarantor: 'true' }, guarantors: [createGuarantor()] }))
              }}>
                <option value="false">No Guarantor</option>
                <option value="true">With Guarantor - Fill out details below</option>
              </select>
            </label>
          </div>
        </section>

        {spouseApplicable ? <section className="build-profile-detail-section">
          <h4>Spouse Employment Information</h4>
          <div className="build-profile-form-grid">
            {SPOUSE_EMPLOYMENT_FIELDS.map((field) => renderRelatedPartyField(field, profile.values[field.key] ?? '', (value) => updateValue(field.key, value), ''))}
          </div>
        </section> : <p className="build-profile-applicability-note">Spouse information is not required because Civil Status is not Married.</p>}

        <section className="build-profile-detail-section">
          <div className="build-profile-section-heading">
            <h4>Co-Borrower Information</h4>
            <button type="button" className="loan-inline-button loan-inline-button-primary" onClick={addCoBorrower}>+ Add a Co-Borrower</button>
          </div>
          {coBorrowerApplicable && profile.coBorrowers.length > 0 ? <div className="build-profile-related-party-list">
            {profile.coBorrowers.map((item, index) => <article key={item.id}>
              <div className="build-profile-section-heading"><h5>Co-Borrower #{index + 1}</h5><button type="button" className="loan-footer-button" onClick={() => setProfile((current) => {
                const coBorrowers = current.coBorrowers.filter((record) => record.id !== item.id)
                return { ...current, values: { ...current.values, hasCoBorrower: String(coBorrowers.length > 0) }, coBorrowers }
              })}>Remove</button></div>
              <div className="build-profile-form-grid">{CO_BORROWER_FIELDS.map((field) => renderRelatedPartyField(field, item[field.key as keyof CoBorrower], (value) => updateRelatedParty<CoBorrower>('coBorrowers', item.id, field.key as keyof CoBorrower, value), `Co-Borrower ${index + 1} `))}</div>
            </article>)}
          </div> : <p className="build-profile-applicability-note">No co-borrower has been added. Select “+ Add a Co-Borrower” to include one.</p>}
        </section>

        {guarantorApplicable ? <section className="build-profile-detail-section">
          <div className="build-profile-section-heading"><h4>Guarantor Information</h4><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, guarantors: [...current.guarantors, createGuarantor()] }))}>Add Guarantor</button></div>
          <div className="build-profile-related-party-list">
            {profile.guarantors.map((item, index) => <article key={item.id}>
              <div className="build-profile-section-heading"><h5>Guarantor #{index + 1}</h5><button type="button" className="loan-footer-button" onClick={() => setProfile((current) => ({ ...current, guarantors: current.guarantors.filter((record) => record.id !== item.id) }))}>Remove</button></div>
              <div className="build-profile-form-grid">{GUARANTOR_FIELDS.map((field) => renderRelatedPartyField(field, item[field.key as keyof Guarantor], (value) => updateRelatedParty<Guarantor>('guarantors', item.id, field.key as keyof Guarantor, value), `Guarantor ${index + 1} `))}</div>
            </article>)}
          </div>
        </section> : <p className="build-profile-applicability-note">Guarantor information is not required.</p>}
      </div>
    }

    if (profile.step === 5) {
      return <div className="build-profile-step-content build-profile-step-five">
        <h3>Step 5: Banking Relationships</h3>
        <p className="psychometric-section-note">Complete the same banking relationship and due-diligence information used by the Lending Scorecard.</p>
        {BANKING_RELATIONSHIP_SECTIONS.map((section) => <section key={section.title} className="build-profile-detail-section">
          <h4>{section.title}</h4>
          {section.description ? <p>{section.description}</p> : null}
          <div className="build-profile-form-grid">{section.fields.map(renderBankingField)}</div>
        </section>)}
      </div>
    }

    if (profile.step === 6) {
      const requestedAmount = Number(profile.values.requestedAmount || 0)
      const termMonths = Number(profile.values.loanTerm || 0)
      const interestRate = Number(profile.values.interestRate || 0)
      const appraisedValue = Number(profile.values.appraisedValue || 0)
      const monthlyAmortization = calculateMonthlyAmortization(requestedAmount, termMonths, interestRate)
      const loanToValue = appraisedValue > 0 ? (requestedAmount / appraisedValue) * 100 : 0

      return <div className="build-profile-step-content build-profile-step-six">
        <h3>Step 6: Goal Setting</h3>
        <section className="build-profile-detail-section">
          <h4>Product Information</h4>
          <div className="build-profile-form-grid">
            {GOAL_SETTING_FIELDS.map((field) => <label key={field.key} className={field.key === 'loanPurpose' ? 'build-profile-field-wide' : undefined}>
              {field.label}
              {field.type === 'select' ? <select aria-invalid={!profile.values[field.key]?.trim()} value={profile.values[field.key] ?? ''} onChange={(event) => updateValue(field.key, event.target.value)}>
                <option value="">Select...</option>
                {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
              </select> : field.key === 'requestedAmount' ? <NumericFormat
                aria-invalid={Number(profile.values.requestedAmount || 0) <= 0}
                value={profile.values.requestedAmount ?? ''}
                valueIsNumericString
                thousandSeparator="," decimalScale={2} fixedDecimalScale
                inputMode="decimal"
                onValueChange={({ value }) => updateValue(field.key, value)}
              /> : <input aria-invalid={field.type === 'number' ? Number(profile.values[field.key] || 0) <= 0 : !profile.values[field.key]?.trim()} type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={profile.values[field.key] ?? ''} onChange={(event) => updateValue(field.key, event.target.value)} />}
            </label>)}
          </div>
          <div className="build-profile-totals-grid">
            <div><span>Est. Monthly Amortization</span><strong>{formatNumber(monthlyAmortization)}</strong></div>
            <div><span>Loan-to-Value Ratio (LTV)</span><strong>{appraisedValue > 0 ? `${loanToValue.toFixed(1)}%` : 'Pending collateral value'}</strong></div>
          </div>
        </section>

        <section className="build-profile-detail-section">
          <p>Take a picture of a valid ID for inclusion and fasten profile review.</p>
          <label className="build-profile-upload-zone">
            <input type="file" accept="image/*" capture="environment" onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setProfile((current) => ({ ...current, documents: [...current.documents, file.name] }))
              event.target.value = ''
            }} />
            <strong>Take Picture of ID</strong><span>Camera-captured image files</span>
          </label>
          {profile.documents.length > 0 ? <ul className="psychometric-breakdown-list">
            {profile.documents.map((document, index) => <li key={`${document}-${index}`}><span>{document}</span><strong>Ready for review</strong></li>)}
          </ul> : null}
        </section>
      </div>
    }

    if (profile.step === 7) {
      const productType = profile.values.productType
      const vehicleFields = productType === 'Auto Loan' ? AUTO_LOAN_FIELDS : productType === 'Motorcycle Loan' ? MOTORCYCLE_LOAN_FIELDS : []
      const unsecuredProduct = ['Credit Card', 'Personal Loan', 'Margin Loan'].includes(productType)
      const securityValid = productType === 'Auto Loan' ? profile.values.securityClassification === 'Secured'
        : unsecuredProduct ? profile.values.securityClassification === 'Unsecured'
          : Boolean(profile.values.securityClassification?.trim())

      return <div className="build-profile-step-content build-profile-step-seven">
        <h3>Step 7: Collateral Assets (based on Goal and Product Requested).</h3>
        <p className="psychometric-section-note">Collateral requirements are based on the product selected in Step 6: {productType || 'No product selected'}.</p>
        {!productType ? <p className="build-profile-applicability-note">Select a product in Step 6 to display its collateral requirements.</p> : null}

        <section className="build-profile-detail-section">
          <fieldset aria-invalid={!securityValid} className="build-profile-banking-radio-field build-profile-field-wide">
            <legend>Security Classification</legend>
            <div className="build-profile-banking-radio-options">
              {['Secured', 'Unsecured', 'Lease'].map((classification) => <label key={classification}>
                <input type="radio" name="securityClassification" value={classification} checked={profile.values.securityClassification === classification} onChange={(event) => updateValue('securityClassification', event.target.value)} />
                <span>{classification}</span>
              </label>)}
            </div>
          </fieldset>
          {productType === 'Auto Loan' ? <p className="build-profile-collateral-rule"><strong>Auto Loan - Mandatory:</strong> Select <strong>Secured</strong>.</p> : null}
          {unsecuredProduct ? <p className="build-profile-applicability-note">Asset details are not required for unsecured loans; select Unsecured above.</p> : null}
        </section>

        {vehicleFields.length > 0 ? <section className="build-profile-detail-section">
          <h4>{productType === 'Motorcycle Loan' ? 'Motorcycle Information' : 'Asset / Vehicle Information'}</h4>
          <div className="build-profile-form-grid">{vehicleFields.map((field) => renderCollateralField(field, profile.values[field.key] ?? '', (value) => updateValue(field.key, value)))}</div>
          {productType === 'Motorcycle Loan' ? <fieldset className="build-profile-banking-radio-field build-profile-field-wide">
            <legend>Collateral Use</legend><div className="build-profile-banking-radio-options">
              <label><input type="radio" name="useAsCollateral" value="true" checked={profile.values.useAsCollateral !== 'false'} onChange={() => updateValue('useAsCollateral', 'true')} /><span>To be used as collateral</span></label>
              <label><input type="radio" name="useAsCollateral" value="false" checked={profile.values.useAsCollateral === 'false'} onChange={() => updateValue('useAsCollateral', 'false')} /><span>Not to be used as collateral</span></label>
            </div>
          </fieldset> : null}
        </section> : null}

        {productType === 'Home Loan' ? <section className="build-profile-detail-section">
          <h4>Home Loan / Property Information</h4>
          <div className="build-profile-form-grid">{HOME_LOAN_FIELDS.map((field) => renderCollateralField(field, profile.values[field.key] ?? '', (value) => updateValue(field.key, value)))}</div>
        </section> : null}

        <section className="build-profile-detail-section">
          <div className="build-profile-section-heading"><h4>Additional Collaterals</h4><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, additionalCollaterals: [...current.additionalCollaterals, createAdditionalCollateral()] }))}>Add Collateral</button></div>
          {profile.additionalCollaterals.length === 0 ? <p className="build-profile-applicability-note">No additional collaterals added.</p> : <div className="build-profile-related-party-list">
            {profile.additionalCollaterals.map((item, index) => <article key={item.id}>
              <div className="build-profile-section-heading"><h5>Additional Collateral #{index + 1}</h5><button type="button" className="loan-footer-button" onClick={() => setProfile((current) => ({ ...current, additionalCollaterals: current.additionalCollaterals.filter((record) => record.id !== item.id) }))}>Remove</button></div>
              <div className="build-profile-form-grid">{ADDITIONAL_COLLATERAL_FIELDS.map((field) => renderCollateralField(field, item[field.key as keyof AdditionalCollateral], (value) => updateAdditionalCollateral(item.id, field.key as keyof AdditionalCollateral, value), `Additional Collateral ${index + 1} `))}</div>
            </article>)}
          </div>}
        </section>
      </div>
    }

    if (profile.step === 8) {
      const currency = profile.values.wealthCurrency || 'PHP'
      const targetAmount = Number(profile.values.targetAmount || 0)
      const targetMonths = Number(profile.values.targetMonths || 0)
      const wealthAmounts = Object.fromEntries(NET_WORTH_STATEMENT_ENTRIES.filter((entry) => !entry.autoGenerated).map((entry) => [entry.id, profile.values[entry.id] ?? '']))
      const wealthScore = computeNetWorthBuildingScore({
        amounts: wealthAmounts,
        selectedFinancialGoal: profile.values.financialGoal,
        targetAmount,
        targetMonths,
      })
      const formatWealthCurrency = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
      const formatSignedCurrency = (amount: number) => `${amount < 0 ? '-' : amount > 0 ? '+' : ''}${formatWealthCurrency(Math.abs(amount))}`
      const aiValues: Record<string, string> = {
        'ai-net-worth': formatSignedCurrency(wealthScore.metrics.netWorth),
        'ai-liquid-net-worth': formatSignedCurrency(wealthScore.metrics.liquidAssets),
        'ai-monthly-cash-flow': formatSignedCurrency(wealthScore.metrics.monthlyCashFlow),
        'ai-savings-rate': `${wealthScore.metrics.savingsRatePercent.toFixed(1)}%`,
        'ai-dti': `${wealthScore.metrics.debtToIncomeRatioPercent.toFixed(1)}%`,
        'ai-dta': `${wealthScore.metrics.debtToAssetRatioPercent.toFixed(1)}%`,
        'ai-emergency-fund-months': `${wealthScore.metrics.emergencyFundMonths.toFixed(1)} months`,
        'ai-credit-health': `${wealthScore.componentScores.leverageControl.toFixed(0)}/100`,
        'ai-investment-readiness': `${wealthScore.componentScores.investmentReadiness.toFixed(0)}/100`,
        'ai-retirement-readiness': `${wealthScore.componentScores.retirementReadiness.toFixed(0)}/100`,
        'ai-financial-independence-index': `${wealthScore.componentScores.financialIndependence.toFixed(0)}/100`,
        'ai-overall-financial-wellness': `${wealthScore.score} | ${wealthScore.grade} - ${wealthScore.rating}`,
      }
      const categories = [...new Set(NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => wealthSectionFilter === 'all' || entry.section === wealthSectionFilter)
        .map((entry) => entry.category))].sort()
      const normalizedSearch = wealthLineSearch.trim().toLowerCase()
      const filteredEntries = NET_WORTH_STATEMENT_ENTRIES.filter((entry) =>
        (wealthSectionFilter === 'all' || entry.section === wealthSectionFilter)
        && (wealthCategoryFilter === 'all' || entry.category === wealthCategoryFilter)
        && (!normalizedSearch || entry.label.toLowerCase().includes(normalizedSearch)))

      return <div className="build-profile-step-content build-profile-step-eight">
        <h3>Step 8: Wealth Position Base Setting</h3>
        <p className="psychometric-section-note">FILSCORE Personal Net Worth Statement. Set the As Of Date, choose your financial goal, enter your target amount and target period, then encode all applicable statement lines.</p>

        <section className="build-profile-detail-section">
          <h4>Personal Net Worth Statement</h4>
          <div className="build-profile-form-grid">
            <label>Financial Goal
              <select aria-invalid={!profile.values.financialGoal?.trim()} value={profile.values.financialGoal ?? ''} onChange={(event) => updateValue('financialGoal', event.target.value)}>
                <option value="">Select Financial Goal</option>
                {NET_WORTH_FINANCIAL_GOAL_OPTIONS.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
              </select>
            </label>
            <label>Target Amount
              <input type="number" min="0" step="0.01" value={profile.values.targetAmount ?? ''} onChange={(event) => updateValue('targetAmount', event.target.value)} />
            </label>
            <label>Months to Achieve
              <input type="number" min="1" value={profile.values.targetMonths ?? '12'} onChange={(event) => updateValue('targetMonths', event.target.value)} />
            </label>
            <label>As Of
              <input aria-invalid={!profile.values.asOfDate?.trim()} type="date" value={profile.values.asOfDate ?? ''} onChange={(event) => updateValue('asOfDate', event.target.value)} />
            </label>
            <label>Currency
              <select value={currency} aria-label="Statement currency" onChange={(event) => updateValue('wealthCurrency', event.target.value)}>
                {CURRENCY_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <div className="build-profile-totals-grid">
            <div><span>Monthly Savings Required</span><strong>{formatWealthCurrency(targetMonths > 0 ? targetAmount / targetMonths : 0)}</strong></div>
            <div><span>Current Setup Net Worth</span><strong>{formatSignedCurrency(wealthScore.metrics.netWorth)}</strong></div>
          </div>
        </section>

        <section className="build-profile-detail-section">
          <h4>Statement Filters</h4>
          <div className="build-profile-form-grid">
            <label>Statement Section
              <select aria-label="Filter by statement section" value={wealthSectionFilter} onChange={(event) => {
                setWealthSectionFilter(event.target.value as 'all' | StatementSection)
                setWealthCategoryFilter('all')
              }}>
                <option value="all">All Sections</option>
                {STEP1_SECTION_ORDER.map((section) => <option key={section} value={section}>{STEP1_SECTION_SHORT_LABELS[section]}</option>)}
              </select>
            </label>
            <label>Account Group
              <select aria-label="Filter by account group" value={wealthCategoryFilter} onChange={(event) => setWealthCategoryFilter(event.target.value)}>
                <option value="all">All Account Groups</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>Line Item
              <input type="search" aria-label="Filter by line item" placeholder="Search line item" value={wealthLineSearch} onChange={(event) => setWealthLineSearch(event.target.value)} />
            </label>
            <div className="build-profile-filter-result"><span>Matching Rows</span><strong>{filteredEntries.length}</strong><button type="button" className="loan-footer-button" onClick={() => { setWealthSectionFilter('all'); setWealthCategoryFilter('all'); setWealthLineSearch('') }}>Clear Filters</button></div>
          </div>
        </section>

        <div className="build-profile-wealth-sections">
          {STEP1_SECTION_ORDER.map((section) => {
            const entries = filteredEntries.filter((entry) => entry.section === section)
            return <details key={section} className="build-profile-detail-section" open={wealthSectionFilter === section || (wealthSectionFilter === 'all' && section === 'assets')}>
              <summary>{STEP1_SECTION_SHORT_LABELS[section]} <span>({entries.length})</span></summary>
              {entries.length === 0 ? <p className="psychometric-section-note">No matching sub-accounts in this section for current filters.</p> : <div className="build-profile-wealth-entry-grid">
                {entries.map((entry) => <label key={entry.id}>
                  <span>{entry.label}</span><small>{entry.category}</small>
                  {entry.autoGenerated ? <output>{aiValues[entry.id] ?? 'Auto-calculated'}</output> : <input aria-invalid={!profile.values[entry.id]?.trim()} type="number" min="0" step="0.01" value={profile.values[entry.id] ?? ''} placeholder="0" aria-label={`${entry.label} setup amount`} onChange={(event) => updateValue(entry.id, event.target.value)} />}
                </label>)}
              </div>}
            </details>
          })}
        </div>
      </div>
    }

    if (profile.step === 9) {
      const currency = profile.values.wealthCurrency || 'PHP'
      const formatTargetCurrency = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
      const setupRows = NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => !entry.autoGenerated)
        .map((entry) => ({ ...entry, amount: Math.max(0, Number(profile.values[entry.id] || 0)) }))
      const reviewRows = setupRows.filter((entry) => entry.amount > 0)
      const expenseRows = reviewRows.filter((entry) => entry.section === 'monthly-expenses')
      const monthlyExpenseTotal = expenseRows.reduce((sum, entry) => sum + entry.amount, 0)
      const allocationValue = (entryId: string, amount: number) => {
        const stored = profile.values[`wealthAllocation.${entryId}`]
        if (stored !== undefined) return Number(stored)
        return monthlyExpenseTotal > 0 ? (amount / monthlyExpenseTotal) * 100 : 0
      }
      const allocationTotal = expenseRows.reduce((sum, entry) => sum + allocationValue(entry.id, entry.amount), 0)
      const allocationVariance = Number((100 - allocationTotal).toFixed(2))
      const allocationBalanced = expenseRows.length === 0 || Math.abs(allocationVariance) < 0.01
      const assetsTotal = reviewRows.filter((entry) => entry.section === 'assets').reduce((sum, entry) => sum + entry.amount, 0)
      const liabilitiesTotal = reviewRows.filter((entry) => entry.section === 'liabilities').reduce((sum, entry) => sum + entry.amount, 0)
      const categories = [...new Set(reviewRows
        .filter((entry) => targetSectionFilter === 'all' || entry.section === targetSectionFilter)
        .map((entry) => entry.category))].sort()
      const normalizedSearch = targetLineSearch.trim().toLowerCase()
      const filteredRows = reviewRows.filter((entry) =>
        (targetSectionFilter === 'all' || entry.section === targetSectionFilter)
        && (targetCategoryFilter === 'all' || entry.category === targetCategoryFilter)
        && (!normalizedSearch || entry.label.toLowerCase().includes(normalizedSearch)))

      const normalizeAllocations = () => {
        const currentTotal = expenseRows.reduce((sum, entry) => sum + allocationValue(entry.id, entry.amount), 0)
        if (currentTotal <= 0) {
          setSaveMessage('Enter monthly expense allocation percentages first before normalizing to 100%.')
          return
        }
        let runningTotal = 0
        setProfile((current) => {
          const values = { ...current.values }
          expenseRows.forEach((entry, index) => {
            const normalized = index === expenseRows.length - 1
              ? Math.max(0, 100 - runningTotal)
              : Number(((allocationValue(entry.id, entry.amount) / currentTotal) * 100).toFixed(2))
            runningTotal += normalized
            values[`wealthAllocation.${entry.id}`] = String(normalized)
          })
          return { ...current, values }
        })
        setSaveMessage('Monthly expense allocation percentages were normalized to 100%.')
      }

      const applyAllocations = () => {
        if (!allocationBalanced) {
          setSaveMessage(`Monthly expense allocation must total 100%. Current variance is ${allocationVariance.toFixed(2)}%.`)
          return
        }
        if (monthlyExpenseTotal <= 0) {
          setSaveMessage('Enter monthly expense setup amounts in Step 8 before applying revised allocation percentages.')
          return
        }
        let allocatedTotal = 0
        setProfile((current) => {
          const values = { ...current.values }
          expenseRows.forEach((entry, index) => {
            const amount = index === expenseRows.length - 1
              ? monthlyExpenseTotal - allocatedTotal
              : Number(((monthlyExpenseTotal * allocationValue(entry.id, entry.amount)) / 100).toFixed(2))
            allocatedTotal += amount
            values[entry.id] = amount.toFixed(2)
          })
          return { ...current, values }
        })
        setSaveMessage('Monthly expense setup amounts were recalculated using the revised allocation percentages.')
      }

      const saveTargetSetup = () => {
        if (!profile.values.asOfDate) {
          setSaveMessage('Please set the As Of date in Step 8 before saving this targeted goal setup.')
          return
        }
        if (!allocationBalanced) {
          setSaveMessage(`Monthly expense allocation must stay at 100%. Current variance is ${allocationVariance.toFixed(2)}%.`)
          return
        }
        if (reviewRows.length === 0) {
          setSaveMessage('Please enter at least one balance sheet amount in Step 8 before saving setup.')
          return
        }
        setProfile((current) => {
          const values = Object.fromEntries(Object.entries(current.values).filter(([key]) => !key.startsWith('wealthTarget.') && !key.startsWith('wealthActual.') && !key.startsWith('wealthVarianceNote.')))
          reviewRows.forEach((entry) => { values[`wealthTarget.${entry.id}`] = String(entry.amount) })
          values.wealthSetupSaved = 'true'
          return { ...current, step: 10, values }
        })
        setSaveMessage('Targeted goal setup saved. Continue with Step 10.')
      }

      return <div className="build-profile-step-content build-profile-step-nine">
        <h3>Step 9: Targeted Goal</h3>
        <p className="psychometric-section-note">Review setup values from Wealth Position Base Setting, reconcile monthly expense allocation, then save the targeted goal baseline.</p>

        <section className="build-profile-detail-section">
          <h4>Targeted Goal Summary</h4>
          <div className="build-profile-totals-grid build-profile-target-summary">
            <div><span>As Of</span><strong>{profile.values.asOfDate || 'Not set'}</strong></div>
            <div><span>Financial Goal</span><strong>{profile.values.financialGoal || 'Not selected'}</strong></div>
            <div><span>Setup Entries</span><strong>{reviewRows.length}</strong></div>
            <div><span>Setup Net Worth</span><strong>{formatTargetCurrency(assetsTotal - liabilitiesTotal)}</strong></div>
          </div>
        </section>

        <section className="build-profile-detail-section">
          <h4>Monthly Expense Allocation</h4>
          <p>Monthly expense lines can be revised by allocation percentage. Keep the expense allocation at 100% before saving this baseline.</p>
          <div className="build-profile-totals-grid build-profile-target-summary">
            <div><span>Monthly Expense Total</span><strong>{formatTargetCurrency(monthlyExpenseTotal)}</strong></div>
            <div><span>Expense Allocation Total</span><strong>{allocationTotal.toFixed(2)}%</strong></div>
            <div><span>Variance to 100%</span><strong>{allocationVariance.toFixed(2)}%</strong></div>
            <div><span>Status</span><strong>{allocationBalanced ? 'Balanced' : 'Needs Reconciliation'}</strong></div>
          </div>
          <div className="psychometric-scale-table-wrap build-profile-target-table">
            <table className="psychometric-scale-table">
              <thead><tr><th>Expense Category</th><th>Setup Amount</th><th>Allocation %</th></tr></thead>
              <tbody>
                {expenseRows.map((entry) => <tr key={entry.id}>
                  <td data-label="Expense Category">{entry.label}</td>
                  <td data-label="Setup Amount">{formatTargetCurrency(entry.amount)}</td>
                  <td data-label="Allocation %"><input type="number" min="0" max="100" step="0.01" aria-label={`${entry.label} allocation percentage`} value={profile.values[`wealthAllocation.${entry.id}`] ?? allocationValue(entry.id, entry.amount).toFixed(2)} onChange={(event) => updateValue(`wealthAllocation.${entry.id}`, event.target.value)} /></td>
                </tr>)}
                {expenseRows.length === 0 ? <tr><td colSpan={3}>No monthly expense setup lines yet. Return to Step 8 and add values.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="build-profile-detail-section">
          <div className="build-profile-section-heading"><h4>Setup Lines Review</h4><button type="button" className="loan-footer-button" onClick={() => setIsTargetReviewExpanded((current) => !current)}>{isTargetReviewExpanded ? 'Hide Setup Lines Review' : 'Show Setup Lines Review'}</button></div>
          {isTargetReviewExpanded ? <>
            <div className="build-profile-form-grid">
              <label>Statement Section<select aria-label="Targeted Goal filter by statement section" value={targetSectionFilter} onChange={(event) => { setTargetSectionFilter(event.target.value as 'all' | StatementSection); setTargetCategoryFilter('all') }}><option value="all">All Sections</option>{STEP1_SECTION_ORDER.map((section) => <option key={section} value={section}>{STEP1_SECTION_SHORT_LABELS[section]}</option>)}</select></label>
              <label>Account Group<select aria-label="Targeted Goal filter by account group" value={targetCategoryFilter} onChange={(event) => setTargetCategoryFilter(event.target.value)}><option value="all">All Account Groups</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>Line Item<input type="search" aria-label="Targeted Goal filter by line item" placeholder="Search line item" value={targetLineSearch} onChange={(event) => setTargetLineSearch(event.target.value)} /></label>
              <div className="build-profile-filter-result"><span>Matching Rows</span><strong>{filteredRows.length}</strong><button type="button" className="loan-footer-button" onClick={() => { setTargetSectionFilter('all'); setTargetCategoryFilter('all'); setTargetLineSearch('') }}>Clear Review Filters</button></div>
            </div>
            <div className="psychometric-scale-table-wrap build-profile-target-table">
              <table className="psychometric-scale-table"><thead><tr><th>Statement Section</th><th>Account Group</th><th>Line Item</th><th>Setup Amount</th></tr></thead><tbody>
                {filteredRows.map((entry) => <tr key={entry.id}><td data-label="Statement Section">{STEP1_SECTION_SHORT_LABELS[entry.section]}</td><td data-label="Account Group">{entry.category}</td><td data-label="Line Item">{entry.label}</td><td data-label="Setup Amount">{formatTargetCurrency(entry.amount)}</td></tr>)}
                {filteredRows.length === 0 ? <tr><td colSpan={4}>No matching setup lines found. Adjust the filters or return to Step 8 and add values.</td></tr> : null}
              </tbody></table>
            </div>
          </> : null}
        </section>

        <div className="build-profile-target-actions">
          <button type="button" className="loan-footer-button" onClick={() => goToStep(8)}>Back to Step 8</button>
          <button type="button" className="loan-footer-button" onClick={normalizeAllocations}>Normalize to 100%</button>
          <button type="button" className="loan-footer-button" onClick={applyAllocations}>Apply Revised % Allocation</button>
          <button type="button" className="loan-inline-button loan-inline-button-primary" onClick={saveTargetSetup}>Save Setup and Continue to Step 10</button>
        </div>
      </div>
    }

    if (profile.step === 10) {
      const currency = profile.values.wealthCurrency || 'PHP'
      const formatVarianceCurrency = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
      const formatSignedVariance = (amount: number) => `${amount < 0 ? '-' : amount > 0 ? '+' : ''}${formatVarianceCurrency(Math.abs(amount))}`
      const varianceExplanation = (section: StatementSection, variance: number) => {
        if (variance === 0) return 'On target versus setup'
        if (section === 'liabilities' || section === 'monthly-expenses') {
          return variance > 0 ? 'Liability increased above setup and needs control' : 'Liability is lower than setup and improves net worth'
        }
        return variance > 0 ? 'Value improved above setup and supports net worth' : 'Value declined below setup and weakens net worth'
      }
      const targetRows = NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => !entry.autoGenerated && Number(profile.values[`wealthTarget.${entry.id}`] || 0) > 0)
        .map((entry) => {
          const rawActual = profile.values[`wealthActual.${entry.id}`] ?? ''
          const hasActual = rawActual.trim() !== ''
          const targetAmount = Number(profile.values[`wealthTarget.${entry.id}`] || 0)
          const actualAmount = hasActual ? Math.max(0, Number(rawActual) || 0) : 0
          return { ...entry, targetAmount, rawActual, hasActual, actualAmount, variance: hasActual ? actualAmount - targetAmount : 0 }
        })
      const completedActuals = targetRows.filter((entry) => entry.hasActual).length
      const actualPercent = targetRows.length > 0 ? Math.round((completedActuals / targetRows.length) * 100) : 0
      const categories = [...new Set(targetRows
        .filter((entry) => varianceSectionFilter === 'all' || entry.section === varianceSectionFilter)
        .map((entry) => entry.category))].sort()
      const normalizedSearch = varianceLineSearch.trim().toLowerCase()
      const filteredRows = targetRows.filter((entry) =>
        (varianceSectionFilter === 'all' || entry.section === varianceSectionFilter)
        && (varianceCategoryFilter === 'all' || entry.category === varianceCategoryFilter)
        && (!normalizedSearch || entry.label.toLowerCase().includes(normalizedSearch)))

      return <div className="build-profile-step-content build-profile-step-ten">
        <h3>Step 10: Actual vs Target</h3>
        <p className="psychometric-section-note">First column shows the saved target. Second column is blank for actual entry. Third column is variance. Fourth column shows the variance explanation in small letters.</p>

        {targetRows.length > 0 ? <p className="psychometric-section-note">
          {completedActuals === targetRows.length
            ? 'Actual entry completion: 100%. Variance and net worth calculations are fully based on actual inputs.'
            : `Actual entry completion: ${completedActuals}/${targetRows.length} (${actualPercent}%). Missing actual values use target values in the projection.`}
        </p> : <p className="build-profile-applicability-note">No saved target setup yet. Complete Step 9 and select Save Setup and Continue to Step 10 first.</p>}

        {targetRows.length > 0 ? <>
          <section className="build-profile-detail-section">
            <h4>Variance Filters</h4>
            <div className="build-profile-form-grid">
              <label>Statement Section<select aria-label="Actual vs Target filter by statement section" value={varianceSectionFilter} onChange={(event) => { setVarianceSectionFilter(event.target.value as 'all' | StatementSection); setVarianceCategoryFilter('all') }}><option value="all">All Sections</option>{STEP1_SECTION_ORDER.map((section) => <option key={section} value={section}>{STEP1_SECTION_SHORT_LABELS[section]}</option>)}</select></label>
              <label>Account Group<select aria-label="Actual vs Target filter by account group" value={varianceCategoryFilter} onChange={(event) => setVarianceCategoryFilter(event.target.value)}><option value="all">All Account Groups</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>Line Item<input type="search" aria-label="Actual vs Target filter by line item" placeholder="Search line item" value={varianceLineSearch} onChange={(event) => setVarianceLineSearch(event.target.value)} /></label>
              <div className="build-profile-filter-result"><span>Matching Rows</span><strong>{filteredRows.length}</strong><button type="button" className="loan-footer-button" onClick={() => { setVarianceSectionFilter('all'); setVarianceCategoryFilter('all'); setVarianceLineSearch('') }}>Clear Variance Filters</button></div>
            </div>
          </section>

          <div className="psychometric-scale-table-wrap build-profile-target-table build-profile-variance-table">
            <table className="psychometric-scale-table">
              <thead><tr><th>Target (Saved)</th><th>Actual (User Input)</th><th>Variance</th><th>Variance Explanation</th></tr></thead>
              <tbody>
                {filteredRows.map((entry) => {
                  const noteKey = `wealthVarianceNote.${entry.id}`
                  return <tr key={entry.id}>
                    <td data-label="Target (Saved)"><strong>{entry.label}</strong><div>{STEP1_SECTION_SHORT_LABELS[entry.section]}</div><div>{entry.category}</div><div>{formatVarianceCurrency(entry.targetAmount)}</div></td>
                    <td data-label="Actual (User Input)"><input aria-invalid={!entry.hasActual} type="number" min="0" step="0.01" value={entry.rawActual} placeholder="Enter actual value" aria-label={`${entry.label} actual value`} onChange={(event) => updateValue(`wealthActual.${entry.id}`, event.target.value)} /></td>
                    <td data-label="Variance">{entry.hasActual ? formatSignedVariance(entry.variance) : 'Pending input'}</td>
                    <td data-label="Variance Explanation"><small className="build-profile-variance-copy">{entry.hasActual ? (profile.values[noteKey]?.trim() || varianceExplanation(entry.section, entry.variance)) : 'Awaiting actual value from user.'}</small>{entry.hasActual ? <input aria-invalid={!profile.values[noteKey]?.trim()} type="text" value={profile.values[noteKey] ?? ''} placeholder="Enter explanation to complete profile" aria-label={`${entry.label} variance explanation`} onChange={(event) => updateValue(noteKey, event.target.value)} /> : null}</td>
                  </tr>
                })}
                {filteredRows.length === 0 ? <tr><td colSpan={4}>No matching saved target rows found. Adjust the Actual vs Target filters.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="build-profile-target-actions"><button type="button" className="loan-footer-button" onClick={() => goToStep(9)}>Back to Step 9</button><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => goToStep(11)}>Continue to Step 11</button></div>
        </> : null}
      </div>
    }

    if (profile.step === 11) {
      const answeredCount = SUITABILITY_QUESTIONS.filter((question) => {
        const answer = Number(profile.suitabilityAnswers[question.key])
        return answer >= 1 && answer <= 4
      }).length
      const score = SUITABILITY_QUESTIONS.reduce((sum, question) => {
        const answer = Number(profile.suitabilityAnswers[question.key])
        return sum + (answer >= 1 && answer <= 4 ? answer : 0)
      }, 0)
      const suitabilityResult = SUITABILITY_RESULT_BANDS.find((band) => score >= band.min && score <= band.max) ?? null

      return <div className="build-profile-step-content build-profile-step-eleven">
        <h3>Step 11: Suitability Assessment</h3>
        <p className="psychometric-section-note">Complete all suitability questions to determine investor profile and recommended product portfolio.</p>
        <p className="psychometric-section-note">Completion: {answeredCount}/{SUITABILITY_QUESTIONS.length} questions answered.</p>

        <div className="psychometric-scale-table-wrap build-profile-suitability-table">
          <table className="psychometric-scale-table">
            <thead><tr><th>Question</th><th>1</th><th>2</th><th>3</th><th>4</th></tr></thead>
            <tbody>
              {SUITABILITY_QUESTIONS.map((question) => <tr key={question.key}>
                <td data-label="Question"><strong>{question.prompt}</strong></td>
                {question.options.map((option, index) => {
                  const scoreValue = String(index + 1)
                  return <td key={option} data-label={`Option ${scoreValue}`}><label><input aria-invalid={!profile.suitabilityAnswers[question.key]} type="radio" name={question.key} checked={profile.suitabilityAnswers[question.key] === scoreValue} aria-label={`${question.prompt} option ${scoreValue}`} onChange={() => setProfile((current) => ({ ...current, suitabilityAnswers: { ...current.suitabilityAnswers, [question.key]: scoreValue } }))} /><small>{option}</small></label></td>
                })}
              </tr>)}
            </tbody>
          </table>
        </div>

        <div className="build-profile-totals-grid build-profile-suitability-summary">
          <div><span>Total Score</span><strong>{score}</strong></div>
          <div><span>Investor Profile</span><strong>{suitabilityResult?.profile ?? 'Pending completion'}</strong></div>
          <div><span>Description</span><small>{suitabilityResult?.description ?? 'Answer all questions to finalize the profile.'}</small></div>
          <div><span>Recommended Product / Portfolio</span><small>{suitabilityResult?.recommendedProduct ?? 'Answer all questions to generate recommendation.'}</small></div>
        </div>

        <div className="psychometric-scale-table-wrap build-profile-suitability-bands">
          <table className="psychometric-scale-table">
            <thead><tr><th>Score</th><th>Investor Profile</th><th>Description</th><th>Recommended Product / Portfolio</th></tr></thead>
            <tbody>{SUITABILITY_RESULT_BANDS.map((band) => {
              const active = score >= band.min && score <= band.max
              return <tr key={band.profile} className={active ? 'build-profile-suitability-band-active' : undefined}><td data-label="Score">{Number.isFinite(band.max) ? `${band.min} to ${band.max}` : `${band.min} and above`}</td><td data-label="Investor Profile"><strong>{band.profile}</strong></td><td data-label="Description">{band.description}</td><td data-label="Recommended Product / Portfolio">{band.recommendedProduct}</td></tr>
            })}</tbody>
          </table>
        </div>

        <div className="build-profile-target-actions"><button type="button" className="loan-footer-button" onClick={() => goToStep(10)}>Back to Step 10</button><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => goToStep(12)}>Continue to Step 12</button></div>
      </div>
    }

    if (profile.step === 12) {
      return <div className="build-profile-step-content">
        <h3>Step 12: FILSCORE Credit Health and Wealth Building Score Links</h3>
        <p className="psychometric-section-note">Use your completed profile to continue to both FILSCORE assessment areas.</p>
        <div className="build-profile-score-links">
          <article>
            <span>FILSCORE Assessment</span>
            <h4>Credit Health Score</h4>
            <p>Review credit readiness across credit, values, social, and verification indicators.</p>
            <button type="button" aria-invalid={profile.values.creditHealthScoreOpened !== 'true'} onClick={() => void openScorePage('creditHealthScoreOpened', '/lending-scorecard/filscore')}>Open Credit Health Score</button>
          </article>
          <article>
            <span>FILSCORE Assessment</span>
            <h4>Wealth Building Score</h4>
            <p>Review net worth positioning, financial foundations, and wealth-building behavior.</p>
            <button type="button" aria-invalid={profile.values.wealthBuildingScoreOpened !== 'true'} onClick={() => {
              if (sourceApplication) void openScorePage('wealthBuildingScoreOpened', '/net-worth-positioning')
              else {
                persistProfileSnapshot(profile)
                navigate(`/net-worth-positioning?profileId=${encodeURIComponent(profile.profileId)}`)
              }
            }}>Open Wealth Building Score</button>
          </article>
        </div>
      </div>
    }

    return <div className="build-profile-step-content">
      <h3>Step {profile.step}: {currentStep.label}</h3>
      <p className="psychometric-section-note">{currentStep.description}</p>
      <div className="build-profile-form-grid">{STEP_FIELDS[profile.step].map(renderField)}</div>
    </div>
  }

  return <div className="psychometric-page lending-psychometric-page build-profile-page">
    <section className="psychometric-hero lending-psychometric-hero">
      <div className="psychometric-hero-copy"><span className="psychometric-eyebrow">Base Setting</span><h1>Create Profile</h1><p>Build a complete profile across personal, credit, wealth, and suitability information.</p></div>
      <div className="psychometric-hero-metric build-profile-completion" aria-label={`${completionPercent}% profile completion`}><span>Profile Completion</span><strong>{completionPercent}%</strong><small>Step {profile.step} of 12: {currentStep.label}</small><div className="build-profile-progress-track" aria-hidden="true"><div style={{ width: `${completionPercent}%` }} /></div></div>
    </section>

    <section className="psychometric-summary-grid lending-psychometric-summary-grid">
      <article className="psychometric-summary-card psychometric-summary-card-highlight"><span>Profile ID</span><strong>{profile.profileId}</strong><small>Your personal profile reference</small></article>
      <article className="psychometric-summary-card build-profile-goal-summary">
        <label htmlFor="build-profile-summary-financial-goal">Financial Goal</label>
        <select id="build-profile-summary-financial-goal" aria-label="Profile Financial Goal" value={profile.values.financialGoal ?? ''} onChange={(event) => updateValue('financialGoal', event.target.value)}>
          <option value="">Select Financial Goal</option>
          {NET_WORTH_FINANCIAL_GOAL_OPTIONS.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
        </select>
        <small>{formatCurrency(profile.values.targetAmount || profile.values.requestedAmount)}</small>
      </article>
      <article className="psychometric-summary-card"><span>Profile Status</span><strong>{profileStatus}</strong><small>Based on information provided</small></article>
      <article className="psychometric-summary-card"><span>Current Step</span><strong>{profile.step} / 12</strong><small>{currentStep.label}</small></article>
    </section>

    <section className="build-profile-layout">
      <aside className="psychometric-panel lending-psychometric-step-panel build-profile-workflow-panel">
        <details className="build-profile-workflow-accordion" open>
          <summary>
            <span className="psychometric-panel-kicker">Workflow Steps</span>
            <span className="build-profile-workflow-chevron" aria-hidden="true" />
          </summary>
          <div className="build-profile-workflow-body">
            <div className="build-profile-workflow-column build-profile-workflow-build">
              <div className="build-profile-workflow-column-heading">
                <h2>Build your Profile</h2>
                <small>Step {profile.step} of 12: {currentStep.label}</small>
              </div>
              <div className="build-profile-workflow-steps">
                {WORKFLOW_STEPS.map((workflowStep) => {
                  const completion = stepCompletion[workflowStep.id]
                  return <button
                    key={workflowStep.id}
                    type="button"
                    onClick={() => goToStep(workflowStep.id)}
                    className={`build-profile-workflow-step ${getWorkflowStepCompletionClass(completion)}${profile.step === workflowStep.id ? ' build-profile-workflow-step-active' : ''}`}
                    aria-label={`Step ${workflowStep.id}: ${workflowStep.label}, ${completion}% information provided`}
                    title={`Step ${workflowStep.id}: ${workflowStep.label} (${completion}% complete)`}
                  >
                    {workflowStep.id}
                  </button>
                })}
              </div>
            </div>
            <div className="build-profile-workflow-column build-profile-workflow-retrieve">
              <div className="build-profile-workflow-column-heading">
                <h2>Retrieve Existing Profile</h2>
              </div>
              <div className="build-profile-workflow-actions" aria-label="Lending Scorecard actions">
                <button type="button" className="build-profile-workflow-action build-profile-workflow-action-primary" onClick={() => {
                  persistProfileSnapshot(profile)
                  navigate(`/lending-scorecard?profileId=${encodeURIComponent(profile.profileId)}`, { state: { scorecardAction: 'create-new' } })
                }}>Create New Record</button>
                <button type="button" className="build-profile-workflow-action" onClick={() => navigate('/loan-repository?status=All&origin=build-profile')}>Review Record</button>
                <button type="button" className="build-profile-workflow-action" onClick={() => navigate('/lending-scorecard', { state: { scorecardAction: 'open-filscore' } })}>Open FILSCORE Page</button>
                <button type="button" className="build-profile-workflow-action" onClick={() => navigate('/loan-repository?status=Credit%20Review')}>Approval Queue</button>
                <button type="button" className="build-profile-workflow-action" onClick={() => navigate('/loan-repository?status=Released')}>Released Accounts</button>
              </div>
            </div>
          </div>
        </details>
      </aside>

      <article className="psychometric-panel build-profile-form-panel">
        <div className="psychometric-panel-header"><span className="psychometric-panel-kicker">Workflow Form</span><span className="loan-page-status-chip build-profile-status-chip">{stepCompletion[profile.step]}% complete</span></div>
        {renderCurrentStep()}
        <div className="build-profile-form-actions">
          <button type="button" className="loan-footer-button" disabled={profile.step === 1} onClick={() => goToStep((profile.step - 1) as ProfileStep)}>Previous</button>
          <button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => void saveProfile()}>Save Profile</button>
          <button type="button" className="loan-footer-button" disabled={profile.step === 12} onClick={() => goToStep((profile.step + 1) as ProfileStep)}>Next</button>
        </div>
        {saveMessage ? <p className="status-message" role="status">{saveMessage}</p> : null}
      </article>
    </section>
  </div>
}
