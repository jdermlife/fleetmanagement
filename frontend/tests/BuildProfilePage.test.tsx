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

  it('formats monetary user inputs with thousands separators and two decimals', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Step 6: Goal Setting/ }))
    const requestedAmount = screen.getByLabelText('Requested Loan Amount') as HTMLInputElement
    await user.type(requestedAmount, '1234567.8')

    expect(requestedAmount.value).toBe('1,234,567.80')
    await waitFor(() => {
      const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
      expect(savedProfile.values.requestedAmount).toBe('1234567.80')
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

    let resolvePreparation!: (value: unknown) => void
    mockUpdateLoanApplication.mockImplementationOnce(() => new Promise((resolve) => { resolvePreparation = resolve }))
    await userEvent.click(screen.getByRole('button', { name: /Step 12: FILSCORE Score Links/ }))

    expect(await screen.findByText('Preparing APP-REVIEW-1...')).toBeTruthy()
    const creditButton = screen.getByRole('button', { name: 'Open Credit Health Score' })
    const wealthButton = screen.getByRole('button', { name: 'Open Wealth Building Score' })
    expect(creditButton.hasAttribute('disabled')).toBe(true)
    expect(wealthButton.hasAttribute('disabled')).toBe(true)
    resolvePreparation({ message: 'updated', application_no: 'APP-REVIEW-1' })

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
      expect(screen.getByText('APP-REVIEW-1 is ready for both score pages.')).toBeTruthy()
    })
    expect(mockUpdateLoanApplication).toHaveBeenCalledTimes(1)
    expect(mockRecomputeStoredScores).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Open Credit Health Score' }))
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/lending-scorecard/filscore?applicationNo=APP-REVIEW-1')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Open Wealth Building Score' }))
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/net-worth-positioning?applicationNo=APP-REVIEW-1')
    })
    expect(mockUpdateLoanApplication).toHaveBeenCalledTimes(1)
    expect(mockRecomputeStoredScores).not.toHaveBeenCalled()
  })

  it('selects the Financial Goal immediately after Profile ID', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    const goalDropdown = screen.getByRole('combobox', { name: 'Profile Financial Goal' })
    expect(goalDropdown).toBeTruthy()

    await user.selectOptions(goalDropdown, 'Build Emergency Fund')
    expect((goalDropdown as HTMLSelectElement).value).toBe('Build Emergency Fund')

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))
    expect((screen.getByRole('combobox', { name: 'Long Term Financial Goal' }) as HTMLSelectElement).value).toBe('Build Emergency Fund')
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
    expect(screen.getByRole('heading', { name: 'Step 9: Actuals' })).toBeTruthy()
    expect(screen.getByText('Actual Net Worth', { selector: 'strong' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Monthly Expense Allocation' })).toBeNull()

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
    await user.selectOptions(screen.getByRole('combobox', { name: 'Long Term Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('Target Amount'), '250000')
    await user.clear(screen.getByLabelText('Months to Achieve'))
    await user.type(screen.getByLabelText('Months to Achieve'), '18')
    await user.type(screen.getByLabelText('As Of'), '2026-07-27')
    await user.click(screen.getByRole('button', { name: /Targeted Goal/ }))
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    expect(screen.getByRole('status').textContent).toBe('Profile saved in this browser. Select or create a profile before FILSCORE computation.')
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

  it('excludes optional Step 3 fraud and social dates while requiring the profile attestation', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Source of Income & Wealth and Credit Values/ }))

    const optionalFields = [
      'Facebook Profile Date Opened',
      'Instagram Profile Date Opened',
      'X / Twitter Profile Date Opened',
      'TikTok Profile Date Opened',
      'LinkedIn Profile Date Opened',
      'Identity Theft Indicator',
    ]
    optionalFields.forEach((label) => expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('false'))
    for (const label of optionalFields.slice(0, 5)) await user.type(screen.getByLabelText(label), '2020-01-01')
    await user.click(screen.getByLabelText('Identity Theft Indicator'))
    expect(screen.getByRole('button', { name: /Step 3: Source of Income & Wealth and Credit Values, 0% information provided/ })).toBeTruthy()

    const attestation = screen.getByLabelText(/I confirm that my profile has no record of fraudulent events or acts/)
    expect(attestation.getAttribute('aria-invalid')).toBe('true')
    expect(attestation.closest('label')?.classList.contains('build-profile-checkbox-field-required')).toBe(true)
    await user.click(attestation)
    expect(attestation.getAttribute('aria-invalid')).toBe('false')
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
    const spouseEmploymentHeading = screen.getByRole('heading', { name: 'Spouse Employment Information' })
    const applicabilityHeading = screen.getByRole('heading', { name: 'Applicability' })
    expect(spouseEmploymentHeading.compareDocumentPosition(applicabilityHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByLabelText('Civil Status')).toBeNull()

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
    const historicalAssessmentHeading = screen.getByRole('heading', { name: 'Historical Assessment Information' })
    expect(historicalAssessmentHeading).toBeTruthy()
    expect(historicalAssessmentHeading.closest('section')?.classList.contains('build-profile-credit-values')).toBe(true)
    expect(screen.getByRole('combobox', { name: '1. In your recollection, how many times have you had a late payment?' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'No late payments' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '1–2 late payments (≤30 days)' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: '2. How many delinquencies or defaults have you had before?' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Current default / foreclosure / repossession' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: '3. What is your overall loan balance compared with your total approved credit?' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '4. What percentage of your credit limit are you utilizing? This is computed automatically.' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '0–2' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: '9. How many legal cases or collections do you have?' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: '12. Has that loan already been paid?' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Not yet paid' })).toBeTruthy()
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
    expect(screen.getByText('20.00% (Below 30%)')).toBeTruthy()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Deposit Regularity' }), 'Regular deposits')
    await user.selectOptions(screen.getByRole('combobox', { name: '1. In your recollection, how many times have you had a late payment?' }), 'No late payments')
    await user.selectOptions(screen.getByRole('combobox', { name: '2. How many delinquencies or defaults have you had before?' }), 'Current default / foreclosure / repossession')
    await user.selectOptions(screen.getByRole('combobox', { name: '3. What is your overall loan balance compared with your total approved credit?' }), 'Less than 20%')
    await user.selectOptions(screen.getByRole('combobox', { name: '12. Has that loan already been paid?' }), 'Not yet paid')
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
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))

    expect(screen.getByRole('heading', { name: 'Step 8: Wealth Position Base Setting' })).toBeTruthy()
    expect(screen.getByText('Before and after the Net Worth Statement, please assess your income standing versus in-country and global wealth index.')).toBeTruthy()
    const widComparatorLink = screen.getByRole('link', { name: 'Open WID Income Comparator in popout' })
    expect(widComparatorLink.getAttribute('href')).toBe('https://wid.world/income-comparator/')
    await user.click(widComparatorLink)
    expect(openSpy).toHaveBeenCalledWith(
      'https://wid.world/income-comparator/',
      'wid-income-comparator',
      'popup=yes,width=1200,height=850,resizable=yes,scrollbars=yes',
    )
    const financialGoal = screen.getByRole('combobox', { name: 'Long Term Financial Goal' })
    expect(financialGoal).toBeTruthy()
    expect(within(financialGoal).getByRole('option', { name: 'Reach First ₱10 Million' })).toBeTruthy()
    expect(screen.getByLabelText('Target Amount')).toBeTruthy()
    expect(screen.getByLabelText('Months to Achieve')).toBeTruthy()
    expect(screen.getByLabelText('As Of')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Statement currency' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'SGD (S$)' })).toBeTruthy()
    const detailedNetWorthDropdown = screen.getByText('Please Build and Assess Your Net Worth Here', { selector: 'strong' }).closest('details')
    expect(detailedNetWorthDropdown?.hasAttribute('open')).toBe(false)
    expect(detailedNetWorthDropdown?.querySelector('summary > strong')?.textContent).toBe('Please Build and Assess Your Net Worth Here')
    const statementFiltersDropdown = screen.getByText('Statement Filters - Details', { selector: 'summary' }).closest('details')
    expect(statementFiltersDropdown?.hasAttribute('open')).toBe(false)
    expect(statementFiltersDropdown!.compareDocumentPosition(detailedNetWorthDropdown!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    await user.click(screen.getByText('Please Build and Assess Your Net Worth Here', { selector: 'strong' }))
    const detailedCashInput = within(detailedNetWorthDropdown!).getByLabelText('Cash on Hand detailed net worth amount') as HTMLInputElement
    const detailedMortgageInput = within(detailedNetWorthDropdown!).getByLabelText('Home Mortgage detailed net worth amount') as HTMLInputElement
    expect(detailedCashInput.value).toBe('')
    expect(detailedMortgageInput.value).toBe('')
    await user.type(detailedCashInput, '50000')
    await user.type(detailedMortgageInput, '20000')
    expect(within(detailedNetWorthDropdown!).getByText('+₱30,000.00')).toBeTruthy()
    await user.clear(detailedCashInput)
    await user.clear(detailedMortgageInput)
    await user.click(screen.getByText('Statement Filters - Details', { selector: 'summary' }))
    expect(screen.getByLabelText('Cash on Hand setup amount')).toBeTruthy()
    expect(screen.queryByText('Net Worth', { selector: 'summary' })).toBeNull()
    const cashRemarks = screen.getByLabelText('Cash on Hand remarks') as HTMLInputElement
    await user.type(cashRemarks, 'Emergency cash reserve')
    expect(cashRemarks.value).toBe('Emergency cash reserve')
    const incomeExpenseDropdown = screen.getByText('Determine Your Personal Income and Expenses with Goals and Protection Here', { selector: 'summary' }).closest('details')
    expect(incomeExpenseDropdown?.hasAttribute('open')).toBe(false)
    expect(detailedNetWorthDropdown!.compareDocumentPosition(incomeExpenseDropdown!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(incomeExpenseDropdown!.compareDocumentPosition(statementFiltersDropdown!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.type(screen.getByLabelText('Target Amount'), '120000')
    await user.clear(screen.getByLabelText('Months to Achieve'))
    await user.type(screen.getByLabelText('Months to Achieve'), '12')
    expect(screen.getByText('₱10,000.00')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'liabilities')
    expect(screen.getByLabelText('Home Mortgage setup amount')).toBeTruthy()
    expect(screen.getByLabelText('Home Mortgage remarks')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-income')
    expect(screen.getByLabelText('Salary setup amount')).toBeTruthy()
    expect(screen.getByLabelText('Salary remarks')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-expenses')
    expect(screen.getByLabelText('Housing setup amount')).toBeTruthy()
    expect(screen.getByLabelText('Housing remarks')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'financial-goals')
    expect(screen.getByLabelText('Home Purchase setup amount')).toBeTruthy()
    expect(screen.getByLabelText('Home Purchase remarks')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'insurance-coverage')
    expect(screen.getByLabelText('Life Insurance setup amount')).toBeTruthy()
    expect(screen.getByLabelText('Life Insurance remarks')).toBeTruthy()
    await user.type(screen.getByLabelText('Life Insurance setup amount'), '5000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-income')
    await user.type(screen.getByLabelText('Salary setup amount'), '33000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-expenses')
    await user.type(screen.getByLabelText('Housing setup amount'), '18500')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'financial-goals')
    await user.type(screen.getByLabelText('Home Purchase setup amount'), '10000')
    await user.click(screen.getByText('Determine Your Personal Income and Expenses with Goals and Protection Here', { selector: 'summary' }))
    expect(incomeExpenseDropdown?.hasAttribute('open')).toBe(true)
    expect((within(incomeExpenseDropdown!).getByLabelText('Salary personal statement amount') as HTMLInputElement).value).toBe('33,000.00')
    expect((within(incomeExpenseDropdown!).getByLabelText('Housing personal statement amount') as HTMLInputElement).value).toBe('18,500.00')
    const otherIncomeInput = within(incomeExpenseDropdown!).getByLabelText('Other Income personal statement amount') as HTMLInputElement
    expect(otherIncomeInput.value).toBe('')
    expect((within(incomeExpenseDropdown!).getByLabelText('Home Purchase personal statement amount') as HTMLInputElement).value).toBe('10,000.00')
    expect((within(incomeExpenseDropdown!).getByLabelText('Life Insurance personal statement amount') as HTMLInputElement).value).toBe('5,000.00')
    expect(within(incomeExpenseDropdown!).getByText('+₱14,500.00')).toBeTruthy()
    await user.type(otherIncomeInput, '5000')
    expect(within(incomeExpenseDropdown!).getByText('+₱19,500.00')).toBeTruthy()
    await user.clear(otherIncomeInput)
    expect(within(incomeExpenseDropdown!.querySelector('.build-profile-income-expense-result.build-profile-income-expense-goals')!).getByText('₱10,000.00')).toBeTruthy()
    expect(within(incomeExpenseDropdown!.querySelector('.build-profile-income-expense-result.build-profile-income-expense-protection')!).getByText('₱5,000.00')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'ai-analysis')
    expect(screen.getByText('Overall Financial Wellness Rating')).toBeTruthy()
    const netWorthAiCard = screen.getByText('Net Worth', { selector: '.build-profile-ai-advisory-card > span' }).parentElement!
    expect(netWorthAiCard.getAttribute('tabindex')).toBe('0')
    expect(within(netWorthAiCard).getByRole('note', { name: 'Net Worth AI advisory' })).toBeTruthy()
    expect(within(netWorthAiCard).getByText('AI Recommendation')).toBeTruthy()
    expect(within(netWorthAiCard).getByText(/Previous-month data is not available/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }))
    await user.type(screen.getByLabelText('Filter by line item'), 'cryptocurrency')
    expect(screen.getByLabelText('Cryptocurrency setup amount')).toBeTruthy()
    expect(screen.getByText('1', { selector: '.build-profile-filter-result strong' })).toBeTruthy()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Long Term Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('As Of'), '2026-03-20')
    expect(screen.getByText('100% complete')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }))
    await user.type(screen.getByLabelText('Cash on Hand setup amount'), '50000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'liabilities')
    await user.type(screen.getByLabelText('Home Mortgage setup amount'), '20000')
    expect(screen.getByLabelText('Home Mortgage remarks')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.financialGoal).toBe('Build Emergency Fund')
    expect(savedProfile.values.asOfDate).toBe('2026-03-20')
    expect(savedProfile.values['asset-cash-on-hand']).toBe('50000.00')
    expect(savedProfile.values['wealthRemark.asset-cash-on-hand']).toBe('Emergency cash reserve')
  }, 20000)

  it('captures actual financial statements in Step 9', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Wealth Position Base Setting/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Long Term Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('As Of'), '2026-07-27')
    await user.type(screen.getByLabelText('Cash on Hand setup amount'), '50000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-income')
    await user.type(screen.getByLabelText('Salary setup amount'), '60000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'monthly-expenses')
    await user.type(screen.getByLabelText('Housing setup amount'), '30000')
    await user.type(screen.getByLabelText('Groceries setup amount'), '20000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'financial-goals')
    await user.type(screen.getByLabelText('Home Purchase setup amount'), '10000')
    await user.selectOptions(screen.getByLabelText('Filter by statement section'), 'insurance-coverage')
    await user.type(screen.getByLabelText('Life Insurance setup amount'), '5000')

    await user.click(screen.getByRole('button', { name: /Targeted Goal/ }))

    expect(screen.getByRole('heading', { name: 'Step 9: Actuals' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Targeted Goal Summary' })).toBeTruthy()
    expect(screen.getByText('Build Emergency Fund', { selector: '.build-profile-target-summary strong' })).toBeTruthy()
    expect(screen.getByText('6', { selector: '.build-profile-target-summary strong' })).toBeTruthy()
    const actualNetWorthDropdown = screen.getByText('Actual Net Worth', { selector: 'strong' }).closest('details')!
    const financialInvestmentDropdown = screen.getByText('Details of Financial Invesment', { selector: 'summary' }).closest('details')!
    const actualIncomeDropdown = screen.getByText('Actual Personal Income and Expense', { selector: 'summary' }).closest('details')!
    const actualFiltersDropdown = screen.getByText('Statement Filters - Details', { selector: 'summary' }).closest('details')!
    expect(actualNetWorthDropdown.hasAttribute('open')).toBe(false)
    expect(financialInvestmentDropdown.hasAttribute('open')).toBe(false)
    expect(actualNetWorthDropdown.compareDocumentPosition(financialInvestmentDropdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(financialInvestmentDropdown.compareDocumentPosition(actualIncomeDropdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(actualIncomeDropdown.hasAttribute('open')).toBe(false)
    expect(actualFiltersDropdown.hasAttribute('open')).toBe(false)
    expect(screen.queryByRole('heading', { name: 'Monthly Expense Allocation' })).toBeNull()
    expect(screen.queryByText('Setup Lines Review')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Normalize to 100%' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apply Revised % Allocation' })).toBeNull()

    await user.click(screen.getByText('Actual Net Worth', { selector: 'strong' }))
    await user.type(within(actualNetWorthDropdown).getByLabelText('Cash on Hand actual net worth amount'), '45000')
    expect(within(actualNetWorthDropdown.querySelector('.build-profile-net-worth-result')!).getByText('₱45,000.00')).toBeTruthy()
    await user.click(screen.getByText('Details of Financial Invesment', { selector: 'summary' }))
    await user.click(within(financialInvestmentDropdown).getByRole('button', { name: 'Add Financial Investment' }))
    await user.selectOptions(within(financialInvestmentDropdown).getByRole('combobox', { name: 'Investment 1 type' }), 'Equity (Stock)')
    expect(within(financialInvestmentDropdown).getByRole('option', { name: 'Bond' })).toBeTruthy()
    expect(within(financialInvestmentDropdown).getByRole('option', { name: 'Mutual Fund' })).toBeTruthy()
    expect(within(financialInvestmentDropdown).getByRole('option', { name: 'Alternative' })).toBeTruthy()
    expect(within(financialInvestmentDropdown).getByRole('option', { name: 'Others' })).toBeTruthy()
    await user.type(within(financialInvestmentDropdown).getByRole('textbox', { name: 'Investment 1 issuer or asset' }), 'Example Corporation')
    await user.type(within(financialInvestmentDropdown).getByRole('textbox', { name: 'Investment 1 original investment' }), '100000')
    await user.type(within(financialInvestmentDropdown).getByLabelText('Investment 1 date acquired'), '2026-01-15')
    await user.type(within(financialInvestmentDropdown).getByRole('textbox', { name: 'Investment 1 risk rating' }), 'Moderate')
    await user.click(screen.getByText('Actual Personal Income and Expense', { selector: 'summary' }))
    await user.type(within(actualIncomeDropdown).getByLabelText('Salary actual statement amount'), '65000')
    await user.type(within(actualIncomeDropdown).getByLabelText('Housing actual statement amount'), '25000')
    await user.type(within(actualIncomeDropdown).getByLabelText('Groceries actual statement amount'), '18000')
    await user.type(within(actualIncomeDropdown).getByLabelText('Home Purchase actual statement amount'), '12000')
    await user.type(within(actualIncomeDropdown).getByLabelText('Life Insurance actual statement amount'), '6000')

    await user.click(screen.getByText('Statement Filters - Details', { selector: 'summary' }))
    await user.selectOptions(screen.getByLabelText('Actual filter by statement section'), 'liabilities')
    expect(screen.getByLabelText('Home Mortgage actual amount')).toBeTruthy()
    expect(screen.getByLabelText('Home Mortgage actual remarks')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Actual filter by statement section'), 'ai-analysis')
    expect(screen.getByRole('note', { name: 'Net Worth actual AI advisory' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Save Actuals and Continue to Step 10' }))
    expect(screen.getByRole('heading', { name: 'Step 10: Actual vs Target' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))
    const savedInvestmentProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') || '{}')
    expect(savedInvestmentProfile.financialInvestments).toEqual([
      expect.objectContaining({
        investmentType: 'Equity (Stock)',
        issuerAsset: 'Example Corporation',
        originalInvestment: '100000.00',
        dateAcquired: '2026-01-15',
        riskRating: 'Moderate',
      }),
    ])
    const aiAnalysisDropdown = screen.getByText('FILSCORE AI Analysis', { selector: 'summary' }).closest('details')!
    const comparisonSummaryHeading = screen.getByRole('heading', { name: 'Target vs Actual Summary and Recommendations' })
    expect(aiAnalysisDropdown.hasAttribute('open')).toBe(false)
    expect(aiAnalysisDropdown.contains(comparisonSummaryHeading)).toBe(true)
    await user.click(screen.getByText('FILSCORE AI Analysis', { selector: 'summary' }))
    expect(aiAnalysisDropdown.hasAttribute('open')).toBe(true)
    expect(within(aiAnalysisDropdown).getByRole('heading', { name: 'Target vs Actual Summary and Recommendations' })).toBeTruthy()
    const summaryTitles = [
      '1. Target vs Actual Total Assets',
      '2. Target vs Actual Liabilities',
      '3. Target vs Actual Net Worth',
      '4. Target vs Actual Net Income/Loss',
      '5. Target vs Actual Goals and Protection',
    ]
    summaryTitles.forEach((title) => expect(within(aiAnalysisDropdown).getByRole('heading', { name: title })).toBeTruthy())
    const assetSummary = within(aiAnalysisDropdown).getByRole('heading', { name: '1. Target vs Actual Total Assets' }).closest('article')!
    expect(within(assetSummary).getByText('₱50,000.00')).toBeTruthy()
    expect(within(assetSummary).getByText('₱45,000.00')).toBeTruthy()
    expect(within(assetSummary).getByText('-₱5,000.00')).toBeTruthy()
    await user.click(within(assetSummary).getByText('Detailed Analysis and Recommendation', { selector: 'summary' }))
    expect(within(assetSummary).getByText('Analysis')).toBeTruthy()
    expect(within(assetSummary).getByText('Recommendation')).toBeTruthy()
    expect(within(assetSummary).getByText(/below the Step 8 target/)).toBeTruthy()
    const financialComparison = screen.getByText('Personal Income and Expense with Goals and Protection Target vs Actuals', { selector: 'summary' }).closest('details')!
    await user.click(screen.getByText('Personal Income and Expense with Goals and Protection Target vs Actuals', { selector: 'summary' }))
    const targetStatement = financialComparison.querySelector('.build-profile-comparison-target')!
    const actualStatement = financialComparison.querySelector('.build-profile-comparison-actual')!
    const varianceStatement = financialComparison.querySelector('.build-profile-comparison-variance')!
    expect(within(targetStatement).getByText('Step 8 Setup')).toBeTruthy()
    expect(within(actualStatement).getByText('Step 9 Setup')).toBeTruthy()
    expect(within(varianceStatement).getByText('Step 9 less Step 8')).toBeTruthy()
    expect(within(within(targetStatement).getByText('Salary').parentElement!).getByText('₱60,000.00')).toBeTruthy()
    expect(within(within(actualStatement).getByText('Salary').parentElement!).getByText('₱65,000.00')).toBeTruthy()
    expect(within(within(varianceStatement).getByText('Salary').parentElement!).getByText('+₱5,000.00')).toBeTruthy()
    expect(within(within(targetStatement).getByText('Net Income').parentElement!).getByText('₱10,000.00')).toBeTruthy()
    expect(within(within(actualStatement).getByText('Net Income').parentElement!).getByText('₱22,000.00')).toBeTruthy()
    expect(within(within(varianceStatement).getByText('Net Income').parentElement!).getByText('+₱12,000.00')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByText('100% complete')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.wealthSetupSaved).toBe('true')
    expect(savedProfile.values['wealthActual.asset-cash-on-hand']).toBe('45000.00')
    expect(savedProfile.values['wealthActual.expense-housing']).toBe('25000.00')
  }, 20000)

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
    await user.click(screen.getByRole('button', { name: 'Save Actuals and Continue to Step 10' }))

    expect(screen.getByRole('heading', { name: 'Step 10: Actual vs Target' })).toBeTruthy()
    expect(screen.getByText('Actual entry completion: 0/3 (0%). Missing actual values use target values in the projection.')).toBeTruthy()
    const varianceSummary = screen.getByText('Variance Filters - Detailed Lines', { selector: 'summary' })
    const varianceDropdown = varianceSummary.closest('details')!
    expect(varianceDropdown.hasAttribute('open')).toBe(false)
    await user.click(varianceSummary)
    expect(varianceDropdown.hasAttribute('open')).toBe(true)
    expect(screen.getByRole('columnheader', { name: 'Target (Saved)' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Actual (User Input)' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Variance' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Variance Explanation' })).toBeTruthy()
    expect(screen.getByLabelText('Cash on Hand actual value')).toBeTruthy()
    expect(screen.getAllByText('Pending input')).toHaveLength(3)

    const inputSummary = screen.getByText('Net Worth Target vs Actual Inputs', { selector: 'summary' })
    const inputDropdown = inputSummary.closest('details')!
    expect(inputDropdown.compareDocumentPosition(varianceDropdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(inputSummary)
    expect(inputDropdown.hasAttribute('open')).toBe(true)

    const cashTargetInput = within(inputDropdown).getByLabelText('Cash on Hand target input') as HTMLInputElement
    const cashActualInput = within(inputDropdown).getByLabelText('Cash on Hand actual input') as HTMLInputElement
    expect(cashTargetInput.value).toBe('50,000.00')
    expect(cashActualInput.value).toBe('')
    await user.clear(cashTargetInput)
    await user.type(cashTargetInput, '55000')
    await user.type(cashActualInput, '60000')
    expect(within(inputDropdown).getAllByText('+₱5,000.00').length).toBeGreaterThan(0)
    expect((screen.getByLabelText('Cash on Hand actual value') as HTMLInputElement).value).toBe('60,000.00')

    await user.clear(cashTargetInput)
    await user.type(cashTargetInput, '50000')
    await user.clear(cashActualInput)
    expect((screen.getByLabelText('Cash on Hand actual value') as HTMLInputElement).value).toBe('')

    await user.type(screen.getByLabelText('Cash on Hand actual value'), '60000')
    expect(screen.getAllByText('+₱10,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Value improved above setup and supports net worth').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Cash on Hand variance explanation').getAttribute('placeholder')).toBe('Optional explanation')
    expect(screen.getByLabelText('Cash on Hand variance explanation').getAttribute('aria-invalid')).toBeNull()

    await user.type(screen.getByLabelText('Home Mortgage actual value'), '90000')
    expect(screen.getAllByText('-₱10,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Liability is lower than setup and improves net worth').length).toBeGreaterThan(0)
    await user.type(screen.getByLabelText('Housing actual value'), '35000')
    expect(screen.getAllByText('+₱5,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Liability increased above setup and needs control').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Actual entry completion: 100%. Variance and net worth calculations are fully based on actual inputs.').length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByLabelText('Actual vs Target filter by statement section'), 'liabilities')
    expect(screen.queryByLabelText('Cash on Hand actual value')).toBeNull()
    expect(screen.getByLabelText('Home Mortgage actual value')).toBeTruthy()
    await user.type(screen.getByLabelText('Actual vs Target filter by line item'), 'mortgage')
    expect(screen.getByText('1', { selector: '.build-profile-filter-result strong' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear Variance Filters' }))

    expect(screen.getByText('100% complete')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))
    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values['wealthTarget.asset-cash-on-hand']).toBe('50000.00')
    expect(savedProfile.values['wealthActual.asset-cash-on-hand']).toBe('60000.00')
    expect(savedProfile.values['wealthVarianceNote.asset-cash-on-hand']).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Continue to Step 11' }))
    expect(screen.getByRole('heading', { name: 'Step 11: Suitability Assessment' })).toBeTruthy()
  }, 10000)

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
