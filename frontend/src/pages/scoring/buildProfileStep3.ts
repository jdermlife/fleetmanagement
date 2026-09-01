export type Step3Field = {
  key: string
  label: string
  type?: 'checkbox' | 'date' | 'number' | 'select' | 'tel' | 'text' | 'textarea'
  options?: string[]
  readOnly?: boolean
  mustBeChecked?: boolean
  yesNoChoice?: boolean
  countsTowardCompletion?: boolean
}

export type Step3Section = {
  title: string
  note?: string
  fields: Step3Field[]
}

export type CreditValuesSection = {
  id: string
  title: string
  questions: Array<{ field: string; prompt: string; options: string[] }>
}

export const STEP_3_SECTIONS: Step3Section[] = [
  {
    title: 'Employment and Income  - Borrower',
    fields: [
      { key: 'employmentHistory', label: 'Employment History (Current Employer) (Demo Data Accepted)' },
      { key: 'monthlyIncome', label: 'Primary Monthly Income', type: 'number' },
      { key: 'otherIncome', label: 'Other Sources of Income', type: 'number' },
      { key: 'debtObligations', label: 'Existing Monthly Debt Obligations', type: 'number' },
    ],
  },
  {
    title: 'Employment and Income  - Spouse',
    fields: [
      { key: 'employmentHistory', label: 'Employment History (Current Employer) (Demo Data Accepted)' },
      { key: 'monthlyIncome', label: 'Primary Monthly Income', type: 'number' },
      { key: 'otherIncome', label: 'Other Sources of Income', type: 'number' },
      { key: 'debtObligations', label: 'Existing Monthly Debt Obligations', type: 'number' },
    ],


  },


  {
    title: 'Detailed Employment Information-Borrower',
    fields: [
      { key: 'employmentStatus', label: 'Employment Status', type: 'select', options: ['Regular', 'Contractual', 'Project-Basis', 'Consulting', 'Part-time'] },
      { key: 'employerName', label: 'Employer / Business Name (Optional)' },
      { key: 'officeAddress', label: 'Office Address (Optional)' },
      { key: 'occupation', label: 'Occupation (Optional)' },
      { key: 'position', label: 'Position (Optional)' },
      { key: 'natureOfWorkBusiness', label: 'Nature of Work / Business' },
      { key: 'dateHired', label: 'Date Hired', type: 'date' },
      { key: 'officePhoneNumber', label: 'Office Phone Number (Optional)', type: 'tel' },
      { key: 'previousEmployer', label: 'Previous Employer (Optional)' },
      { key: 'totalYearsWorking', label: 'Total Years Working' },
      { key: 'grossMonthlyIncome', label: 'Gross Monthly Income (Auto-calculated)', type: 'number', readOnly: true },
      { key: 'monthlyExpenses', label: 'Monthly Living Expenses', type: 'number' },
      { key: 'otherSourcesOfIncome', label: 'Other Sources of Income', type: 'number' },
      { key: 'investmentIncome', label: 'Investment Income', type: 'number' },
      { key: 'businessIncome', label: 'Business Income', type: 'number' },
      { key: 'pensionIncome', label: 'Pension Income', type: 'number' },
    ],
  },
  {
    title: 'Employment, Income, and Residence Verification',
    fields: [
      { key: 'employmentLocation', label: 'Employment Location(Optional)', type: 'select', options: ['Locally Employed', 'Not Locally Employed'] },
      { key: 'employerBusinessYears', label: 'Years in Business of Employer', type: 'number' },
      { key: 'mobileYearsUsed', label: 'Mobile Number Years in Use (Optional)' },
      { key: 'emailYearsUsed', label: 'Email Address Years in Use (Optional)' },
      { key: 'employmentReferencePerson', label: 'Employment Reference Person and Contact No.(Optional)', type: 'textarea' },
      { key: 'hrContactInformation', label: 'HR Contact Information and Contact No.(Optional)', type: 'textarea' },
      { key: 'supervisorInformation', label: 'Supervisor Information and Contact No.(Optional)', type: 'textarea' },
      { key: 'sourceOfIncomeVerificationReferences', label: 'Source of Income Verification and Contact No.(Optional)', type: 'textarea' },
      { key: 'lengthOfResidenceConfirmation', label: 'Length of Residence Confirmation', type: 'textarea' },
      { key: 'utilityAccountReferences', label: 'Utility Account References (Optional)', type: 'textarea' },
      { key: 'deviceVerified', label: 'Device Verified / Registered', type: 'checkbox' },
    ],
  },
  {
    title: 'References, Declarations, and Professional Profile',
    fields: [
      { key: 'lifestyleIndicator', label: 'Lifestyle', type: 'select', options: ['Respectable lifestyle (no gambling, drinking, etc.)', 'Signs of adverse characteristics'] },
      { key: 'secondaryIncomeProfile', label: 'Secondary Source of Income', type: 'select', options: ['Multiple stable income sources', 'One additional regular income source', 'Occasional additional income', 'No secondary income'] },
      { key: 'characterReferences', label: 'Character References and CONTACT NUMBERS (Optional)', type: 'textarea' },
      { key: 'guarantorReferences', label: 'Guarantor References and CONTACT NUMBERS (Optional)', type: 'textarea' },
      { key: 'coBorrowerReferences', label: 'Co-Borrower References and CONTACT NUMBERS (Optional)', type: 'textarea' },
      { key: 'referencesFromEmployerOrCommunity', label: 'References from Employer or Community and CONTACT NUMBERS (Optional)', type: 'textarea' },
      { key: 'communityReputation', label: 'Community Reputation', type: 'select', options: ['Excellent references', 'Good references', 'Average', 'Limited information', 'Adverse information'] },
      { key: 'professionalOrganizationMemberships', label: 'Professional Organization Memberships', type: 'textarea' },
      { key: 'professionalLicenses', label: 'Professional Licenses', type: 'textarea' },
      { key: 'additionalPropertyDeclarations', label: 'Additional Property Declarations' },
      { key: 'additionalVehicleDeclarations', label: 'Financial Investments' },
      { key: 'communityInvolvementInformation', label: 'Community Involvement Information', type: 'textarea' },
      { key: 'facebookProfile', label: 'Facebook Profile Links' },
      { key: 'facebookProfileDateOpened', label: 'Facebook Profile Date Opened', type: 'date', countsTowardCompletion: false },
      { key: 'instagramProfile', label: 'Instagram Profile Links' },
      { key: 'instagramProfileDateOpened', label: 'Instagram Profile Date Opened', type: 'date', countsTowardCompletion: false },
      { key: 'xProfile', label: 'X / Twitter Profile Links' },
      { key: 'xProfileDateOpened', label: 'X / Twitter Profile Date Opened', type: 'date', countsTowardCompletion: false },
      { key: 'tikTokProfile', label: 'TikTok Profile Links' },
      { key: 'tikTokProfileDateOpened', label: 'TikTok Profile Date Opened', type: 'date', countsTowardCompletion: false },
      { key: 'linkedInProfile', label: 'LinkedIn Profile Links' },
      { key: 'linkedInProfileDateOpened', label: 'LinkedIn Profile Date Opened', type: 'date', countsTowardCompletion: false },
      { key: 'otherSocialMediaLinks', label: 'Other Social Media Links', type: 'textarea' },
      { key: 'businessWebsite', label: 'Business Website (If Self-Employed / Optional)' },
    ],
  },
  {
    title: 'Verification Consents',
    fields: [
      { key: 'consentOpenBankingDataAccess', label: 'Consent for Open Banking Data Access', type: 'checkbox' },
      { key: 'consentEmploymentVerification', label: 'Consent for Employment Verification', type: 'checkbox' },
      { key: 'consentIdentityVerification', label: 'Consent for Identity Verification', type: 'checkbox' },
    ],
  },
  {
    title: 'Identity Verification',
    note: 'Fraud Verification & Override Checks',
    fields: [
      { key: 'faceMatchScore', label: 'Face Match Score (%)', type: 'number' },
      { key: 'livenessDetection', label: 'Liveness Detection', type: 'select', options: ['Passed', 'Manual review', 'Failed'] },
    ],
  },
  {
    title: 'Document Verification',
    fields: [
      { key: 'incomeDocumentsStatus', label: 'Income Documents', type: 'select', options: ['Verified', 'Minor discrepancies', 'Suspicious'] },
      { key: 'employmentVerificationStatus', label: 'Employment Verification', type: 'select', options: ['Verified', 'Partially verified', 'Cannot verify'] },
      { key: 'bankStatementVerificationStatus', label: 'Bank Statement Verification', type: 'select', options: ['Matches application', 'Minor variance', 'Significant inconsistency'] },
      { key: 'ocrAnalysisStatus', label: 'OCR & AI Document Analysis', type: 'select', options: ['No signs of tampering', 'Minor anomalies', 'Suspected alteration'] },
    ],
  },
  {
    title: 'Financial & Banking Verification',
    fields: [
      { key: 'payrollVerificationStatus', label: 'Payroll Verification', type: 'select', options: ['Verified', 'Partial', 'None'] },
      { key: 'bankAccountOwnershipStatus', label: 'Bank Account Ownership', type: 'select', options: ['Verified', 'Manual verification', 'Failed'] },
    ],
  },
  {
    title: 'Device & Digital Risk',
    fields: [
      { key: 'deviceReputation', label: 'Device Reputation', type: 'select', options: ['Trusted', 'Unknown', 'Blacklisted'] },
      { key: 'ipAddressRisk', label: 'IP Address Risk', type: 'select', options: ['Normal', 'VPN/Proxy', 'High-risk'] },
      { key: 'deviceConsistency', label: 'Device Consistency', type: 'select', options: ['Same device', 'Multiple trusted devices', 'Multiple unknown devices'] },
    ],
  },
  {
    title: 'Fraud Intelligence & Hard Stops',
    fields: [
      { key: 'watchlistStatus', label: 'Watchlist Screening', type: 'select', options: ['Clear', 'Manual review', 'Positive match'] },
      { key: 'previousFraudRecords', label: 'Previous Fraud Records', type: 'select', options: ['None', 'Minor alerts', 'Confirmed fraud'] },
      { key: 'applicationVelocity', label: 'Application Velocity', type: 'select', options: ['Normal', 'Multiple recent applications', 'Excessive activity'] },
      { key: 'fakeNationalId', label: 'Fake National ID', type: 'checkbox', yesNoChoice: true },
      { key: 'forgedPayslip', label: 'Forged Payslip', type: 'checkbox', yesNoChoice: true },
      { key: 'forgedBankStatement', label: 'Forged Bank Statement', type: 'checkbox', yesNoChoice: true },
      { key: 'identityTheftIndicator', label: 'Identity Theft Indicator', type: 'checkbox', yesNoChoice: true, countsTowardCompletion: false },
      { key: 'sanctionsPepMatch', label: 'Sanctions / PEP Match', type: 'checkbox', yesNoChoice: true },
      {
        key: 'fraudAndDocumentAuthenticityAttestation',
        label: 'I confirm that my profile has no record of fraudulent events or acts and that all documents I have provided are authentic. I am fully aware that otherwise, the credit health measurement results may be inaccurate.',
        type: 'checkbox',
        yesNoChoice: true,
      },
    ],
  },
]

