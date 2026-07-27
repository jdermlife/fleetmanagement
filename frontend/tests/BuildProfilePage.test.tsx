import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchLoanApplication, mockNavigate, mockRecomputeStoredScores, mockSearchParams, mockUpdateLoanApplication } = vi.hoisted(() => ({
  mockFetchLoanApplication: vi.fn(),
  mockNavigate: vi.fn(),
  mockRecomputeStoredScores: vi.fn(),
  mockSearchParams: { value: '' },
  mockUpdateLoanApplication: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(mockSearchParams.value), vi.fn()],
  }
})

vi.mock('../src/api/loan', () => ({
  fetchLoanApplication: mockFetchLoanApplication,
  recomputeStoredLoanApplicationScores: mockRecomputeStoredScores,
  updateLoanApplication: mockUpdateLoanApplication,
}))

import BuildProfilePage from '../src/pages/scoring/BuildProfilePage'

describe('BuildProfilePage', () => {
  beforeEach(() => {
    mockFetchLoanApplication.mockReset()
    mockNavigate.mockReset()
    mockRecomputeStoredScores.mockReset()
    mockSearchParams.value = ''
    mockUpdateLoanApplication.mockReset()
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() { return values.size },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    })
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows the twelve-step profile workflow and initial profile state', () => {
    render(<BuildProfilePage />)

    expect(screen.getByRole('heading', { name: 'Create Profile' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Build your Profile' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Retrieve Existing Profile' })).toBeTruthy()
    expect(screen.getByText(/^PRO-[A-Z0-9]{6}$/)).toBeTruthy()
    expect(screen.getByLabelText('4% profile completion')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /information provided/ })).toHaveLength(12)
    expect(screen.getByRole('heading', { name: 'Step 1: Tell Us About Yourself' })).toBeTruthy()
  })

  it('collapses and expands the Build your Profile workflow menu', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    const summary = screen.getByText('Workflow Steps').closest('summary')
    const accordion = summary?.closest('details')

    expect(accordion?.hasAttribute('open')).toBe(true)
    expect(summary).toBeTruthy()

    await user.click(summary!)
    expect(accordion?.hasAttribute('open')).toBe(false)

    await user.click(summary!)
    expect(accordion?.hasAttribute('open')).toBe(true)
  })

  it('shows number-only workflow boxes with completion color states', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    const stepTwo = screen.getByRole('button', { name: /Step 2: Spouse and Dependents/ })
    expect(stepTwo.textContent).toBe('2')
    expect(stepTwo.classList.contains('build-profile-workflow-step-incomplete')).toBe(true)

    await user.type(screen.getByLabelText('Government ID Number'), 'ID-123')
    await user.type(screen.getByLabelText('Place of Birth'), 'Manila')
    await user.selectOptions(screen.getByLabelText('Gender'), 'Female')
    await user.type(screen.getByLabelText('Number of Dependents'), '0')
    await user.selectOptions(screen.getByLabelText('Civil Status'), 'Single')
    expect(stepTwo.classList.contains('build-profile-workflow-step-complete')).toBe(true)
  })

  it('marks inputs that prevent profile completion with an invalid state', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    const fullName = screen.getByLabelText('Full Name')
    const email = screen.getByLabelText('Email Address')
    expect(fullName.getAttribute('aria-invalid')).toBe('true')
    expect(email.getAttribute('aria-invalid')).toBe('true')

    await user.type(fullName, 'Jordan Santos')
    await user.type(email, 'not-an-email')
    expect(fullName.getAttribute('aria-invalid')).toBe('false')
    expect(email.getAttribute('aria-invalid')).toBe('true')

    await user.clear(email)
    await user.type(email, 'jordan@example.com')
    expect(email.getAttribute('aria-invalid')).toBe('false')
  })

  it('automatically publishes input changes for the other workflow forms', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.type(screen.getByLabelText('Full Name'), 'Jordan Santos')
    await waitFor(() => {
      const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
      expect(savedProfile.values.fullName).toBe('Jordan Santos')
      expect(savedProfile.updatedAt).toBeTruthy()
    })
  })

  it('provides the Lending Scorecard actions beside the workflow steps', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)
    const profileId = screen.getByText(/^PRO-[A-Z0-9]{6}$/).textContent

    await user.click(screen.getByRole('button', { name: 'Create New Record' }))
    expect(mockNavigate).toHaveBeenLastCalledWith(`/lending-scorecard?profileId=${profileId}`, {
      state: { scorecardAction: 'create-new' },
    })

    await user.click(screen.getByRole('button', { name: 'Review Record' }))
    expect(mockNavigate).toHaveBeenLastCalledWith('/loan-repository?status=All&origin=build-profile')

    await user.click(screen.getByRole('button', { name: 'Open FILSCORE Page' }))
    expect(mockNavigate).toHaveBeenLastCalledWith('/lending-scorecard', {
      state: { scorecardAction: 'open-filscore' },
    })

    await user.click(screen.getByRole('button', { name: 'Approval Queue' }))
    expect(mockNavigate).toHaveBeenLastCalledWith('/loan-repository?status=Credit%20Review')

    await user.click(screen.getByRole('button', { name: 'Released Accounts' }))
    expect(mockNavigate).toHaveBeenLastCalledWith('/loan-repository?status=Released')
  })

  it('loads a repository selection primarily into Build Profile', async () => {
    mockSearchParams.value = 'applicationNo=APP-REVIEW-1'
    mockFetchLoanApplication.mockResolvedValue({
      application_no: 'APP-REVIEW-1',
      borrower_name: 'Jordan Santos',
      email: 'jordan@example.com',
      phone: '09171234567',
      gov_id: 'GOV-123',
      address: 'Makati City',
      monthly_income: 75000,
      other_income: 5000,
      debt_obligations: 12000,
      product_type: 'Auto Loan',
      loan_amount: 800000,
      term_months: 48,
      interest_rate: 7.5,
      purpose: 'Family vehicle',
      appraised_value: 1000000,
      requirements: {
        buildProfile: {
          profileId: 'APP-REVIEW-1',
          step: 1,
          values: { financialGoal: 'Build Emergency Fund' },
          documents: ['income-proof.jpg'],
          suitabilityAnswers: { 'suitability-q1': 'To protect principal and preserve income.' },
          coBorrowers: [],
          guarantors: [{ id: 'GUARANTOR-1', name: 'Saved Guarantor' }],
          additionalCollaterals: [],
        },
        applicantPersonal: { dateOfBirth: '1990-01-02', age: 36, citizenship: 'Filipino', maritalStatus: 'Single', placeOfBirth: 'Manila', gender: 'Male', numberOfDependents: 1 },
        contactInformation: { emailAddress: 'jordan@example.com', mobileNumber: '09171234567', homePhoneNumber: '', mobileYearsUsed: '5', emailYearsUsed: '8' },
        governmentIds: { tin: 'TIN-1', sssGsisNumber: 'SSS-1', otherGovernmentId: 'Passport', idNumber: 'GOV-123', issueDate: '', expiryDate: '' },
        addressInformation: { presentAddress: 'Makati City', permanentAddress: 'Quezon City', mailingAddress: 'Makati City', lengthOfStay: '5 years' },
        otherInformation: { homeOwnership: 'Renting', educationalAttainment: 'College Degree', numberOfVehiclesOwned: 1, deviceVerified: true },
        employmentInformation: { employerBusinessName: 'Example Corp', grossMonthlyIncome: 75000, otherSourcesOfIncome: 5000, employmentStatus: 'Regular', employmentLocation: 'Locally Employed', employerBusinessYears: 10, officeAddress: '', occupation: '', position: '', natureOfWorkBusiness: '', dateHired: '', officePhoneNumber: '', previousEmployer: '', totalYearsWorking: '', monthlyLivingExpenses: 20000, investmentIncome: 0, businessIncome: 0, pensionIncome: 0 },
        bankingRelationships: {},
        enhancedDueDiligence: {},
        spouseInformation: { fullName: '', dateOfBirth: '', placeOfBirth: '', citizenship: '', mobileNumber: '', presentAddress: '', employerBusinessName: '', officeAddress: '', occupation: '', position: '', natureOfWork: '', yearsWithEmployer: '', previousEmployer: '', totalYearsWorking: '', grossMonthlyIncome: 0, monthlyExpenses: 0, otherIncomeSources: '' },
        coBorrowers: [],
        collateralAssetDetails: { securityClassification: 'Secured', assetType: 'Passenger Cars', maker: 'Toyota', brand: 'Toyota', model: 'Vios', year: '2025', vehicleConditionCategory: 'Brand New', vehicleTypeCategory: 'Passenger vehicle for personal use', motorcycleIntendedUse: '', useAsCollateral: true, insuranceProviderCompany: '', policyNumber: '', orNumber: '', crNumber: '', additionalCollaterals: [] },
        collateralInformation: { propertyAddress: '', registeredOwner: '', lotNumber: '', blockNumber: '', tctCctNumber: '', propertyMarketabilityCategory: '', houseUnitModelCategory: '', collateralOccupancyType: '', propertyAppraisedValue: 0 },
        fraudVerification: { faceMatchScore: 0, livenessDetection: '', incomeDocumentsStatus: '', employmentVerificationStatus: '', bankStatementVerificationStatus: '', payrollVerificationStatus: '', bankAccountOwnershipStatus: '' },
        documentAnalysis: { ocrAnalysisStatus: '' },
        psychometricAssessment: {},
      },
    })

    render(<BuildProfilePage />)

    expect(await screen.findByText('Profile APP-REVIEW-1 loaded.')).toBeTruthy()
    expect(screen.getByText('APP-REVIEW-1')).toBeTruthy()
    expect((screen.getByLabelText('Full Name') as HTMLInputElement).value).toBe('Jordan Santos')
    expect((screen.getByLabelText('Email Address') as HTMLInputElement).value).toBe('jordan@example.com')
    expect((screen.getByRole('combobox', { name: 'Profile Financial Goal' }) as HTMLSelectElement).value).toBe('Build Emergency Fund')
    expect(mockFetchLoanApplication).toHaveBeenCalledWith('APP-REVIEW-1')

    mockUpdateLoanApplication.mockResolvedValue({ message: 'updated' })
    mockRecomputeStoredScores.mockResolvedValue({ message: 'computed', quant_scores: {} })
    await userEvent.click(screen.getByRole('button', { name: /Step 12: FILSCORE Score Links/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Open Credit Health Score' }))

    await vi.waitFor(() => {
      expect(mockUpdateLoanApplication).toHaveBeenCalledWith(
        'APP-REVIEW-1',
        expect.objectContaining({
          application_no: 'APP-REVIEW-1',
          borrower_name: 'Jordan Santos',
          requirements: expect.objectContaining({
            buildProfile: expect.objectContaining({ profileId: 'APP-REVIEW-1' }),
          }),
        }),
      )
      expect(mockRecomputeStoredScores).toHaveBeenCalledWith('APP-REVIEW-1')
      expect(mockNavigate).toHaveBeenCalledWith('/lending-scorecard/filscore?applicationNo=APP-REVIEW-1')
    })
  })

  it('selects the Financial Goal immediately after Profile ID', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    const goalDropdown = screen.getByRole('combobox', { name: 'Profile Financial Goal' })
    expect(goalDropdown).toBeTruthy()

    await user.selectOptions(goalDropdown, 'Build Emergency Fund')
    expect((goalDropdown as HTMLSelectElement).value).toBe('Build Emergency Fund')

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))
    expect((screen.getByRole('combobox', { name: 'Financial Goal' }) as HTMLSelectElement).value).toBe('Build Emergency Fund')
  })

  it('navigates through source-derived lending and net worth steps', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    expect(screen.getByLabelText('Government ID Number')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Spouse and Dependents/ }))
    expect(screen.getByRole('heading', { name: 'Step 2: Spouse and Dependents' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Dependent' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Goal Setting/ }))
    expect(screen.getByLabelText('Financial Goal / Purpose')).toBeTruthy()
    expect(screen.getByLabelText('Product Being Applied For')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))
    expect(screen.getByRole('heading', { name: 'Personal Net Worth Statement' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Targeted Goal/ }))
    expect(screen.getByRole('heading', { name: 'Step 9: Targeted Goal' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Monthly Expense Allocation' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Suitability Assessment/ }))
    expect(screen.getByText('What is your key investment objective?')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(32)

    await user.click(screen.getByRole('button', { name: /FILSCORE Score Links/ }))
    expect(screen.getByRole('button', { name: 'Open Credit Health Score' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Wealth Building Score' })).toBeTruthy()
  })

  it('tracks step completion and persists profile values', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.type(screen.getByLabelText('Full Name'), 'Jordan Santos')
    await user.type(screen.getByLabelText('Email Address'), 'jordan@example.com')
    await user.type(screen.getByLabelText('Mobile Number'), '09171234567')
    await user.type(screen.getByLabelText('Date of Birth'), '1990-01-02')
    await user.type(screen.getByLabelText('Present Address'), 'Makati City')

    const expectedAge = new Date().getFullYear() - 1990 - (
      new Date().getMonth() + 1 < 1 || (new Date().getMonth() + 1 === 1 && new Date().getDate() < 2) ? 1 : 0
    )
    expect(screen.getByLabelText('Age').getAttribute('value')).toBe(String(expectedAge))
    expect(screen.getByLabelText('Age').getAttribute('readonly')).not.toBeNull()
    expect(screen.getByText('24% complete')).toBeTruthy()
    expect(screen.getByLabelText('6% profile completion')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('Target Amount'), '250000')
    await user.clear(screen.getByLabelText('Months to Achieve'))
    await user.type(screen.getByLabelText('Months to Achieve'), '18')
    await user.type(screen.getByLabelText('As Of'), '2026-07-27')
    await user.click(screen.getByRole('button', { name: /Targeted Goal/ }))
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    expect(screen.getByRole('status').textContent).toBe('Profile saved in this browser. Select or create a loan record before FILSCORE computation.')
    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.financialGoal).toBe('Build Emergency Fund')
    expect(savedProfile.step).toBe(9)
  })

  it('provides the requested Step 1 identity, address, and household fields', () => {
    render(<BuildProfilePage />)

    expect(screen.getByRole('combobox', { name: 'Citizenship' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Filipino' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Civil Status' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Single' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Married' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Divorced' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Legally Separated' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Widow' })).toBeNull()
    expect(screen.getByLabelText('Government ID Number')).toBeTruthy()
    expect(screen.getByLabelText('Place of Birth')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Gender' })).toBeTruthy()
    expect(screen.getByLabelText('Number of Dependents')).toBeTruthy()
    expect(screen.getByLabelText('Home Phone Number')).toBeTruthy()
    expect(screen.getByLabelText('TIN Number')).toBeTruthy()
    expect(screen.getByLabelText('SSS / GSIS Number')).toBeTruthy()
    expect(screen.getByLabelText('Other Government ID Type')).toBeTruthy()
    expect(screen.getByLabelText('Other Government ID Number')).toBeTruthy()
    expect(screen.getByLabelText('ID Issue Date')).toBeTruthy()
    expect(screen.getByLabelText('ID Expiry Date')).toBeTruthy()
    expect(screen.getByLabelText('Permanent Address')).toBeTruthy()
    expect(screen.getByLabelText('Mailing Address')).toBeTruthy()
    expect(screen.getByLabelText('Length of Stay at Present Address')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Home Ownership' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Living with Relative' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Educational Attainment' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'College Degree' })).toBeTruthy()
    expect(screen.getByLabelText('Number of Vehicles Owned')).toBeTruthy()
  })

  it('copies the complete Lending Scorecard source of income and Credit Values content into Step 3', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Source of Income & Wealth and Credit Values/ }))

    expect(screen.getByRole('heading', { name: 'Step 3: Source of Income & Wealth and Credit Values' })).toBeTruthy()
    expect(screen.getByLabelText('Employment History (Current Employer)')).toBeTruthy()
    expect(screen.getByLabelText('Nature of Work / Business')).toBeTruthy()
    expect(screen.getByLabelText('Investment Income')).toBeTruthy()
    expect(screen.getByLabelText('Employment Reference Person and Contact No.')).toBeTruthy()
    expect(screen.getByLabelText('Community Reputation')).toBeTruthy()
    expect(screen.getByLabelText('Consent for Open Banking Data Access')).toBeTruthy()
    expect(screen.getByLabelText('Face Match Score (%)')).toBeTruthy()
    expect(screen.getByLabelText('Watchlist Screening')).toBeTruthy()
    expect(screen.getByText('Completion: 0/50 questions answered.')).toBeTruthy()
    expect(screen.getAllByLabelText(/^\d+\. /)).toHaveLength(50)
  })

  it('provides spouse and repeatable dependent requirements in Step 2', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Civil Status' }), 'Married')
    await user.type(screen.getByLabelText('Number of Dependents'), '1')
    await user.click(screen.getByRole('button', { name: /Step 2: Spouse and Dependents/ }))

    expect(screen.getByRole('heading', { name: 'Step 2: Spouse and Dependents' })).toBeTruthy()
    expect(screen.getByLabelText('Spouse Full Name')).toBeTruthy()
    expect(screen.getByLabelText('Spouse Date of Birth')).toBeTruthy()
    expect(screen.getByLabelText('Spouse Place of Birth')).toBeTruthy()
    expect(screen.getByLabelText('Spouse Citizenship')).toBeTruthy()
    expect(screen.getByLabelText('Spouse Mobile Number')).toBeTruthy()
    expect(screen.getByLabelText('Spouse Present Address')).toBeTruthy()
    expect(screen.getByLabelText('Dependent 1 Full Name')).toBeTruthy()
    expect(screen.getByLabelText('Dependent 1 Date of Birth')).toBeTruthy()

    await user.type(screen.getByLabelText('Dependent 1 Full Name'), 'Jamie Santos')
    await user.type(screen.getByLabelText('Dependent 1 Date of Birth'), '2015-04-03')
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))
    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.dependents[0]).toMatchObject({ name: 'Jamie Santos', dateOfBirth: '2015-04-03' })
  })

  it('provides conditional spouse employment and repeatable co-borrower and guarantor requirements in Step 4', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Civil Status' }), 'Married')
    await user.click(screen.getByRole('button', { name: /Spouse Employment, Co-Borrower, and Guarantor Information/ }))

    expect(screen.getByRole('heading', { name: 'Step 4: Spouse Employment, Co-Borrower, and Guarantor Information (as applicable)' })).toBeTruthy()
    expect(screen.getByLabelText('Spouse Gross Monthly Income')).toBeTruthy()

    expect(screen.getByRole('button', { name: '+ Add a Co-Borrower' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '+ Add a Co-Borrower' }))
    expect(screen.getByLabelText('Co-Borrower 1 Full Name')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '+ Add a Co-Borrower' }))
    expect(screen.getByLabelText('Co-Borrower 2 Full Name')).toBeTruthy()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Guarantor' }), 'true')
    expect(screen.getByLabelText('Guarantor 1 Full Name')).toBeTruthy()
    expect(screen.getByLabelText('Guarantor 1 Employer / Business Name')).toBeTruthy()
    await user.type(screen.getByLabelText('Guarantor 1 Full Name'), 'Alex Guarantor')
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.coBorrowers).toHaveLength(2)
    expect(savedProfile.guarantors[0].name).toBe('Alex Guarantor')
  })

  it('copies the complete Lending Scorecard banking relationships content into Step 5', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Banking Relationships/ }))

    expect(screen.getByRole('heading', { name: 'Step 5: Banking Relationships' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Existing Credit Card Information' })).toBeTruthy()
    expect(screen.getByLabelText('Card Issuer')).toBeTruthy()
    expect(screen.getByLabelText('Card Number')).toBeTruthy()
    expect(screen.getByLabelText('Member Since')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Existing Bank Account Information' })).toBeTruthy()
    expect(screen.getByLabelText('Account Number')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Existing Loan Information' })).toBeTruthy()
    expect(screen.getByLabelText('Current Loan Balance')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Credit Bureau Records' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '1. In your recollection, how many times have you made a late payment on any loan or credit card?' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'No late payments' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '2. Have you ever had a delinquent or defaulted loan?' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Current default / foreclosure / repossession' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '3. Approximately what percentage of your approved credit is currently outstanding?' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '4. Credit utilization calculated from Total Credit Limit and Current Outstanding Balance' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '12. Has that loan already been paid?' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Not yet paid' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Enhanced Due Diligence & Declarations' })).toBeTruthy()
    expect(screen.getByLabelText('Previous Lenders and Existing Loan Accounts')).toBeTruthy()
    expect(screen.getByLabelText('Number of Active Loans')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Declaration of Previously with Unpaid Loan or Credit Card' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'No previous borrowing' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Deposit / Current Account Handling' })).toBeTruthy()
    expect(screen.getByLabelText('Self-Declared Investment Portfolio')).toBeTruthy()

    await user.type(screen.getByLabelText('Bank / Branch'), 'Makati Main Branch')
    await user.type(screen.getByLabelText('Account Number'), '1234567890')
    await user.type(screen.getByLabelText('Credit Limit'), '100000')
    await user.type(screen.getByLabelText('Outstanding Balance'), '20000')
    expect(screen.getByText('20.00%')).toBeTruthy()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Deposit Regularity' }), 'Regular deposits')
    await user.click(screen.getByRole('radio', { name: 'No late payments' }))
    await user.click(screen.getByRole('radio', { name: 'Current default / foreclosure / repossession' }))
    await user.click(screen.getByRole('radio', { name: 'Less than 20%' }))
    await user.click(screen.getByRole('radio', { name: 'Not yet paid' }))
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.bankBranch).toBe('Makati Main Branch')
    expect(savedProfile.values.accountNumber).toBe('1234567890')
    expect(savedProfile.values.depositRegularity).toBe('Regular deposits')
    expect(savedProfile.values.creditBureauLatePaymentFrequency).toBe('No late payments')
    expect(savedProfile.values.creditBureauDelinquencyDefaultHistory).toBe('Current default / foreclosure / repossession')
    expect(savedProfile.values.creditBureauOverallBalanceRatio).toBe('Less than 20%')
    expect(savedProfile.values.creditBureauLoanPaidStatus).toBe('Not yet paid')
  })

  it('copies all Lending Scorecard Step 1 requirements into Build Profile Step 6', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Goal Setting/ }))

    expect(screen.getByRole('heading', { name: 'Step 6: Goal Setting' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Product Information' })).toBeTruthy()
    expect(screen.getByLabelText('Financial Goal / Purpose')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Product Being Applied For' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Home Loan' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Margin Loan' })).toBeTruthy()
    expect(screen.getByLabelText('Requested Loan Amount')).toBeTruthy()
    expect(screen.getByLabelText('Loan Term (Months)')).toBeTruthy()
    expect(screen.getByLabelText('Annual Interest Rate (%)')).toBeTruthy()
    expect(screen.getByText('Est. Monthly Amortization')).toBeTruthy()
    expect(screen.getByText('Loan-to-Value Ratio (LTV)')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Step 1 Review Capture' })).toBeNull()
    expect(screen.getByText('Take a picture of a valid ID for inclusion and fasten profile review.')).toBeTruthy()

    await user.type(screen.getByLabelText('Financial Goal / Purpose'), 'Purchase a family home')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product Being Applied For' }), 'Home Loan')
    await user.type(screen.getByLabelText('Requested Loan Amount'), '1200000')
    expect(screen.getByLabelText('Requested Loan Amount')).toHaveProperty('value', '1,200,000.00')
    await user.type(screen.getByLabelText('Loan Term (Months)'), '120')
    await user.type(screen.getByLabelText('Annual Interest Rate (%)'), '7')
    expect(screen.getByText('100% complete')).toBeTruthy()
    const amortization = screen.getByText('Est. Monthly Amortization').parentElement
    expect(amortization?.textContent).toMatch(/13,\d{3}\.\d{2}/)
    expect(amortization?.textContent).not.toContain('₱')

    const idCapture = new File(['id-image'], 'valid-id.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText(/Take Picture of ID/), idCapture)
    expect(screen.getByText('valid-id.jpg')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.loanPurpose).toBe('Purchase a family home')
    expect(savedProfile.values.productType).toBe('Home Loan')
    expect(savedProfile.values.requestedAmount).toBe('1200000.00')
    expect(savedProfile.documents).toContain('valid-id.jpg')
  })

  it('copies Lending Step 6 product-based collateral requirements into Build Profile Step 7', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Goal Setting/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product Being Applied For' }), 'Auto Loan')
    await user.click(screen.getByRole('button', { name: /Collateral Assets \(based on Goal and Product Requested\)/ }))

    expect(screen.getByRole('heading', { name: 'Step 7: Collateral Assets (based on Goal and Product Requested).' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Security Classification' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Secured' })).toBeTruthy()
    expect(screen.getByText(/Auto Loan - Mandatory/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Asset / Vehicle Information' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'SUVs & Crossovers' })).toBeTruthy()
    expect(screen.getByLabelText('Vehicle Age / Condition')).toBeTruthy()
    expect(screen.getByLabelText('Insurance Provider / Company')).toBeTruthy()
    expect(screen.getByLabelText('OR Number')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Add Collateral' }))
    expect(screen.getByLabelText('Additional Collateral 1 Property Type')).toBeTruthy()
    expect(screen.getByLabelText('Additional Collateral 1 TCT / CTC Number')).toBeTruthy()
    await user.type(screen.getByLabelText('Additional Collateral 1 Type'), 'Equipment')
    await user.type(screen.getByLabelText('Additional Collateral 1 Appraised Value'), '250000')
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.productType).toBe('Auto Loan')
    expect(savedProfile.additionalCollaterals[0].collateralType).toBe('Equipment')
    expect(savedProfile.additionalCollaterals[0].appraisedValue).toBe('250000')
  })

  it('switches Step 7 between home and motorcycle collateral forms', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Goal Setting/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product Being Applied For' }), 'Home Loan')
    await user.click(screen.getByRole('button', { name: /Collateral Assets \(based on Goal and Product Requested\)/ }))
    expect(screen.getByRole('heading', { name: 'Home Loan / Property Information' })).toBeTruthy()
    expect(screen.getByLabelText('Property Address')).toBeTruthy()
    expect(screen.getByLabelText('TCT/CCT Number')).toBeTruthy()
    expect(screen.getByLabelText('Property Appraised Value')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Goal Setting/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product Being Applied For' }), 'Motorcycle Loan')
    await user.click(screen.getByRole('button', { name: /Collateral Assets \(based on Goal and Product Requested\)/ }))
    expect(screen.getByRole('heading', { name: 'Motorcycle Information' })).toBeTruthy()
    expect(screen.getByLabelText('Motorcycle Value')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Intended Use' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'To be used as collateral' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Not to be used as collateral' })).toBeTruthy()
  })

  it('copies Net Worth Positioning Step 1 into Wealth Position Base Setting', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))

    expect(screen.getByRole('heading', { name: 'Step 8: Wealth Position Base Setting' })).toBeTruthy()
    const financialGoal = screen.getByRole('combobox', { name: 'Financial Goal' })
    expect(financialGoal).toBeTruthy()
    expect(within(financialGoal).getByRole('option', { name: 'Reach First ₱10 Million' })).toBeTruthy()
    expect(screen.getByLabelText('Target Amount')).toBeTruthy()
    expect(screen.getByLabelText('Months to Achieve')).toBeTruthy()
    expect(screen.getByLabelText('As Of')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Statement currency' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'SGD (S$)' })).toBeTruthy()
    expect(screen.getByLabelText('Cash on Hand setup amount')).toBeTruthy()

    await user.type(screen.getByLabelText('Target Amount'), '120000')
    await user.clear(screen.getByLabelText('Months to Achieve'))
    await user.type(screen.getByLabelText('Months to Achieve'), '12')
    expect(screen.getByText('₱10,000.00')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'liabilities')
    expect(screen.getByLabelText('Home Mortgage setup amount')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-income')
    expect(screen.getByLabelText('Salary setup amount')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-expenses')
    expect(screen.getByLabelText('Housing setup amount')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'financial-goals')
    expect(screen.getByLabelText('Home Purchase setup amount')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'insurance-coverage')
    expect(screen.getByLabelText('Life Insurance setup amount')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'ai-analysis')
    expect(screen.getByText('Overall Financial Wellness Rating')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }))
    await user.type(screen.getByLabelText('Filter by line item'), 'cryptocurrency')
    expect(screen.getByLabelText('Cryptocurrency setup amount')).toBeTruthy()
    expect(screen.getByText('1', { selector: '.build-profile-filter-result strong' })).toBeTruthy()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('As Of'), '2026-03-20')
    expect(screen.getByText('100% complete')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }))
    await user.type(screen.getByLabelText('Cash on Hand setup amount'), '50000')
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.financialGoal).toBe('Build Emergency Fund')
    expect(savedProfile.values.asOfDate).toBe('2026-03-20')
    expect(savedProfile.values['asset-cash-on-hand']).toBe('50000')
  })

  it('copies Net Worth Positioning Step 2 into Targeted Goal', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('As Of'), '2026-07-27')
    await user.type(screen.getByLabelText('Cash on Hand setup amount'), '50000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-expenses')
    await user.type(screen.getByLabelText('Housing setup amount'), '30000')
    await user.type(screen.getByLabelText('Groceries setup amount'), '20000')

    await user.click(screen.getByRole('button', { name: /Targeted Goal/ }))

    expect(screen.getByRole('heading', { name: 'Step 9: Targeted Goal' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Targeted Goal Summary' })).toBeTruthy()
    expect(screen.getByText('Build Emergency Fund', { selector: '.build-profile-target-summary strong' })).toBeTruthy()
    expect(screen.getByText('3', { selector: '.build-profile-target-summary strong' })).toBeTruthy()
    expect(screen.getByLabelText('Housing allocation percentage').getAttribute('value')).toBe('60.00')
    expect(screen.getByLabelText('Groceries allocation percentage').getAttribute('value')).toBe('40.00')
    expect(screen.getByText('Balanced')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Show Setup Lines Review' }))
    expect(screen.getByText('Cash on Hand', { selector: 'td[data-label="Line Item"]' })).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Targeted Goal filter by statement section'), 'monthly-expenses')
    expect(screen.queryByText('Cash on Hand', { selector: 'td[data-label="Line Item"]' })).toBeNull()
    expect(screen.getByText('Housing', { selector: 'td[data-label="Line Item"]' })).toBeTruthy()
    await user.type(screen.getByLabelText('Targeted Goal filter by line item'), 'groceries')
    expect(screen.queryByText('Housing', { selector: 'td[data-label="Line Item"]' })).toBeNull()
    expect(screen.getByText('Groceries', { selector: 'td[data-label="Line Item"]' })).toBeTruthy()

    await user.clear(screen.getByLabelText('Housing allocation percentage'))
    await user.type(screen.getByLabelText('Housing allocation percentage'), '70')
    expect(screen.getByText('Needs Reconciliation')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Normalize to 100%' }))
    expect(Number(screen.getByLabelText('Housing allocation percentage').getAttribute('value'))).toBeCloseTo(63.64, 2)
    expect(Number(screen.getByLabelText('Groceries allocation percentage').getAttribute('value'))).toBeCloseTo(36.36, 2)

    await user.click(screen.getByRole('button', { name: 'Apply Revised % Allocation' }))
    await user.click(screen.getByRole('button', { name: 'Save Setup and Continue to Step 10' }))
    expect(screen.getByRole('heading', { name: 'Step 10: Actual vs Target' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByText('100% complete')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.wealthSetupSaved).toBe('true')
    expect(savedProfile.values['wealthAllocation.expense-housing']).toBe('63.64')
    expect(savedProfile.values['expense-housing']).toBe('31820.00')
  })

  it('copies Net Worth Positioning Step 4 into Actual vs Target', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))
    await user.type(screen.getByLabelText('As Of'), '2026-07-27')
    await user.type(screen.getByLabelText('Cash on Hand setup amount'), '50000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'liabilities')
    await user.type(screen.getByLabelText('Home Mortgage setup amount'), '100000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-expenses')
    await user.type(screen.getByLabelText('Housing setup amount'), '30000')

    await user.click(screen.getByRole('button', { name: /Targeted Goal/ }))
    await user.click(screen.getByRole('button', { name: 'Save Setup and Continue to Step 10' }))

    expect(screen.getByRole('heading', { name: 'Step 10: Actual vs Target' })).toBeTruthy()
    expect(screen.getByText('Actual entry completion: 0/3 (0%). Missing actual values use target values in the projection.')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Target (Saved)' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Actual (User Input)' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Variance' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Variance Explanation' })).toBeTruthy()
    expect(screen.getByLabelText('Cash on Hand actual value')).toBeTruthy()
    expect(screen.getAllByText('Pending input')).toHaveLength(3)

    await user.type(screen.getByLabelText('Cash on Hand actual value'), '60000')
    expect(screen.getByText('+₱10,000.00')).toBeTruthy()
    expect(screen.getByText('Value improved above setup and supports net worth')).toBeTruthy()
    await user.type(screen.getByLabelText('Cash on Hand variance explanation'), 'Cash reserve exceeded target')
    expect(screen.getByText('Cash reserve exceeded target')).toBeTruthy()

    await user.type(screen.getByLabelText('Home Mortgage actual value'), '90000')
    expect(screen.getByText('-₱10,000.00')).toBeTruthy()
    expect(screen.getByText('Liability is lower than setup and improves net worth')).toBeTruthy()
    await user.type(screen.getByLabelText('Housing actual value'), '35000')
    expect(screen.getByText('+₱5,000.00')).toBeTruthy()
    expect(screen.getByText('Liability increased above setup and needs control')).toBeTruthy()
    expect(screen.getByText('Actual entry completion: 100%. Variance and net worth calculations are fully based on actual inputs.')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Actual vs Target filter by statement section'), 'liabilities')
    expect(screen.queryByLabelText('Cash on Hand actual value')).toBeNull()
    expect(screen.getByLabelText('Home Mortgage actual value')).toBeTruthy()
    await user.type(screen.getByLabelText('Actual vs Target filter by line item'), 'mortgage')
    expect(screen.getByText('1', { selector: '.build-profile-filter-result strong' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear Variance Filters' }))

    expect(screen.getByText('87% complete')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))
    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values['wealthTarget.asset-cash-on-hand']).toBe('50000')
    expect(savedProfile.values['wealthActual.asset-cash-on-hand']).toBe('60000')
    expect(savedProfile.values['wealthVarianceNote.asset-cash-on-hand']).toBe('Cash reserve exceeded target')

    await user.click(screen.getByRole('button', { name: 'Continue to Step 11' }))
    expect(screen.getByRole('heading', { name: 'Step 11: Suitability Assessment' })).toBeTruthy()
  })

  it('copies Net Worth Positioning Step 3 Suitability Assessment into Step 11', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Suitability Assessment/ }))

    expect(screen.getByRole('heading', { name: 'Step 11: Suitability Assessment' })).toBeTruthy()
    expect(screen.getByText('Completion: 0/8 questions answered.')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(32)
    expect(screen.getByText('What portion of your investments can be placed for long-term growth (1 to 3 years)?')).toBeTruthy()
    expect(screen.getByText('Do you have regular liquidity requirements?')).toBeTruthy()
    expect(screen.getByText('Which investments have you previously owned or are currently invested in?')).toBeTruthy()
    expect(screen.getByText('How many years of investment experience do you have through a fund manager?')).toBeTruthy()
    expect(screen.getByText('What is your tolerance for risk?')).toBeTruthy()
    expect(screen.getByText('If your investments decline by 30% in one year, what would you do?')).toBeTruthy()
    expect(screen.getByText('What is your average net worth over the last 2 years?')).toBeTruthy()
    expect(screen.getByText('To grow aggressively for significant capital appreciation.')).toBeTruthy()
    expect(screen.getByText('More than 80% up to 100%')).toBeTruthy()
    expect(screen.getByText('Over PHP 60 million')).toBeTruthy()

    expect(screen.getByText('Risk Averse')).toBeTruthy()
    expect(screen.getByText('Conservative')).toBeTruthy()
    expect(screen.getByText('Moderate')).toBeTruthy()
    expect(screen.getByText('Aggressive')).toBeTruthy()
    expect(screen.getByText('Savings / Time Deposits')).toBeTruthy()
    expect(screen.getByText('Fixed Income and Savings Bonds')).toBeTruthy()
    expect(screen.getByText('Income Deposits, Government and Corporate Bonds, and Top-Tier Equities')).toBeTruthy()
    expect(screen.getByText('Fixed Income, Equities, and High Yield Securities')).toBeTruthy()

    for (const question of [
      'What is your key investment objective?',
      'What portion of your investments can be placed for long-term growth (1 to 3 years)?',
      'Do you have regular liquidity requirements?',
      'Which investments have you previously owned or are currently invested in?',
      'How many years of investment experience do you have through a fund manager?',
      'What is your tolerance for risk?',
      'If your investments decline by 30% in one year, what would you do?',
      'What is your average net worth over the last 2 years?',
    ]) {
      await user.click(screen.getByRole('radio', { name: `${question} option 4` }))
    }

    expect(screen.getByText('Completion: 8/8 questions answered.')).toBeTruthy()
    expect(screen.getByText('32', { selector: '.build-profile-suitability-summary strong' })).toBeTruthy()
    expect(screen.getByText('Aggressive', { selector: '.build-profile-suitability-summary strong' })).toBeTruthy()
    expect(screen.getByText('Client accepts higher volatility and capital risk for stronger long-term growth.', { selector: '.build-profile-suitability-summary small' })).toBeTruthy()
    expect(screen.getByText('Fixed Income, Equities, and High Yield Securities', { selector: '.build-profile-suitability-summary small' })).toBeTruthy()
    expect(screen.getByText('100% complete')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Save Profile' }))
    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.suitabilityAnswers['suitability-q1']).toBe('4')
    expect(savedProfile.suitabilityAnswers['suitability-q8']).toBe('4')

    await user.click(screen.getByRole('button', { name: 'Continue to Step 12' }))
    expect(screen.getByRole('heading', { name: 'Step 12: FILSCORE Credit Health and Wealth Building Score Links' })).toBeTruthy()
  })
})
