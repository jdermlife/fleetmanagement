import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NumericFormat } from 'react-number-format'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  fetchLoanApplication,
  updateLoanApplication,
  type LoanApplicationPayload,
  type LoanApplicationRecord,
} from '../../api/loan'
import AuthProgressOverlay from '../../components/auth/AuthProgressOverlay'
import BuildProfileVoiceAssistant from '../../components/profile/BuildProfileVoiceAssistant'
import SelectedProfileIdCard from '../../components/profile/SelectedProfileIdCard'

import { computeNetWorthBuildingScore } from './netWorthBuildingEngine'
import { computeAiAdvisories } from './aiAdvisoryEngine'
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
  createFinancialInstrumentCollateral,
  createRealEstateCollateral,
  type AdditionalCollateral,
  type CollateralField,
  type FinancialInstrumentCollateral,
  type RealEstateCollateral,
} from './buildProfileStep7'
import { BUILD_PROFILE_STORAGE_KEY, getCurrentBuildProfileOwner } from './buildProfileReplication'

type ProfileStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

type ProfileData = {
  profileId: string
  selectedApplicationNo?: string
  ownerKey?: string
  step: ProfileStep
  values: Record<string, string>
  documents: string[]
  suitabilityAnswers: Record<string, string>
  coBorrowers: CoBorrower[]
  guarantors: Guarantor[]
  additionalCollaterals: AdditionalCollateral[]
  realEstateCollaterals: RealEstateCollateral[]
  financialInstrumentCollaterals: FinancialInstrumentCollateral[]
  additionalLoans: Array<Record<string, string | number>>
  propertyDeclarations: PropertyDeclaration[]
  step3FinancialInvestments: FinancialInvestmentDeclaration[]
  financialInvestments: FinancialInvestment[]
  dependents: Dependent[]
}

type FinancialInvestment = {
  id: string
  investmentType: string
  issuerAsset: string
  originalInvestment: string
  dateAcquired: string
  currentMarketValue: string
  unitsShares: string
  costBasis: string
  markToMarketValue: string
  unrealizedGainLoss: string
  yieldDividendPercent: string
  riskRating: string
}

type PropertyDeclaration = {
  id: string
  propertyType: string
  titleDocumentNumber: string
  marketValue: string
}

type FinancialInvestmentDeclaration = {
  id: string
  assetType: string
  issuer: string
  amount: string
  marketValue: string
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
const BUILD_PROFILE_AMOUNT_KEYS = new Set([
  'monthlyIncome',
  'otherIncome',
  'debtObligations',
  'grossMonthlyIncome',
  'monthlyExpenses',
  'otherSourcesOfIncome',
  'investmentIncome',
  'businessIncome',
  'pensionIncome',
  'spouseGrossMonthlyIncome',
  'spouseMonthlyExpenses',
  'creditLimit',
  'outstandingBalance',
  'currentBalance',
  'loanCurrentBalance',
  'loanMonthlyAmortization',
  'averageSavingsBalance',
  'averageDailyBalance',
  'declaredAssets',
  'declaredLiabilities',
  'portfolioTotalAmount',
])

const WORKFLOW_STEPS: Array<{ id: ProfileStep; label: string; description: string }> = [
  { id: 1, label: 'Tell Us About Yourself', description: 'Start with your essential personal and contact details.' },
  { id: 2, label: 'Spouse and Dependents', description: 'Complete applicable spouse and dependent information.' },
  { id: 3, label: 'Source of Income & Wealth and Credit Values', description: 'Record income, wealth, employment, verification, and Credit Values information.' },
  { id: 4, label: 'Spouse Employment, Co-Borrower, and Guarantor Information (as applicable)', description: 'Add applicable spouse employment, co-borrower, and guarantor information.' },
  { id: 5, label: 'Banking Relationships', description: 'Describe credit cards, bank accounts, and existing loans.' },
  { id: 6, label: 'Goal Setting', description: 'Define the financial purpose, product, amount, and timeframe.' },
  { id: 7, label: 'Collateral Assets (based on Goal and Product Requested).', description: 'Identify security and assets based on the goal and product requested.' },
  { id: 8, label: 'Actual / Current Financial Position', description: 'Capture current net worth, income, expenses, goals, protection, and AI analysis.' },
  { id: 9, label: 'Desired / Target Financial Position', description: 'Set desired net worth, income, expenses, goals, and protection.' },
  { id: 10, label: 'Actual vs Desired / Target', description: 'Compare Step 8 actual values with the Step 9 desired target.' },
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
  return { profileId: createProfileId(), step: 1, values: {}, documents: [], suitabilityAnswers: {}, coBorrowers: [], guarantors: [], additionalCollaterals: [], realEstateCollaterals: [], financialInstrumentCollaterals: [], additionalLoans: [], propertyDeclarations: [], step3FinancialInvestments: [], financialInvestments: [], dependents: [] }
}

function createPropertyDeclaration(): PropertyDeclaration {
  return {
    id: `PROP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    propertyType: '',
    titleDocumentNumber: '',
    marketValue: '',
  }
}

function createFinancialInvestmentDeclaration(): FinancialInvestmentDeclaration {
  return {
    id: `FIN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    assetType: '',
    issuer: '',
    amount: '',
    marketValue: '',
  }
}

function createFinancialInvestment(): FinancialInvestment {
  return {
    id: `INV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    investmentType: '',
    issuerAsset: '',
    originalInvestment: '',
    dateAcquired: '',
    currentMarketValue: '',
    unitsShares: '',
    costBasis: '',
    markToMarketValue: '',
    unrealizedGainLoss: '',
    yieldDividendPercent: '',
    riskRating: '',
  }
}

function createDependent(): Dependent {
  return { id: `DEP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, name: '', dateOfBirth: '' }
}

function propertyDeclarationSummary(items: PropertyDeclaration[]): string {
  return items.map((item) => [
    item.propertyType,
    item.titleDocumentNumber,
    item.marketValue ? `Market Value: ${item.marketValue}` : '',
  ].filter(Boolean).join(' | ')).filter(Boolean).join('\n')
}

function financialInvestmentSummary(items: FinancialInvestmentDeclaration[]): string {
  return items.map((item) => [
    item.assetType,
    item.issuer,
    item.amount ? `Amount: ${item.amount}` : '',
    item.marketValue ? `Market Value: ${item.marketValue}` : '',
  ].filter(Boolean).join(' | ')).filter(Boolean).join('\n')
}

function loadProfile(): ProfileData {
  if (typeof window === 'undefined') return createEmptyProfile()
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return createEmptyProfile()
    const parsed = JSON.parse(saved)
    if (parsed.ownerKey && parsed.ownerKey !== getCurrentBuildProfileOwner()) return createEmptyProfile()
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...profile,
    ownerKey: getCurrentBuildProfileOwner(),
    updatedAt: new Date().toISOString(),
  }))
}