export const CREDIT_VALUES_SECTIONS: CreditValuesSection[] = [
  { id: 'A', title: 'Budgeting & Planning', questions: [
    { field: 'q01', prompt: 'How far ahead do you plan your finances?', options: ['1 month', '2 months', '3 months', '4 months', '5+ months'] },
    { field: 'q02', prompt: 'When preparing a budget, how often do you update it?', options: ['Weekly', 'Monthly', 'Quarterly', 'Annually', 'Never'] },
    { field: 'q03', prompt: 'If you receive extra income, how do you handle it?', options: ['Add to savings', 'Allocate to bills', 'Partial savings/spending', 'Spend immediately', 'No plan'] },
    { field: 'q04', prompt: 'How often do you track your expenses?', options: ['Daily', 'Weekly', 'Monthly', 'Occasionally', 'Never'] },
    { field: 'q05', prompt: 'When setting financial goals, how far ahead do you plan?', options: ['1 year', '2-3 years', '4-5 years', '6-10 years', 'No goals'] },
  ] },
  { id: 'B', title: 'Emergency Fund & Savings', questions: [
    { field: 'q06', prompt: 'If you lost your income today, how long could your emergency fund cover expenses?', options: ['1 month', '2-3 months', '4-6 months', '7-12 months', 'More than 12 months'] },
    { field: 'q07', prompt: 'How often do you deposit into your emergency fund?', options: ['Monthly', 'Quarterly', 'Annually', 'Occasionally', 'Never'] },
    { field: 'q08', prompt: 'When faced with a major purchase, how do you prepare?', options: ['Save fully', 'Save most', 'Save partly', 'Borrow mostly', 'Buy immediately on credit'] },
    { field: 'q09', prompt: 'How quickly can you cover unexpected expenses without borrowing?', options: ['Immediately', 'Within 1 month', 'Within 2-3 months', 'Within 6 months', 'Cannot without borrowing'] },
    { field: 'q10', prompt: 'How often do you review your savings progress?', options: ['Monthly', 'Quarterly', 'Annually', 'Occasionally', 'Never'] },
  ] },
  { id: 'C', title: 'Loan Repayment Discipline', questions: [
    { field: 'q11', prompt: 'If you anticipate difficulty repaying a loan, when do you inform your lender?', options: ['Immediately', '1 month before', '2 months before', 'After missing payment', 'Never'] },
    { field: 'q12', prompt: 'How often do you pay loans before the due date?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q13', prompt: 'If faced with financial stress, how do you prioritize loan repayment?', options: ['Cut expenses first', 'Adjust savings', 'Delay purchases', 'Delay bills', 'Miss loan payment'] },
    { field: 'q14', prompt: 'How important is maintaining a good credit reputation to you?', options: ['Extremely', 'Very', 'Moderate', 'Slight', 'Not important'] },
    { field: 'q15', prompt: 'When repaying loans, how consistent are you?', options: ['Always on time', 'Mostly on time', 'Occasionally late', 'Frequently late', 'Never on time'] },
  ] },
  { id: 'D', title: 'Risk Awareness', questions: [
    { field: 'q16', prompt: 'When offered a high-risk investment, how do you respond?', options: ['Decline immediately', 'Decline after evaluation', 'Invest small portion', 'Invest large portion', 'Invest fully'] },
    { field: 'q17', prompt: 'How carefully do you read loan agreements before signing?', options: ['Every detail', 'Key sections', 'Skim', 'Glance quickly', 'Never read'] },
    { field: 'q18', prompt: 'How often do you avoid risks you do not understand?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q19', prompt: 'Before making commitments, how often do you consider worst-case scenarios?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q20', prompt: 'Do you prefer stable finances or risky opportunities?', options: ['Strongly prefer stability', 'Prefer stability', 'Neutral', 'Prefer risk', 'Strongly prefer risk'] },
  ] },
  { id: 'E', title: 'Integrity & Honesty', questions: [
    { field: 'q21', prompt: 'When completing financial applications, how accurate is your information?', options: ['Always accurate', 'Mostly accurate', 'Sometimes inaccurate', 'Frequently inaccurate', 'Never accurate'] },
    { field: 'q22', prompt: 'Would you hide important financial information from a lender?', options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'] },
    { field: 'q23', prompt: 'Is honesty more important than getting a loan quickly?', options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'] },
    { field: 'q24', prompt: 'When you make financial mistakes, how do you respond?', options: ['Correct immediately', 'Correct soon', 'Correct occasionally', 'Rarely correct', 'Never correct'] },
    { field: 'q25', prompt: 'Do you believe financial commitments should always be honored?', options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'] },
  ] },
  { id: 'F', title: 'Resilience & Adaptability', questions: [
    { field: 'q26', prompt: 'If your income decreases by 20%, how quickly do you adjust spending?', options: ['Within 1 week', 'Within 1 month', 'Within 2 months', 'Within 3 months', 'Never adjust'] },
    { field: 'q27', prompt: 'When facing financial challenges, how calm do you remain?', options: ['Always calm', 'Often calm', 'Sometimes calm', 'Rarely calm', 'Never calm'] },
    { field: 'q28', prompt: 'When facing problems, how often do you look for solutions instead of avoiding them?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q29', prompt: 'Before making difficult financial decisions, how often do you seek advice?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q30', prompt: 'Do you believe you can recover from financial setbacks?', options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'] },
  ] },
  { id: 'G', title: 'Social Responsibility', questions: [
    { field: 'q31', prompt: 'How consistently do you support your family within your means?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q32', prompt: 'How consistently do you fulfill responsibilities to dependents?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q33', prompt: 'How important is maintaining a good reputation in your community?', options: ['Extremely', 'Very', 'Moderate', 'Slight', 'Not important'] },
    { field: 'q34', prompt: 'How often do you avoid actions that could damage your financial credibility?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q35', prompt: 'Do you believe financial responsibility is a core personal value?', options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'] },
  ] },
  { id: 'H', title: 'Self-Control & Impulse Management', questions: [
    { field: 'q36', prompt: 'When you see something you want to buy, how long do you wait before purchasing?', options: ['5+ days', '2-3 days', '1 day', 'Same day', 'Immediately'] },
    { field: 'q37', prompt: 'How often do you avoid impulse purchases?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q38', prompt: 'How often can you delay gratification for long-term goals?', options: ['Always (12+ months)', 'Often (6-12 months)', 'Sometimes (3-6 months)', 'Rarely (<3 months)', 'Never'] },
    { field: 'q39', prompt: 'When pressured to spend beyond budget, how do you respond?', options: ['Always resist', 'Often resist', 'Sometimes resist', 'Rarely resist', 'Never resist'] },
    { field: 'q40', prompt: 'How clearly do you distinguish between wants and needs?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
  ] },
  { id: 'I', title: 'Employment & Career Mindset', questions: [
    { field: 'q41', prompt: 'How often do you improve your professional skills?', options: ['Every year', 'Every 2-3 years', 'Occasionally', 'Rarely', 'Never'] },
    { field: 'q42', prompt: 'How important is long-term employment stability to you?', options: ['Extremely', 'Very', 'Moderate', 'Slight', 'Not important'] },
    { field: 'q43', prompt: 'How actively do you plan your career growth?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q44', prompt: 'How consistently do you maintain good relationships with employers/clients?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    { field: 'q45', prompt: 'How strongly do you strive to maintain a reliable source of income?', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
  ] },
  { id: 'J', title: 'Additional Situational Discipline', questions: [
    { field: 'q46', prompt: 'If you receive a salary increase, how do you allocate it?', options: ['Save fully', 'Save most', 'Split save/spend', 'Spend mostly', 'Spend all'] },
    { field: 'q47', prompt: 'If you lose your job, how quickly do you seek new income?', options: ['Immediately', 'Within 1 month', 'Within 2-3 months', 'Within 6 months', 'No plan'] },
    { field: 'q48', prompt: 'When offered a loan, how carefully do you compare lenders?', options: ['Always compare thoroughly', 'Often compare', 'Sometimes compare', 'Rarely compare', 'Never compare'] },
    { field: 'q49', prompt: 'If you face multiple bills, how do you prioritize payments?', options: ['Pay essentials first', 'Pay loans first', 'Pay savings first', 'Pay lifestyle first', 'No prioritization'] },
    { field: 'q50', prompt: 'When setting financial goals, how often do you review progress?', options: ['Monthly', 'Quarterly', 'Annually', 'Occasionally', 'Never'] },
  ] },
]

export const STEP_3_FIELDS = STEP_3_SECTIONS.flatMap((section) => section.fields)
export const CREDIT_VALUES_QUESTIONS = CREDIT_VALUES_SECTIONS.flatMap((section) => section.questions)