function scorePreparationFingerprint(profile: ProfileData): string {
  const scoreValues = { ...profile.values }
  delete scoreValues.creditHealthScoreOpened
  delete scoreValues.wealthBuildingScoreOpened

  return JSON.stringify({
    profileId: profile.profileId,
    selectedApplicationNo: profile.selectedApplicationNo,
    values: scoreValues,
    documents: profile.documents,
    suitabilityAnswers: profile.suitabilityAnswers,
    coBorrowers: profile.coBorrowers,
    guarantors: profile.guarantors,
    additionalCollaterals: profile.additionalCollaterals,
    realEstateCollaterals: profile.realEstateCollaterals,
    financialInstrumentCollaterals: profile.financialInstrumentCollaterals,
    propertyDeclarations: profile.propertyDeclarations,
    step3FinancialInvestments: profile.step3FinancialInvestments,
    financialInvestments: profile.financialInvestments,
    dependents: profile.dependents,
  })
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
    selectedApplicationNo: application.application_no,
    values,
    coBorrowers: (requirements.coBorrowers ?? []).map((item, index) => ({
      id: `CB-${application.application_no}-${index + 1}`,
      name: item.name,
      relationship: item.relationship,
      employerBusinessName: item.employerBusinessName || '',
      officeAddress: item.officeAddress || '',
      occupation: item.occupation || '',
      position: item.position || '',
      natureOfWork: item.natureOfWork || '',
      previousEmployer: item.previousEmployer || '',
      yearsWithEmployer: item.yearsWithEmployer || '',
      totalYearsWorking: item.totalYearsWorking || '',
      monthlyIncome: String(item.monthlyIncome || ''),
      monthlyExpenses: String(item.monthlyExpenses || ''),
      otherIncomeSources: item.otherIncomeSources || '',
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
    employerBusinessName: item.employerBusinessName,
    officeAddress: item.officeAddress,
    occupation: item.occupation,
    position: item.position,
    natureOfWork: item.natureOfWork,
    previousEmployer: item.previousEmployer,
    yearsWithEmployer: item.yearsWithEmployer,
    totalYearsWorking: item.totalYearsWorking,
    monthlyIncome: Number(item.monthlyIncome) || 0,
    monthlyExpenses: Number(item.monthlyExpenses) || 0,
    otherIncomeSources: item.otherIncomeSources,
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
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [pendingScorePage, setPendingScorePage] = useState<'creditHealthScoreOpened' | 'wealthBuildingScoreOpened' | null>(null)
  const [scorePreparationStatus, setScorePreparationStatus] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle')
  const preparedScoreKeyRef = useRef('')
  const scorePreparationPromiseRef = useRef<{ key: string; promise: Promise<LoanApplicationRecord> } | null>(null)
  const [wealthSectionFilter, setWealthSectionFilter] = useState<'all' | StatementSection>('all')
  const [wealthCategoryFilter, setWealthCategoryFilter] = useState('all')
  const [wealthLineSearch, setWealthLineSearch] = useState('')
  const [targetSectionFilter, setTargetSectionFilter] = useState<'all' | StatementSection>('all')
  const [targetCategoryFilter, setTargetCategoryFilter] = useState('all')
  const [targetLineSearch, setTargetLineSearch] = useState('')
  const [varianceSectionFilter, setVarianceSectionFilter] = useState<'all' | StatementSection>('all')
  const [varianceCategoryFilter, setVarianceCategoryFilter] = useState('all')
  const [varianceLineSearch, setVarianceLineSearch] = useState('')
  const [profileEntryMode, setProfileEntryMode] = useState<'manual' | 'voice'>('manual')
  const currentStep = WORKFLOW_STEPS.find((item) => item.id === profile.step) ?? WORKFLOW_STEPS[0]
  const scoreApplicationNo = profile.selectedApplicationNo?.trim()
    || (!profile.profileId.startsWith('PRO-') ? profile.profileId.trim() : '')
  const scorePreparationKey = scoreApplicationNo
    ? `${scoreApplicationNo}:${scorePreparationFingerprint(profile)}`
    : ''
  const currentScorePreparationKeyRef = useRef(scorePreparationKey)
  currentScorePreparationKeyRef.current = scorePreparationKey

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      persistProfileSnapshot(profile)
    }, 150)
    return () => window.clearTimeout(timeout)
  }, [profile])

  useEffect(() => {
    if (!requestedApplicationNo) return

    let cancelled = false
    setIsLoadingProfile(true)
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
      .finally(() => {
        if (!cancelled) setIsLoadingProfile(false)
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
        const monthlyIncome = NET_WORTH_STATEMENT_ENTRIES
          .filter((entry) => entry.section === 'monthly-income')
          .reduce((sum, entry) => sum + Math.max(0, Number(profile.values[entry.id] || 0)), 0)
        const monthlyExpenses = NET_WORTH_STATEMENT_ENTRIES
          .filter((entry) => entry.section === 'monthly-expenses')
          .reduce((sum, entry) => sum + Math.max(0, Number(profile.values[entry.id] || 0)), 0)
        result[id] = Math.round(((completedFields + (monthlyIncome - monthlyExpenses > 0 ? 1 : 0)) / 4) * 100)
      }
      else if (id === 9) {
        const editableEntries = NET_WORTH_STATEMENT_ENTRIES.filter((entry) => !entry.autoGenerated)
        const desiredEntries = editableEntries.filter((entry) => profile.values[`wealthActual.${entry.id}`]?.trim())
        result[id] = profile.values.wealthSetupSaved === 'true'
          ? 100
          : Math.round((desiredEntries.length / editableEntries.length) * 100)
      }
      else if (id === 10) {
        result[id] = profile.values.wealthSetupSaved === 'true' ? 100 : 0
      }
      else if (id === 11) result[id] = Math.round((SUITABILITY_QUESTIONS.filter((question) => profile.suitabilityAnswers[question.key]).length / SUITABILITY_QUESTIONS.length) * 100)
      else if (id === 12) {
        const openedLinks = ['creditHealthScoreOpened', 'wealthBuildingScoreOpened'].filter((key) => profile.values[key] === 'true').length
        result[id] = openedLinks * 50
      }
      else if (id === 3) {
        const completionFields = STEP_3_FIELDS.filter((field) => field.countsTowardCompletion !== false)
        const completedFields = completionFields.filter((field) => {
          if (field.key === 'grossMonthlyIncome') return Number(profile.values.monthlyIncome || 0) + Number(profile.values.otherIncome || 0) > 0
          if (field.yesNoChoice) return profile.values[field.key] === 'true' || profile.values[field.key] === 'false'
          if (field.mustBeChecked) return profile.values[field.key] === 'true'
          return profile.values[field.key] !== undefined && profile.values[field.key] !== ''
        }).length
        const answeredQuestions = CREDIT_VALUES_QUESTIONS.filter((question) => profile.values[`creditValues.${question.field}`]?.trim()).length
        result[id] = Math.round(((completedFields + answeredQuestions) / (completionFields.length + CREDIT_VALUES_QUESTIONS.length)) * 100)
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
        const completedFields = BANKING_RELATIONSHIP_FIELDS.filter((field) => field.type === 'calculated'
          ? Number(profile.values.creditLimit || 0) > 0
          : profile.values[field.key]?.trim()).length
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
          ...profile.realEstateCollaterals.flatMap((item) => [Boolean(item.tctCtcNumber.trim()), Boolean(item.address.trim()), Number(item.appraisedValue) > 0]),
          ...profile.financialInstrumentCollaterals.flatMap((item) => [Boolean(item.assetType.trim()), Boolean(item.currency.trim()), Boolean(item.issuer.trim()), Number(item.value) > 0, Number(item.markToMarket) > 0]),
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
  const incompleteActivities = WORKFLOW_STEPS.filter(({ id }) => stepCompletion[id] < 100)
  const profileStatus = completionPercent === 100 ? 'Complete' : completionPercent > 0 ? 'In Progress' : 'Getting Started'
  const updateValue = (key: string, value: string) => setProfile((current) => ({
    ...current,
    values: {
      ...current.values,
      [key]: value,
      ...(key === 'dateOfBirth' ? { age: calculateAge(value) } : {}),
      ...(key === 'employmentHistory' ? { spouseEmployerBusinessName: value } : {}),
      ...(key === 'financialGoal' ? { loanPurpose: value } : {}),
    },
    ...(key === 'dependents' ? {
      dependents: Array.from({ length: Math.max(0, Number(value) || 0) }, (_, index) => current.dependents[index] ?? createDependent()),
    } : {}),
  }))
  const updateDesiredWealthValue = (entryId: string, value: string) => setProfile((current) => ({
    ...current,
    values: {
      ...current.values,
      [`wealthActual.${entryId}`]: value,
      [`wealthTarget.${entryId}`]: value,
    },
  }))

  const updateDeclaredAssetsAndLiabilities = (key: 'declaredAssets' | 'declaredLiabilities', value: string) => setProfile((current) => {
    const declaredAssets = key === 'declaredAssets' ? value : current.values.declaredAssets || ''
    const declaredLiabilities = key === 'declaredLiabilities' ? value : current.values.declaredLiabilities || ''
    return {
      ...current,
      values: {
        ...current.values,
        [key]: value,
        selfDeclaredAssetsAndLiabilities: `Assets: ${declaredAssets || '0'} | Liabilities: ${declaredLiabilities || '0'}`,
      },
    }
  })

  const updateSelfDeclaredPortfolio = (key: 'portfolioAssetType' | 'portfolioTotalAmount', value: string) => setProfile((current) => {
    const assetType = key === 'portfolioAssetType' ? value : current.values.portfolioAssetType || ''
    const totalAmount = key === 'portfolioTotalAmount' ? value : current.values.portfolioTotalAmount || ''
    return {
      ...current,
      values: {
        ...current.values,
        [key]: value,
        selfDeclaredInvestmentPortfolio: `Asset Type: ${assetType || 'Not specified'} | Total Amount: ${totalAmount || '0'}`,
      },
    }
  })
  const goToStep = (step: ProfileStep) => setProfile((current) => {
    if (step !== 9) return { ...current, step }

    const values = { ...current.values }
    NET_WORTH_STATEMENT_ENTRIES.filter((entry) => !entry.autoGenerated).forEach((entry) => {
      const actualKey = `wealthActual.${entry.id}`
      if (!values[actualKey]?.trim() && values[entry.id]?.trim()) {
        values[actualKey] = values[entry.id]
      }
    })
    if (!values.wealthActualAsOfDate?.trim() && values.asOfDate?.trim()) {
      values.wealthActualAsOfDate = values.asOfDate
    }

    return { ...current, step, values }
  })

  const prepareStep12Scores = useCallback((profileSnapshot: ProfileData = profile) => {
    const applicationNo = profileSnapshot.selectedApplicationNo?.trim()
      || (!profileSnapshot.profileId.startsWith('PRO-') ? profileSnapshot.profileId.trim() : '')
    if (!applicationNo) {
      setScorePreparationStatus('error')
      setSaveMessage('Select a repository record before preparing FILSCORE results.')
      return Promise.reject(new Error('A repository application is required.'))
    }

    const preparationKey = `${applicationNo}:${scorePreparationFingerprint(profileSnapshot)}`
    if (preparedScoreKeyRef.current === preparationKey && sourceApplication?.application_no === applicationNo) {
      setScorePreparationStatus('ready')
      return Promise.resolve(sourceApplication)
    }

    const pendingPreparation = scorePreparationPromiseRef.current
    if (pendingPreparation?.key === preparationKey) return pendingPreparation.promise

    setScorePreparationStatus('preparing')
    setSaveMessage(`Loading and preparing profile ${applicationNo} for FILSCORE...`)
    const promise = (async () => {
      const baseline = sourceApplication?.application_no === applicationNo
        ? sourceApplication
        : await loadProfileApplication(applicationNo)
      const payload = loanPayloadFromProfile(profileSnapshot, baseline)
      persistProfileSnapshot(profileSnapshot)
      await updateLoanApplication(applicationNo, payload)
      const synchronizedApplication = { ...baseline, ...payload }
      preparedScoreKeyRef.current = preparationKey
      setSourceApplication(synchronizedApplication)
      if (currentScorePreparationKeyRef.current === preparationKey) {
        setScorePreparationStatus('ready')
        setSaveMessage(`Profile ${applicationNo} loaded. Credit Health and Wealth Building inputs are ready.`)
      }
      return synchronizedApplication
    })().catch((error) => {
      if (currentScorePreparationKeyRef.current === preparationKey) {
        setScorePreparationStatus('error')
        setSaveMessage(`Unable to prepare profile ${applicationNo}. Select a score button to retry.`)
      }
      throw error
    }).finally(() => {
      if (scorePreparationPromiseRef.current?.key === preparationKey) {
        scorePreparationPromiseRef.current = null
      }
    })

    scorePreparationPromiseRef.current = { key: preparationKey, promise }
    return promise
  }, [profile, sourceApplication])

  useEffect(() => {
    if (profile.step !== 12) return
    if (!scoreApplicationNo) {
      setScorePreparationStatus('ready')
      setSaveMessage('Local profile is ready. A repository record will be created when the Credit Health assessment is saved.')
      return
    }
    void prepareStep12Scores().catch(() => undefined)
  }, [prepareStep12Scores, profile.step, scoreApplicationNo, scorePreparationKey])

  const saveProfile = async () => {
    try {
      persistProfileSnapshot(profile)
      const applicationNo = profile.selectedApplicationNo?.trim()
        || (!profile.profileId.startsWith('PRO-') ? profile.profileId.trim() : '')
      if (applicationNo) {
        const baseline = sourceApplication?.application_no === applicationNo
          ? sourceApplication
          : await loadProfileApplication(applicationNo)
        const payload = loanPayloadFromProfile(profile, baseline)
        await updateLoanApplication(applicationNo, payload)
        setSourceApplication({ ...baseline, ...payload })
        setSaveMessage('Profile saved successfully and synchronized for FILSCORE computation.')
      } else {
        setSaveMessage('Ensure to save with Profile Reference')
      }
    } catch {
      setSaveMessage('Unable to save and synchronize this profile.')
    }
  }

  const openScorePage = async (
    key: 'creditHealthScoreOpened' | 'wealthBuildingScoreOpened',
    destination: '/lending-scorecard/filscore' | '/net-worth-positioning',
  ) => {
    const updatedProfile = { ...profile, values: { ...profile.values, [key]: 'true' } }
    setProfile(updatedProfile)
    if (!scoreApplicationNo) {
      persistProfileSnapshot(updatedProfile)
      navigate(`${destination}?profileId=${encodeURIComponent(profile.profileId)}`)
      return
    }
    setPendingScorePage(key)
    try {
      const preparedApplication = await prepareStep12Scores(profile)
      persistProfileSnapshot(updatedProfile)
      navigate(`${destination}?applicationNo=${encodeURIComponent(preparedApplication.application_no)}`)
    } catch {
      setSaveMessage('Unable to synchronize profile data and compute FILSCORE right now.')
    } finally {
      setPendingScorePage(null)
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

  const updateRealEstateCollateral = (id: string, field: keyof RealEstateCollateral, value: string) => setProfile((current) => ({
    ...current,
    realEstateCollaterals: current.realEstateCollaterals.map((item) => item.id === id ? { ...item, [field]: value } : item),
  }))

  const updateFinancialInstrumentCollateral = (id: string, field: keyof FinancialInstrumentCollateral, value: string) => setProfile((current) => ({
    ...current,
    financialInstrumentCollaterals: current.financialInstrumentCollaterals.map((item) => item.id === id ? { ...item, [field]: value } : item),
  }))

  const updateFinancialInvestment = (id: string, field: keyof FinancialInvestment, value: string) => setProfile((current) => ({
    ...current,
    financialInvestments: current.financialInvestments.map((item) => item.id === id ? { ...item, [field]: value } : item),
  }))

  const updateFinancialInvestmentDeclaration = (id: string, field: keyof FinancialInvestmentDeclaration, value: string) => setProfile((current) => {
    const step3FinancialInvestments = current.step3FinancialInvestments.map((item) => item.id === id ? { ...item, [field]: value } : item)
    return {
      ...current,
      step3FinancialInvestments,
      values: { ...current.values, additionalVehicleDeclarations: financialInvestmentSummary(step3FinancialInvestments) },
    }
  })

  const updatePropertyDeclaration = (id: string, field: keyof PropertyDeclaration, value: string) => setProfile((current) => {
    const propertyDeclarations = current.propertyDeclarations.map((item) => item.id === id ? { ...item, [field]: value } : item)
    return {
      ...current,
      propertyDeclarations,
      values: { ...current.values, additionalPropertyDeclarations: propertyDeclarationSummary(propertyDeclarations) },
    }
  })

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
    ) : field.type === 'number' ? (
      <NumericFormat aria-invalid={!value.trim()} value={value} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value: numericValue }) => onChange(numericValue)} />
    ) : (
      <input aria-invalid={!value.trim()} type={field.type ?? 'text'} value={value} onChange={(event) => onChange(event.target.value)} />
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

    if (field.key === 'additionalPropertyDeclarations') {
      return <div key={field.key} className="build-profile-declaration-box build-profile-field-wide">
        <div className="build-profile-section-heading">
          <h5>Additional Property Declarations</h5>
          <button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, propertyDeclarations: [...current.propertyDeclarations, createPropertyDeclaration()] }))}>Add Property</button>
        </div>
        {profile.propertyDeclarations.length === 0 ? <p className="build-profile-applicability-note">No additional property declared.</p> : <div className="build-profile-declaration-list">
          {profile.propertyDeclarations.map((item, index) => <article key={item.id}>
            <div className="build-profile-declaration-grid build-profile-property-declaration-grid">
              <label>Type of Property<input value={item.propertyType} onChange={(event) => updatePropertyDeclaration(item.id, 'propertyType', event.target.value)} /></label>
              <label>Title / OR / CR / CTC<input value={item.titleDocumentNumber} onChange={(event) => updatePropertyDeclaration(item.id, 'titleDocumentNumber', event.target.value)} /></label>
              <label>Market Value<NumericFormat value={item.marketValue} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updatePropertyDeclaration(item.id, 'marketValue', value)} /></label>
              <button type="button" className="loan-footer-button" onClick={() => setProfile((current) => {
                const propertyDeclarations = current.propertyDeclarations.filter((record) => record.id !== item.id)
                return { ...current, propertyDeclarations, values: { ...current.values, additionalPropertyDeclarations: propertyDeclarationSummary(propertyDeclarations) } }
              })}>Remove Property {index + 1}</button>
            </div>
          </article>)}
        </div>}
      </div>
    }

    if (field.key === 'additionalVehicleDeclarations') {
      return <div key={field.key} className="build-profile-declaration-box build-profile-field-wide">
        <div className="build-profile-section-heading">
          <h5>Financial Investments</h5>
          <button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, step3FinancialInvestments: [...current.step3FinancialInvestments, createFinancialInvestmentDeclaration()] }))}>Add Financial Investment</button>
        </div>
        {profile.step3FinancialInvestments.length === 0 ? <p className="build-profile-applicability-note">No financial investment declared.</p> : <div className="build-profile-declaration-list">
          {profile.step3FinancialInvestments.map((item, index) => <article key={item.id}>
            <div className="build-profile-declaration-grid build-profile-investment-declaration-grid">
              <label>Type of Asset<input value={item.assetType} onChange={(event) => updateFinancialInvestmentDeclaration(item.id, 'assetType', event.target.value)} /></label>
              <label>Issuer<input value={item.issuer} onChange={(event) => updateFinancialInvestmentDeclaration(item.id, 'issuer', event.target.value)} /></label>
              <label>Amount<NumericFormat value={item.amount} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestmentDeclaration(item.id, 'amount', value)} /></label>
              <label>Market Value<NumericFormat value={item.marketValue} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestmentDeclaration(item.id, 'marketValue', value)} /></label>
              <button type="button" className="loan-footer-button" onClick={() => setProfile((current) => {
                const step3FinancialInvestments = current.step3FinancialInvestments.filter((record) => record.id !== item.id)
                return { ...current, step3FinancialInvestments, values: { ...current.values, additionalVehicleDeclarations: financialInvestmentSummary(step3FinancialInvestments) } }
              })}>Remove Investment {index + 1}</button>
            </div>
          </article>)}
        </div>}
      </div>
    }

    if (field.type === 'checkbox') {
      if (field.yesNoChoice) {
        return <fieldset key={field.key} className="build-profile-yes-no-field" aria-invalid={field.countsTowardCompletion === false ? false : value !== 'true' && value !== 'false'}>
          <legend>{field.label}</legend>
          <div>
            {(['true', 'false'] as const).map((option) => {
              const optionLabel = option === 'true' ? 'Yes' : 'No'
              return <label key={option}>
                <input type="checkbox" checked={value === option} onChange={(event) => updateValue(field.key, event.target.checked ? option : '')} />
                <span>{optionLabel}</span>
              </label>
            })}
          </div>
        </fieldset>
      }
      const className = `build-profile-checkbox-field${field.mustBeChecked ? ' build-profile-checkbox-field-required' : ''}`
      return <label key={field.key} className={className}>
        <input aria-invalid={field.mustBeChecked ? value !== 'true' : field.countsTowardCompletion === false ? false : profile.values[field.key] === undefined} type="checkbox" checked={value === 'true'} onChange={(event) => updateValue(field.key, String(event.target.checked))} />
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
      ) : field.type === 'number' && BUILD_PROFILE_AMOUNT_KEYS.has(field.key) ? (
        <NumericFormat aria-invalid={field.countsTowardCompletion === false ? false : field.key === 'grossMonthlyIncome' ? Number(value) <= 0 : !value.trim()} value={value} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} readOnly={field.readOnly} onValueChange={({ value: numericValue }) => updateValue(field.key, numericValue)} />
      ) : (
        <input aria-invalid={field.countsTowardCompletion === false ? false : field.key === 'grossMonthlyIncome' ? Number(value) <= 0 : !value.trim()} type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={value} readOnly={field.readOnly} onChange={(event) => updateValue(field.key, event.target.value)} />
      )}
    </label>
  }

  const renderBankingField = (field: BankingField) => {
    const value = profile.values[field.key] ?? ''
    const datalistId = `build-profile-${field.key}-options`

    if (field.key === 'selfDeclaredAssetsAndLiabilities') {
      return <fieldset key={field.key} className="build-profile-declaration-box build-profile-field-wide">
        <legend>Declared Assets and Liabilities</legend>
        <div className="build-profile-declaration-grid build-profile-two-column-declaration-grid">
          <label>Assets<NumericFormat value={profile.values.declaredAssets ?? ''} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value: numericValue }) => updateDeclaredAssetsAndLiabilities('declaredAssets', numericValue)} /></label>
          <label>Liabilities<NumericFormat value={profile.values.declaredLiabilities ?? ''} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value: numericValue }) => updateDeclaredAssetsAndLiabilities('declaredLiabilities', numericValue)} /></label>
        </div>
      </fieldset>
    }

    if (field.key === 'selfDeclaredInvestmentPortfolio') {
      return <fieldset key={field.key} className="build-profile-declaration-box build-profile-field-wide">
        <legend>Self-Declared Portfolio</legend>
        <div className="build-profile-declaration-grid build-profile-two-column-declaration-grid">
          <label>Asset Type<input value={profile.values.portfolioAssetType ?? ''} onChange={(event) => updateSelfDeclaredPortfolio('portfolioAssetType', event.target.value)} /></label>
          <label>Total Amount<NumericFormat value={profile.values.portfolioTotalAmount ?? ''} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value: numericValue }) => updateSelfDeclaredPortfolio('portfolioTotalAmount', numericValue)} /></label>
        </div>
      </fieldset>
    }

    if (field.type === 'calculated') {
      const creditLimit = Number(profile.values.creditLimit || 0)
      const outstandingBalance = Math.max(0, Number(profile.values.outstandingBalance || 0))
      const utilization = creditLimit > 0 ? (outstandingBalance / creditLimit) * 100 : null
      const utilizationBand = utilization === null ? ''
        : utilization < 30 ? 'Below 30%'
          : utilization <= 50 ? '30–50%'
            : utilization <= 70 ? '51–70%'
              : utilization <= 90 ? '71–90%'
                : 'Above 90%'
      return <fieldset key={field.key} aria-invalid={utilization === null} className="build-profile-banking-radio-field build-profile-field-wide">
        <legend>{field.label}</legend>
        <output>{utilization === null ? 'Enter Total Credit Limit to calculate utilization.' : `${utilization.toFixed(2)}% (${utilizationBand})`}</output>
      </fieldset>
    }

    if (field.type === 'radio') {
      return <label key={field.key}>
        {field.label}
        <select aria-invalid={!value.trim()} value={value} onChange={(event) => updateValue(field.key, event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
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
        <textarea aria-invalid={!value.trim()} rows={field.rows ?? 3} value={value} onChange={(event) => updateValue(field.key, event.target.value)} />
      ) : field.type === 'datalist' ? (
        <>
          <input aria-invalid={!value.trim()} list={datalistId} value={value} placeholder="Enter card issuer" onChange={(event) => updateValue(field.key, event.target.value)} />
          <datalist id={datalistId}>{field.options?.map((option) => <option key={option} value={option} />)}</datalist>
        </>
      ) : field.type === 'number' && BUILD_PROFILE_AMOUNT_KEYS.has(field.key) ? (
        <NumericFormat aria-invalid={!value.trim()} value={value} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value: numericValue }) => updateValue(field.key, numericValue)} />
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
      : field.type === 'number' ? <NumericFormat aria-invalid={Number(value) <= 0} value={value} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value: numericValue }) => onChange(numericValue)} />
        : <input aria-invalid={!value.trim()} type={field.type ?? 'text'} value={value} onChange={(event) => onChange(event.target.value)} />}
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

        {spouseApplicable ? <section className="build-profile-detail-section">
          <h4>Spouse Employment Information</h4>
          <div className="build-profile-form-grid">
            {SPOUSE_EMPLOYMENT_FIELDS.map((field) => renderRelatedPartyField(field, profile.values[field.key] ?? '', (value) => updateValue(field.key, value), ''))}
          </div>
        </section> : <p className="build-profile-applicability-note">Spouse information is not required because Civil Status is not Married.</p>}

        <section className="build-profile-detail-section">
          <h4>Applicability</h4>
          <div className="build-profile-form-grid">
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

        <section className="build-profile-detail-section">
          <div className="build-profile-section-heading"><h4>Guarantor Information</h4><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, values: { ...current.values, hasGuarantor: 'true' }, guarantors: [...current.guarantors, createGuarantor()] }))}>Add Guarantor</button></div>
          {profile.guarantors.length > 0 ? <div className="build-profile-related-party-list">
            {profile.guarantors.map((item, index) => <article key={item.id}>
              <div className="build-profile-section-heading"><h5>Guarantor #{index + 1}</h5><button type="button" className="loan-footer-button" onClick={() => setProfile((current) => {
                const guarantors = current.guarantors.filter((record) => record.id !== item.id)
                return { ...current, values: { ...current.values, hasGuarantor: String(guarantors.length > 0) }, guarantors }
              })}>Remove</button></div>
              <div className="build-profile-form-grid">{GUARANTOR_FIELDS.map((field) => renderRelatedPartyField(field, item[field.key as keyof Guarantor], (value) => updateRelatedParty<Guarantor>('guarantors', item.id, field.key as keyof Guarantor, value), `Guarantor ${index + 1} `))}</div>
            </article>)}
          </div> : <p className="build-profile-applicability-note">No guarantor has been added. Select “Add Guarantor” to include one.</p>}
        </section>
      </div>
    }

    if (profile.step === 5) {
      return <div className="build-profile-step-content build-profile-step-five">
        <h3>Step 5: Banking Relationships</h3>
        <p className="psychometric-section-note">Assess your banking relationships.</p>
        {BANKING_RELATIONSHIP_SECTIONS.map((section) => <section key={section.title} className={`build-profile-detail-section${section.title === 'Historical Assessment Information' ? ' build-profile-credit-values' : ''}`}>
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
          <div className="build-profile-section-heading"><h4>Real Estate Collateral</h4><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, realEstateCollaterals: [...current.realEstateCollaterals, createRealEstateCollateral()] }))}>Add Real Estate Collateral</button></div>
          {profile.realEstateCollaterals.length === 0 ? <p className="build-profile-applicability-note">No real estate collateral added.</p> : <div className="build-profile-related-party-list">
            {profile.realEstateCollaterals.map((item, index) => <article key={item.id}>
              <div className="build-profile-section-heading"><h5>Real Estate Collateral #{index + 1}</h5><button type="button" className="loan-footer-button" onClick={() => setProfile((current) => ({ ...current, realEstateCollaterals: current.realEstateCollaterals.filter((record) => record.id !== item.id) }))}>Remove</button></div>
              <div className="build-profile-form-grid">
                <label>Real Estate {index + 1} TCT / CTC Number<input aria-invalid={!item.tctCtcNumber.trim()} value={item.tctCtcNumber} onChange={(event) => updateRealEstateCollateral(item.id, 'tctCtcNumber', event.target.value)} /></label>
                <label className="build-profile-field-wide">Real Estate {index + 1} Address<input aria-invalid={!item.address.trim()} value={item.address} onChange={(event) => updateRealEstateCollateral(item.id, 'address', event.target.value)} /></label>
                <label>Real Estate {index + 1} Appraised Value<NumericFormat aria-invalid={Number(item.appraisedValue) <= 0} value={item.appraisedValue} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateRealEstateCollateral(item.id, 'appraisedValue', value)} /></label>
              </div>
            </article>)}
          </div>}
        </section>

        <section className="build-profile-detail-section">
          <div className="build-profile-section-heading"><h4>Financial Instruments Collateral</h4><button type="button" className="loan-inline-button loan-inline-button-primary" onClick={() => setProfile((current) => ({ ...current, financialInstrumentCollaterals: [...current.financialInstrumentCollaterals, createFinancialInstrumentCollateral()] }))}>Add Financial Instrument</button></div>
          {profile.financialInstrumentCollaterals.length === 0 ? <p className="build-profile-applicability-note">No financial instrument collateral added.</p> : <div className="build-profile-related-party-list">
            {profile.financialInstrumentCollaterals.map((item, index) => <article key={item.id}>
              <div className="build-profile-section-heading"><h5>Financial Instrument #{index + 1}</h5><button type="button" className="loan-footer-button" onClick={() => setProfile((current) => ({ ...current, financialInstrumentCollaterals: current.financialInstrumentCollaterals.filter((record) => record.id !== item.id) }))}>Remove</button></div>
              <div className="build-profile-form-grid">
                <label>Financial Instrument {index + 1} Asset Type<select aria-invalid={!item.assetType.trim()} value={item.assetType} onChange={(event) => updateFinancialInstrumentCollateral(item.id, 'assetType', event.target.value)}><option value="">Select...</option>{['Time Deposit', 'Stocks', 'Bonds', 'ETF', 'Others'].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label>Financial Instrument {index + 1} Currency<select aria-invalid={!item.currency.trim()} value={item.currency} onChange={(event) => updateFinancialInstrumentCollateral(item.id, 'currency', event.target.value)}><option value="">Select...</option><option value="PHP">Peso</option><option value="USD">USD</option></select></label>
                <label>Financial Instrument {index + 1} Issuer<input aria-invalid={!item.issuer.trim()} value={item.issuer} onChange={(event) => updateFinancialInstrumentCollateral(item.id, 'issuer', event.target.value)} /></label>
                <label>Financial Instrument {index + 1} Value<NumericFormat aria-invalid={Number(item.value) <= 0} value={item.value} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInstrumentCollateral(item.id, 'value', value)} /></label>
                <label>Financial Instrument {index + 1} Mark to Market<NumericFormat aria-invalid={Number(item.markToMarket) <= 0} value={item.markToMarket} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInstrumentCollateral(item.id, 'markToMarket', value)} /></label>
              </div>
            </article>)}
          </div>}
        </section>

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
        'ai-emergency-fund-months': `${wealthScore.metrics.emergencyFundMonths.toFixed(3)} months`,
        'ai-credit-health': `${wealthScore.componentScores.leverageControl.toFixed(0)}/100`,
        'ai-investment-readiness': `${wealthScore.componentScores.investmentReadiness.toFixed(0)}/100`,
        'ai-retirement-readiness': `${wealthScore.componentScores.retirementReadiness.toFixed(0)}/100`,
        'ai-financial-independence-index': `${wealthScore.componentScores.financialIndependence.toFixed(0)}/100`,
        'ai-overall-financial-wellness': `${wealthScore.score} | ${wealthScore.grade} - ${wealthScore.rating}`,
      }
      const aiAdvisories = computeAiAdvisories({
        score: wealthScore,
        amounts: wealthAmounts,
        labels: Object.fromEntries(NET_WORTH_STATEMENT_ENTRIES.map((entry) => [entry.id, entry.label])),
        currency,
      })
      const categories = [...new Set(NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => wealthSectionFilter === 'all' || entry.section === wealthSectionFilter)
        .map((entry) => entry.category))].sort()
      const normalizedSearch = wealthLineSearch.trim().toLowerCase()
      const filteredEntries = NET_WORTH_STATEMENT_ENTRIES.filter((entry) =>
        (wealthSectionFilter === 'all' || entry.section === wealthSectionFilter)
        && (wealthCategoryFilter === 'all' || entry.category === wealthCategoryFilter)
        && (!normalizedSearch || entry.label.toLowerCase().includes(normalizedSearch)))
      const netWorthRows = NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => entry.section === 'assets' || entry.section === 'liabilities')
        .map((entry) => ({ ...entry, amount: Math.max(0, Number(profile.values[entry.id] || 0)) }))
      const detailedNetWorthRows = netWorthRows.filter((entry) => !entry.autoGenerated)
      const statementGroupTotal = (rows: typeof netWorthRows) => rows.reduce((sum, entry) => sum + entry.amount, 0)
      const incomeExpenseRows = NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => entry.section === 'monthly-income' || entry.section === 'monthly-expenses' || entry.section === 'financial-goals' || entry.section === 'insurance-coverage')
        .map((entry) => ({ ...entry, amount: Math.max(0, Number(profile.values[entry.id] || 0)) }))
      const incomeRows = incomeExpenseRows.filter((entry) => entry.section === 'monthly-income')
      const expenseRows = incomeExpenseRows.filter((entry) => entry.section === 'monthly-expenses')
      const goalRows = incomeExpenseRows.filter((entry) => entry.section === 'financial-goals')
      const protectionRows = incomeExpenseRows.filter((entry) => entry.section === 'insurance-coverage')
      const renderIncomeExpenseColumn = (title: string, rows: typeof incomeExpenseRows, tone: string) => <section className={`build-profile-income-expense-column build-profile-income-expense-${tone}`}>
        <h5>{title}</h5>
        <div className="build-profile-income-expense-lines">
          {[...new Set(rows.map((entry) => entry.category))].map((category) => <div key={category} className="build-profile-income-expense-group">
            <h6>{category}</h6>
            {rows.filter((entry) => entry.category === category).map((entry) => <label key={entry.id} className="build-profile-detailed-net-worth-line">
              <span>{entry.label}</span>
              <NumericFormat
                value={profile.values[entry.id] ?? ''}
                valueIsNumericString
                thousandSeparator="," decimalScale={2} fixedDecimalScale
                inputMode="decimal"
                allowNegative={false}
                placeholder=""
                aria-label={`${entry.label} personal statement amount`}
                onValueChange={({ value }) => updateValue(entry.id, value)}
              />
            </label>)}
          </div>)}
        </div>
        <div className="build-profile-net-worth-line build-profile-income-expense-total"><span>Total {title}</span><strong>{formatWealthCurrency(statementGroupTotal(rows))}</strong></div>
      </section>

      return <div className="build-profile-step-content build-profile-step-eight">
        <h3>Step 8: Actual / Current Financial Position</h3>
        <p className="psychometric-section-note">Capture your actual or current net worth, personal income, expenses, goals, and protection as of the selected date.</p>

        <section className="build-profile-wealth-comparator-callout" aria-labelledby="wealth-comparator-statement">
          <p id="wealth-comparator-statement">Before and after the Net Worth Statement, please assess your income standing versus in-country and global wealth index.</p>
          <a href="https://wid.world/income-comparator/" onClick={(event) => {
            event.preventDefault()
            window.open(
              event.currentTarget.href,
              'wid-income-comparator',
              'popup=yes,width=1200,height=850,resizable=yes,scrollbars=yes',
            )
          }}>Open WID Income Comparator in popout</a>
        </section>

        <section className="build-profile-detail-section">
          <h4>Personal Net Worth Statement</h4>
          <div className="build-profile-form-grid">
            <label>Long Term Financial Goal 
              <select aria-invalid={!profile.values.financialGoal?.trim()} value={profile.values.financialGoal ?? ''} onChange={(event) => updateValue('financialGoal', event.target.value)}>
                <option value="">Select Financial Goal</option>
                {NET_WORTH_FINANCIAL_GOAL_OPTIONS.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
              </select>
            </label>
            <label>Target Amount
              <NumericFormat
                value={profile.values.targetAmount ?? ''}
                valueIsNumericString
                thousandSeparator="," decimalScale={2} fixedDecimalScale
                inputMode="decimal"
                allowNegative={false}
                onValueChange={({ value }) => updateValue('targetAmount', value)}
              />
            </label>
            <label>Months to Achieve
              <input type="number" min="1" value={profile.values.targetMonths ?? '12'} onChange={(event) => updateValue('targetMonths', event.target.value)} />
            </label>
            <label>Set Date As Of
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
            <div><span>Actual / Current Net Worth</span><strong>{formatSignedCurrency(wealthScore.metrics.netWorth)}</strong></div>
          </div>
        </section>

        <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-detailed-net-worth">
          <summary><strong>Current Net Worth </strong></summary>
          <div className="build-profile-net-worth-meta"><span>Enter all applicable assets and liabilities</span><strong>As of: {profile.values.asOfDate || 'Not set'}</strong></div>
          <div className="build-profile-net-worth-columns">
            {(['assets', 'liabilities'] as const).map((section) => {
              const rows = detailedNetWorthRows.filter((entry) => entry.section === section)
              const categories = [...new Set(rows.map((entry) => entry.category))]
              return <section key={section} className={`build-profile-net-worth-column build-profile-net-worth-${section}`}>
                <h5>{section === 'assets' ? 'Assets' : 'Liabilities'}</h5>
                {categories.map((category) => <div key={category} className="build-profile-net-worth-group">
                  <h6>{category}</h6>
                  {rows.filter((entry) => entry.category === category).map((entry) => <label key={entry.id} className="build-profile-detailed-net-worth-line">
                    <span>{entry.label}</span>
                    <NumericFormat
                      value={profile.values[entry.id] ?? ''}
                      valueIsNumericString
                      thousandSeparator="," decimalScale={2} fixedDecimalScale
                      inputMode="decimal"
                      allowNegative={false}
                      placeholder=""
                      aria-label={`${entry.label} detailed net worth amount`}
                      onValueChange={({ value }) => updateValue(entry.id, value)}
                    />
                  </label>)}
                </div>)}
                <div className="build-profile-net-worth-line build-profile-net-worth-total"><span>Total {section === 'assets' ? 'Assets' : 'Liabilities'}</span><strong>{formatWealthCurrency(statementGroupTotal(rows))}</strong></div>
              </section>
            })}
          </div>
          <div className="build-profile-net-worth-result"><span>Net Worth (Total Assets Less Total Liabilities)</span><strong>{formatSignedCurrency(wealthScore.metrics.netWorth)}</strong></div>
        </details>

        <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-income-expense-statement">
          <summary>Actual / Current Personal Income and Expenses with Goals and Protection</summary>
          <div className="build-profile-net-worth-meta"><span>Actual personal income, expenses, goals, and protection statement</span><strong>As of: {profile.values.asOfDate || 'Not set'}</strong></div>
          <div className="build-profile-net-worth-columns build-profile-income-expense-columns">
            {renderIncomeExpenseColumn('Income', incomeRows, 'income')}
            {renderIncomeExpenseColumn('Expenses', expenseRows, 'expenses')}
            {renderIncomeExpenseColumn('Goals', goalRows, 'goals')}
            {renderIncomeExpenseColumn('Protection (Insurance)', protectionRows, 'protection')}
          </div>
          <div className="build-profile-income-expense-results">
            <div className="build-profile-income-expense-result build-profile-income-expense-net"><span>Net Income</span><strong>{formatSignedCurrency(wealthScore.metrics.monthlyCashFlow)}</strong></div>
            <div className="build-profile-income-expense-result build-profile-income-expense-goals"><span>Goals</span><strong>{formatWealthCurrency(statementGroupTotal(goalRows))}</strong></div>
            <div className="build-profile-income-expense-result build-profile-income-expense-protection"><span>Protection (Insurance)</span><strong>{formatWealthCurrency(statementGroupTotal(protectionRows))}</strong></div>
          </div>
        </details>

        <details className="build-profile-detail-section build-profile-statement-filters">
          <summary>Statement Filters - Details of Net Worth and Income & Expenses </summary>
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
        </details>

        <div className="build-profile-wealth-sections">
          {STEP1_SECTION_ORDER.map((section) => {
            const entries = filteredEntries.filter((entry) => entry.section === section)
            return <Fragment key={section}>
              <details className="build-profile-detail-section" open={wealthSectionFilter === section || (wealthSectionFilter === 'all' && section === 'assets')}>
                <summary>{STEP1_SECTION_SHORT_LABELS[section]} <span>({entries.length})</span></summary>
                {entries.length === 0 ? <p className="psychometric-section-note">No matching sub-accounts in this section for current filters.</p> : <div className="build-profile-wealth-entry-grid">
                  {entries.map((entry) => <article key={entry.id} className={entry.autoGenerated ? 'build-profile-ai-advisory-card' : undefined} tabIndex={entry.autoGenerated ? 0 : undefined}>
                    <span>{entry.label}</span><small>{entry.category}</small>
                    {entry.autoGenerated ? <><output>{aiValues[entry.id] ?? 'Auto-calculated'}</output><aside className="build-profile-ai-advisory" role="note" aria-label={`${entry.label} AI advisory`}>
                      <strong>FILSCORE AI Analysis</strong>
                      <ul>{aiAdvisories[entry.id]?.analysis.map((item) => <li key={item}>{item}</li>)}</ul>
                      <strong>AI Recommendation</strong>
                      <p>{aiAdvisories[entry.id]?.recommendation}</p>
                    </aside></> : <NumericFormat
                      aria-invalid={!profile.values[entry.id]?.trim()}
                      value={profile.values[entry.id] ?? ''}
                      valueIsNumericString
                      thousandSeparator="," decimalScale={2} fixedDecimalScale
                      inputMode="decimal"
                      allowNegative={false}
                      placeholder="0.00"
                      aria-label={`${entry.label} setup amount`}
                      onValueChange={({ value }) => updateValue(entry.id, value)}
                    />}
                    {!entry.autoGenerated ? <input
                      type="text"
                      className="build-profile-account-remark"
                      value={profile.values[`wealthRemark.${entry.id}`] ?? ''}
                      maxLength={160}
                      placeholder="Remarks"
                      aria-label={`${entry.label} remarks`}
                      onChange={(event) => updateValue(`wealthRemark.${entry.id}`, event.target.value)}
                    /> : null}
                  </article>)}
                </div>}
              </details>
            </Fragment>
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
      const assetsTotal = reviewRows.filter((entry) => entry.section === 'assets').reduce((sum, entry) => sum + entry.amount, 0)
      const liabilitiesTotal = reviewRows.filter((entry) => entry.section === 'liabilities').reduce((sum, entry) => sum + entry.amount, 0)
      const actualRows = NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => !entry.autoGenerated)
        .map((entry) => ({ ...entry, amount: Math.max(0, Number(profile.values[`wealthActual.${entry.id}`] || 0)) }))
      const actualAmounts = Object.fromEntries(actualRows.map((entry) => [entry.id, profile.values[`wealthActual.${entry.id}`] ?? '']))
      const actualScore = computeNetWorthBuildingScore({
        amounts: actualAmounts,
        selectedFinancialGoal: profile.values.financialGoal,
        targetAmount: profile.values.targetAmount,
        targetMonths: profile.values.targetMonths,
      })
      const actualAiValues: Record<string, string> = {
        'ai-net-worth': formatTargetCurrency(actualScore.metrics.netWorth),
        'ai-liquid-net-worth': formatTargetCurrency(actualScore.metrics.liquidAssets),
        'ai-monthly-cash-flow': formatTargetCurrency(actualScore.metrics.monthlyCashFlow),
        'ai-savings-rate': `${actualScore.metrics.savingsRatePercent.toFixed(1)}%`,
        'ai-dti': `${actualScore.metrics.debtToIncomeRatioPercent.toFixed(1)}%`,
        'ai-dta': `${actualScore.metrics.debtToAssetRatioPercent.toFixed(1)}%`,
        'ai-emergency-fund-months': `${actualScore.metrics.emergencyFundMonths.toFixed(3)} months`,
        'ai-credit-health': `${actualScore.componentScores.leverageControl.toFixed(0)}/100`,
        'ai-investment-readiness': `${actualScore.componentScores.investmentReadiness.toFixed(0)}/100`,
        'ai-retirement-readiness': `${actualScore.componentScores.retirementReadiness.toFixed(0)}/100`,
        'ai-financial-independence-index': `${actualScore.componentScores.financialIndependence.toFixed(0)}/100`,
        'ai-overall-financial-wellness': `${actualScore.score} | ${actualScore.grade} - ${actualScore.rating}`,
      }
      const targetAdvisoryCopy = (text: string) => text
        .replace(/\bCurrent\b/g, 'Desired target')
        .replace(/\bcurrent\b/g, 'desired target')
      const actualAiAdvisories = Object.fromEntries(Object.entries(computeAiAdvisories({
        score: actualScore,
        amounts: actualAmounts,
        labels: Object.fromEntries(NET_WORTH_STATEMENT_ENTRIES.map((entry) => [entry.id, entry.label])),
        currency,
      })).map(([entryId, advisory]) => [entryId, {
        analysis: advisory.analysis.map(targetAdvisoryCopy),
        recommendation: targetAdvisoryCopy(advisory.recommendation),
      }]))
      const categories = [...new Set(NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => targetSectionFilter === 'all' || entry.section === targetSectionFilter)
        .map((entry) => entry.category))].sort()
      const normalizedSearch = targetLineSearch.trim().toLowerCase()
      const filteredRows = NET_WORTH_STATEMENT_ENTRIES.filter((entry) =>
        (targetSectionFilter === 'all' || entry.section === targetSectionFilter)
        && (targetCategoryFilter === 'all' || entry.category === targetCategoryFilter)
        && (!normalizedSearch || entry.label.toLowerCase().includes(normalizedSearch)))
      const actualNetWorthRows = actualRows.filter((entry) => entry.section === 'assets' || entry.section === 'liabilities')
      const actualIncomeRows = actualRows.filter((entry) => entry.section === 'monthly-income')
      const actualExpenseRows = actualRows.filter((entry) => entry.section === 'monthly-expenses')
      const actualGoalRows = actualRows.filter((entry) => entry.section === 'financial-goals')
      const actualProtectionRows = actualRows.filter((entry) => entry.section === 'insurance-coverage')
      const totalActual = (rows: typeof actualRows) => rows.reduce((sum, entry) => sum + entry.amount, 0)
      const renderActualColumn = (title: string, rows: typeof actualRows, tone: string) => <section className={`build-profile-income-expense-column build-profile-income-expense-${tone}`}>
        <h5>{title}</h5>
        <div className="build-profile-income-expense-lines">
          {[...new Set(rows.map((entry) => entry.category))].map((category) => <div key={category} className="build-profile-income-expense-group">
            <h6>{category}</h6>
            {rows.filter((entry) => entry.category === category).map((entry) => <label key={entry.id} className="build-profile-detailed-net-worth-line">
              <span>{entry.label}</span>
              <NumericFormat value={profile.values[`wealthActual.${entry.id}`] ?? ''} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} placeholder="" aria-label={`${entry.label} target statement amount`} onValueChange={({ value }) => updateDesiredWealthValue(entry.id, value)} />
            </label>)}
          </div>)}
        </div>
        <div className="build-profile-net-worth-line build-profile-income-expense-total"><span>Total {title}</span><strong>{formatTargetCurrency(totalActual(rows))}</strong></div>
      </section>
      const saveActualSetup = () => {
        if (!profile.values.asOfDate) {
          setSaveMessage('Please set the As Of date in Step 8 before saving actual values.')
          return
        }
        if (reviewRows.length === 0) {
          setSaveMessage('Please enter at least one target amount in Step 8 before continuing.')
          return
        }
        setProfile((current) => {
          const values = Object.fromEntries(Object.entries(current.values).filter(([key]) => !key.startsWith('wealthTarget.') && !key.startsWith('wealthVarianceNote.')))
          NET_WORTH_STATEMENT_ENTRIES.filter((entry) => !entry.autoGenerated).forEach((entry) => {
            const desiredValue = values[`wealthActual.${entry.id}`]
            if (desiredValue?.trim()) values[`wealthTarget.${entry.id}`] = desiredValue
          })
          values.wealthSetupSaved = 'true'
          return { ...current, step: 10, values }
        })
        setSaveMessage('Desired financial statement saved. Continue with Step 10.')
      }

      return <div className="build-profile-step-content build-profile-step-nine">
        <h3>Step 9: Desired / Target Financial Position</h3>
        <p className="psychometric-section-note">Step 8 actual values are copied as a starting point. Adjust them to define your desired or target financial position for comparison in Step 10.</p>

        <section className="build-profile-detail-section">
          <h4>Desired / Target Summary</h4>
          <div className="build-profile-totals-grid build-profile-target-summary">
            <div><span>As Of</span><strong>{profile.values.asOfDate || 'Not set'}</strong></div>
            <div><span>Financial Goal</span><strong>{profile.values.financialGoal || 'Not selected'}</strong></div>
            <div><span>Actual Entries Copied</span><strong>{reviewRows.length}</strong></div>
            <div><span>Step 8 Actual Net Worth</span><strong>{formatTargetCurrency(assetsTotal - liabilitiesTotal)}</strong></div>
          </div>
        </section>

        <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-detailed-net-worth build-profile-actual-net-worth">
          <summary><strong>Desired / Target Net Worth</strong></summary>
          <div className="build-profile-net-worth-meta"><span>Step 8 actual assets and liabilities are copied automatically. Adjust them to define the desired target.</span><label>Target As Of <input aria-label="Target statement as of date" type="date" value={profile.values.wealthActualAsOfDate ?? ''} onChange={(event) => updateValue('wealthActualAsOfDate', event.target.value)} /></label></div>
          <div className="build-profile-net-worth-columns">
            {(['assets', 'liabilities'] as const).map((section) => {
              const rows = actualNetWorthRows.filter((entry) => entry.section === section)
              return <section key={section} className={`build-profile-net-worth-column build-profile-net-worth-${section}`}>
                <h5>{section === 'assets' ? 'Assets' : 'Liabilities'}</h5>
                {[...new Set(rows.map((entry) => entry.category))].map((category) => <div key={category} className="build-profile-net-worth-group">
                  <h6>{category}</h6>
                  {rows.filter((entry) => entry.category === category).map((entry) => <label key={entry.id} className="build-profile-detailed-net-worth-line"><span>{entry.label}</span><NumericFormat value={profile.values[`wealthActual.${entry.id}`] ?? ''} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} placeholder="" aria-label={`${entry.label} target net worth amount`} onValueChange={({ value }) => updateDesiredWealthValue(entry.id, value)} /></label>)}
                </div>)}
                <div className="build-profile-net-worth-line build-profile-net-worth-total"><span>Total {section === 'assets' ? 'Assets' : 'Liabilities'}</span><strong>{formatTargetCurrency(totalActual(rows))}</strong></div>
              </section>
            })}
          </div>
          <div className="build-profile-net-worth-result"><span>Desired / Target Net Worth</span><strong>{formatTargetCurrency(actualScore.metrics.netWorth)}</strong></div>
        </details>

        <details className="build-profile-detail-section build-profile-financial-investments">
          <summary>Details of Financial Invesment</summary>
          <p className="psychometric-section-note">
            Record financial investments held in this profile. Investment types include Equity (Stock), Bond, Mutual Fund, Alternative, and Others.
          </p>
          <div className="psychometric-scale-table-wrap build-profile-financial-investments-table">
            <table className="psychometric-scale-table">
              <thead>
                <tr>
                  <th>Investment Type</th>
                  <th>Issuer / Asset</th>
                  <th>Original Investment</th>
                  <th>Date Acquired</th>
                  <th>Current Market Value</th>
                  <th>Units / Shares</th>
                  <th>Cost Basis</th>
                  <th>Mark-to-Market Value</th>
                  <th>Unrealized Gain/Loss</th>
                  <th>Yield / Dividend %</th>
                  <th>Risk Rating</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {profile.financialInvestments.map((investment, index) => (
                  <tr key={investment.id}>
                    <td>
                      <select aria-label={`Investment ${index + 1} type`} value={investment.investmentType} onChange={(event) => updateFinancialInvestment(investment.id, 'investmentType', event.target.value)}>
                        <option value="">Select type</option>
                        {['Equity (Stock)', 'Bond', 'Mutual Fund', 'Alternative', 'Others'].map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </td>
                    <td><input aria-label={`Investment ${index + 1} issuer or asset`} value={investment.issuerAsset} onChange={(event) => updateFinancialInvestment(investment.id, 'issuerAsset', event.target.value)} /></td>
                    <td><NumericFormat aria-label={`Investment ${index + 1} original investment`} value={investment.originalInvestment} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestment(investment.id, 'originalInvestment', value)} /></td>
                    <td><input aria-label={`Investment ${index + 1} date acquired`} type="date" value={investment.dateAcquired} onChange={(event) => updateFinancialInvestment(investment.id, 'dateAcquired', event.target.value)} /></td>
                    <td><NumericFormat aria-label={`Investment ${index + 1} current market value`} value={investment.currentMarketValue} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestment(investment.id, 'currentMarketValue', value)} /></td>
                    <td><NumericFormat aria-label={`Investment ${index + 1} units or shares`} value={investment.unitsShares} valueIsNumericString thousandSeparator="," decimalScale={4} inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestment(investment.id, 'unitsShares', value)} /></td>
                    <td><NumericFormat aria-label={`Investment ${index + 1} cost basis`} value={investment.costBasis} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestment(investment.id, 'costBasis', value)} /></td>
                    <td><NumericFormat aria-label={`Investment ${index + 1} mark to market value`} value={investment.markToMarketValue} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestment(investment.id, 'markToMarketValue', value)} /></td>
                    <td><NumericFormat aria-label={`Investment ${index + 1} unrealized gain or loss`} value={investment.unrealizedGainLoss} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative onValueChange={({ value }) => updateFinancialInvestment(investment.id, 'unrealizedGainLoss', value)} /></td>
                    <td><NumericFormat aria-label={`Investment ${index + 1} yield or dividend percent`} value={investment.yieldDividendPercent} valueIsNumericString decimalScale={2} inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateFinancialInvestment(investment.id, 'yieldDividendPercent', value)} /></td>
                    <td><input aria-label={`Investment ${index + 1} risk rating`} value={investment.riskRating} onChange={(event) => updateFinancialInvestment(investment.id, 'riskRating', event.target.value)} /></td>
                    <td><button type="button" className="budget-dashboard-category-reset" onClick={() => setProfile((current) => ({ ...current, financialInvestments: current.financialInvestments.filter((item) => item.id !== investment.id) }))}>Remove</button></td>
                  </tr>
                ))}
                {profile.financialInvestments.length === 0 ? <tr><td colSpan={12}>No financial investments added yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="budget-workflow-inline-actions">
            <button type="button" className="psychometric-reset-button" onClick={() => setProfile((current) => ({ ...current, financialInvestments: [...current.financialInvestments, createFinancialInvestment()] }))}>
              Add Financial Investment
            </button>
          </div>
        </details>

        <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-income-expense-statement build-profile-actual-income-expense">
          <summary>Desired / Target Personal Income and Expenses</summary>
          <div className="build-profile-net-worth-meta"><span>Desired income, expenses, goals, and protection</span><strong>Target values</strong></div>
          <div className="build-profile-net-worth-columns build-profile-income-expense-columns">
            {renderActualColumn('Income', actualIncomeRows, 'income')}
            {renderActualColumn('Expenses', actualExpenseRows, 'expenses')}
            {renderActualColumn('Goals', actualGoalRows, 'goals')}
            {renderActualColumn('Protection (Insurance)', actualProtectionRows, 'protection')}
          </div>
          <div className="build-profile-income-expense-results">
            <div className="build-profile-income-expense-result build-profile-income-expense-net"><span>Net Income</span><strong>{formatTargetCurrency(actualScore.metrics.monthlyCashFlow)}</strong></div>
            <div className="build-profile-income-expense-result build-profile-income-expense-goals"><span>Goals</span><strong>{formatTargetCurrency(totalActual(actualGoalRows))}</strong></div>
            <div className="build-profile-income-expense-result build-profile-income-expense-protection"><span>Protection (Insurance)</span><strong>{formatTargetCurrency(totalActual(actualProtectionRows))}</strong></div>
          </div>
        </details>

        <details className="build-profile-detail-section build-profile-statement-filters">
          <summary>Statement Filters - Details</summary>
          <div className="build-profile-form-grid">
              <label>Statement Section<select aria-label="Target filter by statement section" value={targetSectionFilter} onChange={(event) => { setTargetSectionFilter(event.target.value as 'all' | StatementSection); setTargetCategoryFilter('all') }}><option value="all">All Sections</option>{STEP1_SECTION_ORDER.map((section) => <option key={section} value={section}>{STEP1_SECTION_SHORT_LABELS[section]}</option>)}</select></label>
            <label>Account Group<select aria-label="Target filter by account group" value={targetCategoryFilter} onChange={(event) => setTargetCategoryFilter(event.target.value)}><option value="all">All Account Groups</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label>Line Item<input type="search" aria-label="Target filter by line item" placeholder="Search line item" value={targetLineSearch} onChange={(event) => setTargetLineSearch(event.target.value)} /></label>
            <div className="build-profile-filter-result"><span>Matching Rows</span><strong>{filteredRows.length}</strong><button type="button" className="loan-footer-button" onClick={() => { setTargetSectionFilter('all'); setTargetCategoryFilter('all'); setTargetLineSearch('') }}>Clear Filters</button></div>
          </div>
        </details>

        <div className="build-profile-wealth-sections">
          {STEP1_SECTION_ORDER.map((section) => {
            const entries = filteredRows.filter((entry) => entry.section === section)
            return <details key={section} className="build-profile-detail-section" open={targetSectionFilter === section || (targetSectionFilter === 'all' && section === 'assets')}>
              <summary>{STEP1_SECTION_SHORT_LABELS[section]} <span>({entries.length})</span></summary>
              {entries.length === 0 ? <p className="psychometric-section-note">No matching accounts.</p> : <div className="build-profile-wealth-entry-grid">
                {entries.map((entry) => <article key={entry.id} className={entry.autoGenerated ? 'build-profile-ai-advisory-card' : undefined} tabIndex={entry.autoGenerated ? 0 : undefined}>
                  <span>{entry.label}</span><small>{entry.category}</small>
                  {entry.autoGenerated ? <><output>{actualAiValues[entry.id] ?? 'Auto-calculated'}</output><aside className="build-profile-ai-advisory" role="note" aria-label={`${entry.label} target AI advisory`}><strong>FILSCORE AI Target Analysis</strong><ul>{actualAiAdvisories[entry.id]?.analysis.map((item) => <li key={item}>{item}</li>)}</ul><strong>AI Recommendation</strong><p>{actualAiAdvisories[entry.id]?.recommendation}</p></aside></> : <NumericFormat aria-invalid={!profile.values[`wealthActual.${entry.id}`]?.trim()} value={profile.values[`wealthActual.${entry.id}`] ?? ''} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} placeholder="0.00" aria-label={`${entry.label} target amount`} onValueChange={({ value }) => updateDesiredWealthValue(entry.id, value)} />}
                  {!entry.autoGenerated ? <input type="text" className="build-profile-account-remark" value={profile.values[`wealthActualRemark.${entry.id}`] ?? ''} maxLength={160} placeholder="Remarks" aria-label={`${entry.label} target remarks`} onChange={(event) => updateValue(`wealthActualRemark.${entry.id}`, event.target.value)} /> : null}
                </article>)}
              </div>}
            </details>
          })}
        </div>

        <div className="build-profile-target-actions">
          <button type="button" className="loan-footer-button" onClick={() => goToStep(8)}>Back to Step 8</button>
          <button type="button" className="loan-inline-button loan-inline-button-primary" onClick={saveActualSetup}>Save Desired Target and Continue to Step 10</button>
        </div>
      </div>
    }

    if (profile.step === 10) {
      const currency = profile.values.wealthCurrency || 'PHP'
      const formatVarianceCurrency = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
      const formatSignedVariance = (amount: number) => `${amount < 0 ? '-' : amount > 0 ? '+' : ''}${formatVarianceCurrency(Math.abs(amount))}`
      const varianceExplanation = (section: StatementSection, variance: number) => {
        if (variance === 0) return 'Actual value matches the desired target'
        if (section === 'liabilities' || section === 'monthly-expenses') {
          return variance > 0 ? 'Desired target is above the current amount' : 'Desired target reduces the current amount'
        }
        return variance > 0 ? 'Desired target is above the current amount' : 'Desired target is below the current amount'
      }
      const targetRows = NET_WORTH_STATEMENT_ENTRIES
        .filter((entry) => !entry.autoGenerated && (profile.values[entry.id]?.trim() || profile.values[`wealthActual.${entry.id}`]?.trim()))
        .map((entry) => {
          const rawActual = profile.values[entry.id] ?? ''
          const hasActual = rawActual.trim() !== ''
          const rawTarget = profile.values[`wealthActual.${entry.id}`] ?? ''
          const hasTarget = rawTarget.trim() !== ''
          const targetAmount = hasTarget ? Math.max(0, Number(rawTarget) || 0) : 0
          const actualAmount = hasActual ? Math.max(0, Number(rawActual) || 0) : 0
          return { ...entry, targetAmount, rawTarget, hasTarget, rawActual, hasActual, actualAmount, variance: hasActual && hasTarget ? targetAmount - actualAmount : 0 }
        })
      const completedActuals = targetRows.filter((entry) => entry.hasTarget).length
      const actualPercent = targetRows.length > 0 ? Math.round((completedActuals / targetRows.length) * 100) : 0
      const categories = [...new Set(targetRows
        .filter((entry) => varianceSectionFilter === 'all' || entry.section === varianceSectionFilter)
        .map((entry) => entry.category))].sort()
      const normalizedSearch = varianceLineSearch.trim().toLowerCase()
      const filteredRows = targetRows.filter((entry) =>
        (varianceSectionFilter === 'all' || entry.section === varianceSectionFilter)
        && (varianceCategoryFilter === 'all' || entry.category === varianceCategoryFilter)
        && (!normalizedSearch || entry.label.toLowerCase().includes(normalizedSearch)))
      const netWorthRows = targetRows.filter((entry) => entry.section === 'assets' || entry.section === 'liabilities')
      const currentAssetCategories = new Set(['1. Cash & Bank Accounts', '9. Receivables'])
      const currentLiabilityCategories = new Set(['Credit Obligations', 'Medical Obligations', 'Taxes & Other Payables'])
      const targetValue = (entry: typeof netWorthRows[number]) => entry.targetAmount
      const statementTotal = (rows: typeof netWorthRows, valueFor: (entry: typeof netWorthRows[number]) => number) => rows.reduce((sum, entry) => sum + valueFor(entry), 0)
      const statementRows = {
        currentAssets: netWorthRows.filter((entry) => entry.section === 'assets' && currentAssetCategories.has(entry.category)),
        longTermAssets: netWorthRows.filter((entry) => entry.section === 'assets' && !currentAssetCategories.has(entry.category)),
        currentLiabilities: netWorthRows.filter((entry) => entry.section === 'liabilities' && currentLiabilityCategories.has(entry.category)),
        longTermLiabilities: netWorthRows.filter((entry) => entry.section === 'liabilities' && !currentLiabilityCategories.has(entry.category)),
      }
      const actualAmounts = Object.fromEntries(targetRows
        .filter((entry) => entry.hasActual)
        .map((entry) => [entry.id, entry.rawActual]))
      const actualScore = computeNetWorthBuildingScore({
        amounts: actualAmounts,
        selectedFinancialGoal: profile.values.financialGoal,
        targetAmount: profile.values.targetAmount,
        targetMonths: profile.values.targetMonths,
      })
      const actualAdvisories = computeAiAdvisories({
        score: actualScore,
        amounts: actualAmounts,
        labels: Object.fromEntries(targetRows.map((entry) => [entry.id, entry.label])),
        currency,
      })
      const actualNetWorthAdvisory = actualAdvisories['ai-net-worth']
      const actualLeverageAdvisory = actualAdvisories['ai-dta']
      const hasActualCashFlowInputs = targetRows.some((entry) => entry.hasActual && (entry.section === 'monthly-income' || entry.section === 'monthly-expenses'))
      const financialRows = targetRows.filter((entry) => entry.section === 'monthly-income' || entry.section === 'monthly-expenses' || entry.section === 'financial-goals' || entry.section === 'insurance-coverage')
      const financialGroups = [
        { title: 'Income', section: 'monthly-income' as const, tone: 'income' },
        { title: 'Expenses', section: 'monthly-expenses' as const, tone: 'expenses' },
        { title: 'Goals', section: 'financial-goals' as const, tone: 'goals' },
        { title: 'Protection (Insurance)', section: 'insurance-coverage' as const, tone: 'protection' },
      ]
      const financialValue = (entry: typeof financialRows[number], mode: 'target' | 'actual' | 'variance') => mode === 'target'
        ? entry.targetAmount
        : mode === 'actual'
          ? entry.hasActual ? entry.actualAmount : 0
          : entry.hasActual && entry.hasTarget ? entry.variance : 0
      const financialTotal = (section: StatementSection, mode: 'target' | 'actual' | 'variance') => financialRows
        .filter((entry) => entry.section === section)
        .reduce((sum, entry) => sum + financialValue(entry, mode), 0)
      const summaryTotal = (section: StatementSection, mode: 'target' | 'actual') => targetRows
        .filter((entry) => entry.section === section)
        .reduce((sum, entry) => sum + (mode === 'target' ? entry.targetAmount : entry.hasActual ? entry.actualAmount : 0), 0)
      const targetAssetTotal = summaryTotal('assets', 'target')
      const actualAssetTotal = summaryTotal('assets', 'actual')
      const targetLiabilityTotal = summaryTotal('liabilities', 'target')
      const actualLiabilityTotal = summaryTotal('liabilities', 'actual')
      const targetNetWorth = targetAssetTotal - targetLiabilityTotal
      const actualNetWorth = actualAssetTotal - actualLiabilityTotal
      const targetNetIncome = financialTotal('monthly-income', 'target') - financialTotal('monthly-expenses', 'target')
      const actualNetIncome = financialTotal('monthly-income', 'actual') - financialTotal('monthly-expenses', 'actual')
      const targetGoalsProtection = financialTotal('financial-goals', 'target') + financialTotal('insurance-coverage', 'target')
      const actualGoalsProtection = financialTotal('financial-goals', 'actual') + financialTotal('insurance-coverage', 'actual')
      const comparisonSummaries = [
        {
          title: '1. Actual vs Desired / Target Total Assets',
          target: targetAssetTotal,
          actual: actualAssetTotal,
          analysis: actualAssetTotal >= targetAssetTotal
            ? `Step 8 actual assets are ${formatVarianceCurrency(actualAssetTotal - targetAssetTotal)} at or above the Step 9 desired target.`
            : `The Step 9 desired asset target is ${formatVarianceCurrency(targetAssetTotal - actualAssetTotal)} above Step 8 actual assets.`,
          recommendation: actualAssetTotal >= targetAssetTotal
            ? 'Preserve the gain, maintain adequate liquidity, and review asset concentration before adding new exposure.'
            : 'Prioritize regular asset contributions, protect liquid reserves, and address the largest target shortfalls first.',
        },
        {
          title: '2. Actual vs Desired / Target Liabilities',
          target: targetLiabilityTotal,
          actual: actualLiabilityTotal,
          analysis: actualLiabilityTotal <= targetLiabilityTotal
            ? `Step 8 actual liabilities are ${formatVarianceCurrency(targetLiabilityTotal - actualLiabilityTotal)} at or below the Step 9 desired target.`
            : `Step 8 actual liabilities exceed the Step 9 desired target by ${formatVarianceCurrency(actualLiabilityTotal - targetLiabilityTotal)}.`,
          recommendation: actualLiabilityTotal <= targetLiabilityTotal
            ? 'Continue scheduled repayments and direct available surplus toward the highest-cost remaining obligations.'
            : 'Avoid additional borrowing, review interest costs, and accelerate repayment of the liabilities with the greatest cash-flow impact.',
        },
        {
          title: '3. Actual vs Desired / Target Net Worth',
          target: targetNetWorth,
          actual: actualNetWorth,
          analysis: actualNetWorth >= targetNetWorth
            ? `Step 8 actual net worth is ${formatVarianceCurrency(actualNetWorth - targetNetWorth)} above the Step 9 desired target.`
            : `The Step 9 desired net worth target is ${formatVarianceCurrency(targetNetWorth - actualNetWorth)} above Step 8 actual net worth.`,
          recommendation: actualNetWorth >= targetNetWorth
            ? 'Maintain positive asset growth and liability control while rebalancing toward diversified, productive assets.'
            : 'Improve net worth through a combined plan of asset accumulation, debt reduction, and protection against unplanned withdrawals.',
        },
        {
          title: '4. Actual vs Desired / Target Net Income/Loss',
          target: targetNetIncome,
          actual: actualNetIncome,
          analysis: actualNetIncome >= targetNetIncome
            ? `Step 8 actual monthly net income is ${formatVarianceCurrency(actualNetIncome - targetNetIncome)} above the Step 9 desired target.`
            : `The Step 9 desired monthly net income target is ${formatVarianceCurrency(targetNetIncome - actualNetIncome)} above Step 8 actual net income.`,
          recommendation: actualNetIncome > 0
            ? 'Allocate the monthly surplus across emergency reserves, priority debt, goals, and long-term investments.'
            : 'Reduce nonessential recurring expenses and strengthen dependable income before adding financial commitments.',
        },
        {
          title: '5. Actual vs Desired / Target Goals and Protection',
          target: targetGoalsProtection,
          actual: actualGoalsProtection,
          analysis: `Step 8 actual goals are ${formatVarianceCurrency(financialTotal('financial-goals', 'actual'))} versus the Step 9 desired target of ${formatVarianceCurrency(financialTotal('financial-goals', 'target'))}. Step 8 actual protection is ${formatVarianceCurrency(financialTotal('insurance-coverage', 'actual'))} versus the Step 9 desired target of ${formatVarianceCurrency(financialTotal('insurance-coverage', 'target'))}.`,
          recommendation: actualGoalsProtection >= targetGoalsProtection
            ? 'Confirm that goal funding and insurance coverage remain affordable, correctly allocated, and aligned with current priorities.'
            : 'Close essential protection gaps first, then automate affordable contributions toward the highest-priority goals.',
        },
      ]
      const renderFinancialComparisonGroup = (title: string, section: StatementSection, tone: string, mode: 'target' | 'actual' | 'variance') => {
        const rows = financialRows.filter((entry) => entry.section === section)
        return <section className={`build-profile-net-worth-column build-profile-income-expense-column build-profile-income-expense-${tone}`}>
          <h5>{title}</h5>
          <div className="build-profile-income-expense-lines">
            {rows.length > 0 ? rows.map((entry) => <div key={entry.id} className={`build-profile-net-worth-line${mode === 'variance' ? ' build-profile-comparison-variance-line' : ''}`}>
              <span>{entry.label}</span>
              <strong>{(mode === 'actual' && !entry.hasActual) || (mode === 'target' && !entry.hasTarget) || (mode === 'variance' && (!entry.hasActual || !entry.hasTarget)) ? 'Pending' : mode === 'variance' ? formatSignedVariance(entry.variance) : formatVarianceCurrency(financialValue(entry, mode))}</strong>
            </div>) : <div className="build-profile-net-worth-line build-profile-net-worth-empty"><span>No Step 8 actual value</span><strong>{formatVarianceCurrency(0)}</strong></div>}
          </div>
          <div className="build-profile-net-worth-line build-profile-income-expense-total"><span>Total {title}</span><strong>{mode === 'variance' ? formatSignedVariance(financialTotal(section, mode)) : formatVarianceCurrency(financialTotal(section, mode))}</strong></div>
        </section>
      }
      const renderFinancialComparisonStatement = (mode: 'target' | 'actual' | 'variance') => {
        const netIncome = financialTotal('monthly-income', mode) - financialTotal('monthly-expenses', mode)
        return <article className={`build-profile-comparison-statement build-profile-comparison-${mode} build-profile-financial-comparison-statement`}>
          <header><span>{mode === 'target' ? 'Desired / Target' : mode === 'actual' ? 'Actual / Current' : 'Variance'}</span><strong>{mode === 'target' ? 'Step 9' : mode === 'actual' ? 'Step 8' : 'Target less Actual'}</strong></header>
          <div className="build-profile-comparison-date"><span>{mode === 'target' ? profile.values.wealthActualAsOfDate || 'Not set' : mode === 'actual' ? profile.values.asOfDate || 'Not set' : 'Automatic comparison'}</span></div>
          {financialGroups.map((group) => <Fragment key={group.section}>{renderFinancialComparisonGroup(group.title, group.section, group.tone, mode)}</Fragment>)}
          <div className="build-profile-income-expense-results">
            <div className="build-profile-income-expense-result build-profile-income-expense-net"><span>Net Income</span><strong>{mode === 'variance' ? formatSignedVariance(netIncome) : formatVarianceCurrency(netIncome)}</strong></div>
            <div className="build-profile-income-expense-result build-profile-income-expense-goals"><span>Goals</span><strong>{mode === 'variance' ? formatSignedVariance(financialTotal('financial-goals', mode)) : formatVarianceCurrency(financialTotal('financial-goals', mode))}</strong></div>
            <div className="build-profile-income-expense-result build-profile-income-expense-protection"><span>Protection</span><strong>{mode === 'variance' ? formatSignedVariance(financialTotal('insurance-coverage', mode)) : formatVarianceCurrency(financialTotal('insurance-coverage', mode))}</strong></div>
          </div>
        </article>
      }
      const renderEditableComparisonGroup = (
        title: string,
        rows: typeof netWorthRows,
        mode: 'target' | 'actual' | 'variance',
      ) => {
        const valueFor = mode === 'target' ? targetValue : mode === 'actual' ? (entry: typeof netWorthRows[number]) => entry.hasActual ? entry.actualAmount : 0 : (entry: typeof netWorthRows[number]) => entry.hasActual ? entry.variance : 0
        return <section className="build-profile-net-worth-group">
          <h6>{title}</h6>
          {rows.length > 0 ? rows.map((entry) => <label key={entry.id} className="build-profile-net-worth-line build-profile-comparison-input-line">
            <span>{entry.label}</span>
            {mode === 'variance' ? <strong>{entry.hasActual && entry.hasTarget ? formatSignedVariance(entry.variance) : 'Pending'}</strong> : <NumericFormat
              aria-label={`${entry.label} ${mode} input`}
              aria-invalid={mode === 'target' ? !entry.hasTarget : !entry.hasActual}
              value={mode === 'target' ? entry.rawTarget : entry.rawActual}
              valueIsNumericString
              thousandSeparator="," decimalScale={2} fixedDecimalScale
              inputMode="decimal"
              allowNegative={false}
              placeholder="0.00"
              onValueChange={({ value }) => mode === 'target' ? updateDesiredWealthValue(entry.id, value) : updateValue(entry.id, value)}
            />}
          </label>) : <div className="build-profile-net-worth-line build-profile-net-worth-empty"><span>No saved amounts</span><strong>{formatVarianceCurrency(0)}</strong></div>}
          <div className="build-profile-net-worth-line build-profile-net-worth-subtotal"><span>Total {title}</span><strong>{mode === 'variance' ? formatSignedVariance(statementTotal(rows, valueFor)) : formatVarianceCurrency(statementTotal(rows, valueFor))}</strong></div>
        </section>
      }
      const renderEditableComparisonStatement = (mode: 'target' | 'actual' | 'variance') => {
        const isVariance = mode === 'variance'
        const editorValue = mode === 'target' ? targetValue : mode === 'actual' ? (entry: typeof netWorthRows[number]) => entry.hasActual ? entry.actualAmount : 0 : (entry: typeof netWorthRows[number]) => entry.hasActual && entry.hasTarget ? entry.variance : 0
        const assetsTotal = statementTotal(netWorthRows.filter((entry) => entry.section === 'assets'), editorValue)
        const liabilitiesTotal = statementTotal(netWorthRows.filter((entry) => entry.section === 'liabilities'), editorValue)
        const netWorth = assetsTotal - liabilitiesTotal
        return <article className={`build-profile-comparison-statement build-profile-comparison-${mode} build-profile-comparison-input-statement`}>
          <header><span>{mode === 'target' ? 'Desired / Target' : mode === 'actual' ? 'Actual / Current' : 'Variance'}</span><strong>{mode === 'target' ? 'Step 9 Inputs' : mode === 'actual' ? 'Step 8 Inputs' : 'Target less Actual'}</strong></header>
          <section className="build-profile-net-worth-column build-profile-net-worth-assets">
            <h5>Assets</h5>
            {renderEditableComparisonGroup('Current Assets', statementRows.currentAssets, mode)}
            {renderEditableComparisonGroup('Long Term Assets', statementRows.longTermAssets, mode)}
            <div className="build-profile-net-worth-line build-profile-net-worth-total"><span>Total Assets</span><strong>{isVariance ? formatSignedVariance(assetsTotal) : formatVarianceCurrency(assetsTotal)}</strong></div>
          </section>
          <section className="build-profile-net-worth-column build-profile-net-worth-liabilities">
            <h5>Liabilities</h5>
            {renderEditableComparisonGroup('Current Liabilities', statementRows.currentLiabilities, mode)}
            {renderEditableComparisonGroup('Long Term Liabilities', statementRows.longTermLiabilities, mode)}
            <div className="build-profile-net-worth-line build-profile-net-worth-total"><span>Total Liabilities</span><strong>{isVariance ? formatSignedVariance(liabilitiesTotal) : formatVarianceCurrency(liabilitiesTotal)}</strong></div>
          </section>
          <div className="build-profile-net-worth-result"><span>Net Worth (Total Assets Less Total Liabilities)</span><strong>{isVariance ? formatSignedVariance(netWorth) : formatVarianceCurrency(netWorth)}</strong></div>
        </article>
      }

      return <div className="build-profile-step-content build-profile-step-ten">
        <h3>Step 10: Actual vs Desired / Target</h3>
        <p className="psychometric-section-note">The first column is Step 8 Actual / Current. The second column is Step 9 Desired / Target. Variance is Desired / Target less Actual / Current.</p>

        {targetRows.length > 0 ? <p className="psychometric-section-note">
          {completedActuals === targetRows.length
            ? 'Desired target completion: 100%. Actual versus target analysis is ready.'
            : `Desired target completion: ${completedActuals}/${targetRows.length} (${actualPercent}%). Complete Step 9 target values for full analysis.`}
        </p> : <p className="build-profile-applicability-note">No desired target is saved yet. Complete Step 9 and select Save Desired Target and Continue to Step 10.</p>}

        {targetRows.length > 0 ? <>
          <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-comparison-dropdown build-profile-comparison-input-dropdown">
            <summary>Actual / Current Net Worth vs Desired / Target</summary>
            <p className="psychometric-section-note"> </p>
            <div className="build-profile-comparison-grid">
              {renderEditableComparisonStatement('actual')}
              {renderEditableComparisonStatement('target')}
              {renderEditableComparisonStatement('variance')}
            </div>
          </details>
          <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-comparison-dropdown build-profile-variance-dropdown">
            <summary>Variance Filters - Detailed Lines</summary>
            <div className="build-profile-form-grid">
              <label>Statement Section<select aria-label="Actual vs Target filter by statement section" value={varianceSectionFilter} onChange={(event) => { setVarianceSectionFilter(event.target.value as 'all' | StatementSection); setVarianceCategoryFilter('all') }}><option value="all">All Sections</option>{STEP1_SECTION_ORDER.map((section) => <option key={section} value={section}>{STEP1_SECTION_SHORT_LABELS[section]}</option>)}</select></label>
              <label>Account Group<select aria-label="Actual vs Target filter by account group" value={varianceCategoryFilter} onChange={(event) => setVarianceCategoryFilter(event.target.value)}><option value="all">All Account Groups</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>Line Item<input type="search" aria-label="Actual vs Target filter by line item" placeholder="Search line item" value={varianceLineSearch} onChange={(event) => setVarianceLineSearch(event.target.value)} /></label>
              <div className="build-profile-filter-result"><span>Matching Rows</span><strong>{filteredRows.length}</strong><button type="button" className="loan-footer-button" onClick={() => { setVarianceSectionFilter('all'); setVarianceCategoryFilter('all'); setVarianceLineSearch('') }}>Clear Variance Filters</button></div>
            </div>

            <div className="psychometric-scale-table-wrap build-profile-target-table build-profile-variance-table">
              <table className="psychometric-scale-table">
              <thead><tr><th>Actual / Current (Step 8)</th><th>Desired / Target (Step 9)</th><th>Variance (Target less Actual)</th><th>Variance Explanation</th></tr></thead>
              <tbody>
                {filteredRows.map((entry) => {
                  const noteKey = `wealthVarianceNote.${entry.id}`
                  return <tr key={entry.id}>
                    <td data-label="Actual / Current (Step 8)"><strong>{entry.label}</strong><div>{STEP1_SECTION_SHORT_LABELS[entry.section]}</div><div>{entry.category}</div><div>{entry.hasActual ? formatVarianceCurrency(entry.actualAmount) : 'Pending actual'}</div></td>
                    <td data-label="Desired / Target (Step 9)"><NumericFormat aria-invalid={!entry.hasTarget} value={entry.rawTarget} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} placeholder="Enter desired target" aria-label={`${entry.label} target value`} onValueChange={({ value }) => updateDesiredWealthValue(entry.id, value)} /></td>
                    <td data-label="Variance (Target less Actual)">{entry.hasActual && entry.hasTarget ? formatSignedVariance(entry.variance) : 'Pending input'}</td>
                    <td data-label="Variance Explanation"><small className="build-profile-variance-copy">{entry.hasActual && entry.hasTarget ? (profile.values[noteKey]?.trim() || varianceExplanation(entry.section, entry.variance)) : 'Awaiting actual and target values.'}</small>{entry.hasActual && entry.hasTarget ? <input type="text" value={profile.values[noteKey] ?? ''} placeholder="Optional explanation" aria-label={`${entry.label} variance explanation`} onChange={(event) => updateValue(noteKey, event.target.value)} /> : null}</td>
                  </tr>
                })}
                {filteredRows.length === 0 ? <tr><td colSpan={4}>No matching saved target rows found. Adjust the Actual vs Target filters.</td></tr> : null}
              </tbody>
              </table>
              {targetRows.length > 0 ? <p className="psychometric-section-note">
                {completedActuals === targetRows.length
                  ? 'Desired target completion: 100%. Variance is calculated as target less actual.'
                  : `Desired target completion: ${completedActuals}/${targetRows.length} (${actualPercent}%). Complete missing Step 9 targets.`}
              </p> : <p className="build-profile-applicability-note">No desired target is saved yet. Complete Step 9 first.</p>}
            </div>
          </details>
          <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-comparison-dropdown">
            <summary>Actual / Current vs Desired / Target Personal Income and Expenses</summary>
            <p className="psychometric-section-note"></p>
            <div className="build-profile-comparison-grid">
              {renderFinancialComparisonStatement('actual')}
              {renderFinancialComparisonStatement('target')}
              {renderFinancialComparisonStatement('variance')}
            </div>
          </details>
          <details className="build-profile-detail-section build-profile-net-worth-statement build-profile-ai-analysis-dropdown">
            <summary>FILSCORE AI Analysis</summary>
            <div className="build-profile-ai-analysis-content">
              <p className="psychometric-section-note">
                {completedActuals === targetRows.length
                  ? 'AI analysis compares Step 8 Actual / Current values in the first column with Step 9 Desired / Target values in the second column.'
                  : `Preliminary analysis has ${completedActuals} of ${targetRows.length} desired target values (${actualPercent}%). Complete Step 9 for a full comparison.`}
              </p>
              <div className="build-profile-ai-analysis-metrics">
                <div><span>Step 8 Actual Assets</span><strong>{formatVarianceCurrency(actualScore.metrics.totalAssets)}</strong></div>
                <div><span>Step 8 Actual Liabilities</span><strong>{formatVarianceCurrency(actualScore.metrics.totalLiabilities)}</strong></div>
                <div><span>Step 8 Actual Net Worth</span><strong>{formatSignedVariance(actualScore.metrics.netWorth)}</strong></div>
                <div><span>Step 8 Actual Monthly Cash Flow</span><strong>{hasActualCashFlowInputs ? formatSignedVariance(actualScore.metrics.monthlyCashFlow) : 'Not available'}</strong></div>
                <div><span>Step 8 Actual Score</span><strong>{actualScore.score}</strong><small>{actualScore.grade} - {actualScore.rating}</small></div>
              </div>
              <div className="build-profile-ai-analysis-sections">
                <section>
                  <h5>Analysis</h5>
                  <ul>{[...actualNetWorthAdvisory.analysis.slice(0, 5), ...actualLeverageAdvisory.analysis].map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
                <section>
                  <h5>Recommendations</h5>
                  <ul>
                    <li>{actualNetWorthAdvisory.recommendation}</li>
                    <li>{actualLeverageAdvisory.recommendation}</li>
                    {!hasActualCashFlowInputs ? <li>Enter Step 8 actual monthly income and expense values to enable cash-flow, savings-rate, and emergency-reserve analysis.</li> : null}
                  </ul>
                </section>
              </div>
              <section className="build-profile-comparison-summary" aria-labelledby="comparison-summary-title">
                <h4 id="comparison-summary-title">Actual vs Desired / Target Summary and Recommendations</h4>
                <div className="build-profile-comparison-summary-grid">
                  {comparisonSummaries.map((summary) => <article key={summary.title} className="build-profile-comparison-summary-card">
                    <h5>{summary.title}</h5>
                    <dl>
                      <div><dt>Step 8 Actual / Current</dt><dd>{formatVarianceCurrency(summary.actual)}</dd></div>
                      <div><dt>Step 9 Desired / Target</dt><dd>{formatVarianceCurrency(summary.target)}</dd></div>
                      <div><dt>Variance: Target less Actual</dt><dd>{formatSignedVariance(summary.target - summary.actual)}</dd></div>
                    </dl>
                    <details>
                      <summary>Detailed Analysis and Recommendation</summary>
                      <div><strong>Analysis</strong><p>{summary.analysis}</p></div>
                      <div><strong>Recommendation</strong><p>{summary.recommendation}</p></div>
                    </details>
                  </article>)}
                </div>
              </section>
            </div>
          </details>
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
        <p className="psychometric-section-note">Use your completed profile to continue to both FILSCORE assessment areas. The Profile ID record is loaded and prepared automatically.</p>
        <p className="psychometric-section-note">
          {scorePreparationStatus === 'preparing'
            ? `Preparing ${scoreApplicationNo || 'selected profile'}...`
            : scorePreparationStatus === 'ready'
              ? scoreApplicationNo
                ? `${scoreApplicationNo} is ready for both score pages.`
                : `${profile.profileId} is ready. Credit Health will create a repository record when saved.`
              : scorePreparationStatus === 'error'
                ? 'Automatic preparation was not completed. Select a score button to retry.'
                : 'Waiting to prepare the selected profile.'}
        </p>
        <div className="build-profile-score-links">
          <article>
            <span>FILSCORE Assessment</span>
            <h4>Credit Health Score</h4>
            <p>Review credit readiness across credit, values, social, and verification indicators.</p>
            <button type="button" aria-busy={pendingScorePage === 'creditHealthScoreOpened' || scorePreparationStatus === 'preparing'} aria-invalid={profile.values.creditHealthScoreOpened !== 'true'} disabled={pendingScorePage !== null || scorePreparationStatus === 'preparing'} onClick={() => void openScorePage('creditHealthScoreOpened', '/lending-scorecard/filscore')}>
              {pendingScorePage === 'creditHealthScoreOpened' ? <><span className="build-profile-score-spinner" aria-hidden="true" />Opening Credit Health Score...</> : 'Open Credit Health Score'}
            </button>
          </article>
          <article>
            <span>FILSCORE Assessment</span>
            <h4>Wealth Building Score</h4>
            <p>Review net worth positioning, financial foundations, and wealth-building behavior.</p>
            <button type="button" aria-busy={pendingScorePage === 'wealthBuildingScoreOpened' || scorePreparationStatus === 'preparing'} aria-invalid={profile.values.wealthBuildingScoreOpened !== 'true'} disabled={pendingScorePage !== null || scorePreparationStatus === 'preparing'} onClick={() => void openScorePage('wealthBuildingScoreOpened', '/net-worth-positioning')}>
              {pendingScorePage === 'wealthBuildingScoreOpened' ? <><span className="build-profile-score-spinner" aria-hidden="true" />Opening Wealth Building Score...</> : 'Open Wealth Building Score'}
            </button>
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
      <div className="psychometric-hero-metric build-profile-completion" aria-label={`${completionPercent}% profile completion`}>
        <div className="build-profile-incomplete-activities">
          <span>Incomplete Activities</span>
          {incompleteActivities.length > 0 ? (
            <ul>
              {incompleteActivities.map((activity) => (
                <li key={activity.id}>
                  <div>
                    <span>{activity.id}. {activity.label}</span>
                    <small>{100 - stepCompletion[activity.id]}% remaining</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>All profile activities are complete.</p>
          )}
        </div>
        <div className="build-profile-completion-chart">
          <div
            className="build-profile-completion-ring"
            role="progressbar"
            aria-label="Profile completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionPercent}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <linearGradient id="build-profile-completion-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c9182b" />
                  <stop offset="48%" stopColor="#f7c600" />
                  <stop offset="100%" stopColor="#1261a0" />
                </linearGradient>
              </defs>
              <circle className="build-profile-completion-ring-track" cx="60" cy="60" r="49" />
              <circle
                className="build-profile-completion-ring-value"
                cx="60"
                cy="60"
                r="49"
                pathLength="100"
                strokeDasharray={`${completionPercent} 100`}
              />
            </svg>
            <div className="build-profile-completion-ring-label">
              <strong>{completionPercent}%</strong>
              <span>Complete</span>
            </div>
          </div>
          <small>Step {profile.step} of 12</small>
          <span>{currentStep.label}</span>
        </div>
      </div>
    </section>

    <section className="psychometric-summary-grid lending-psychometric-summary-grid">
      <SelectedProfileIdCard compactId label="Record ID" profileId={profile.profileId} name={profile.values.fullName} />
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
              <div className="build-profile-workflow-entry-row">
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
                <div className="build-profile-entry-modes" aria-label="Profile entry mode">
                  <button
                    type="button"
                    className={profileEntryMode === 'manual' ? 'build-profile-entry-mode-active' : undefined}
                    aria-label="Manual Entry"
                    aria-pressed={profileEntryMode === 'manual'}
                    onClick={() => setProfileEntryMode('manual')}
                  >Manual<br />Entry</button>
                  <button
                    type="button"
                    className={profileEntryMode === 'voice' ? 'build-profile-entry-mode-active' : undefined}
                    aria-label="Voice Guided Entry"
                    aria-pressed={profileEntryMode === 'voice'}
                    onClick={() => setProfileEntryMode('voice')}
                  >Voice Guided<br />Entry</button>
                </div>
              </div>
              {profileEntryMode === 'voice' ? <BuildProfileVoiceAssistant currentStep={profile.step} /> : null}
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

    {isLoadingProfile ? (
      <AuthProgressOverlay
        idPrefix="build-profile-loading"
        kicker="Profile records"
        title="Loading your profile"
        description={`Retrieving ${requestedApplicationNo} and preparing the saved record.`}
        footnote="Please keep this window open."
      />
    ) : scorePreparationStatus === 'preparing' || pendingScorePage !== null ? (
      <AuthProgressOverlay
        idPrefix="build-profile-computing"
        kicker="FILSCORE assessment"
        title={pendingScorePage === 'wealthBuildingScoreOpened' ? 'Computing Wealth Building Score' : 'Computing Credit Health Score'}
        description="Loading your profile data and preparing the latest assessment results."
        footnote="This may take a few moments."
      />
    ) : null}

  </div>
}
