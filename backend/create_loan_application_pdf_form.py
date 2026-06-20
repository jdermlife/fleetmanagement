from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.acroform import AcroForm
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_MARGIN = 40
RIGHT_MARGIN = 40
TOP_MARGIN = 42
BOTTOM_MARGIN = 42
LINE_GAP = 20
FIELD_HEIGHT = 18
MULTILINE_FLAG = 4096


def draw_header(pdf: canvas.Canvas, page_title: str) -> float:
    pdf.setFillColor(colors.HexColor("#0F172A"))
    pdf.rect(0, PAGE_HEIGHT - 80, PAGE_WIDTH, 80, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 26)
    pdf.drawString(LEFT_MARGIN, PAGE_HEIGHT - 42, "BestBank Loan Application Form")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(
        LEFT_MARGIN,
        PAGE_HEIGHT - 60,
        "Consolidated intake worksheet aligned to the Lending Scorecard workflow.",
    )
    pdf.setFillColor(colors.HexColor("#B8860B"))
    pdf.rect(0, PAGE_HEIGHT - 84, PAGE_WIDTH, 4, fill=1, stroke=0)
    pdf.setFillColor(colors.HexColor("#1E293B"))
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(LEFT_MARGIN, PAGE_HEIGHT - 108, page_title)
    return PAGE_HEIGHT - 128


def draw_footer(pdf: canvas.Canvas, page_number: int) -> None:
    pdf.setStrokeColor(colors.HexColor("#CBD5E1"))
    pdf.line(LEFT_MARGIN, 28, PAGE_WIDTH - RIGHT_MARGIN, 28)
    pdf.setFillColor(colors.HexColor("#475569"))
    pdf.setFont("Helvetica", 9)
    pdf.drawString(LEFT_MARGIN, 16, "BestBank Car Financing Company")
    pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, 16, f"Page {page_number}")


def ensure_room(pdf: canvas.Canvas, y: float, needed: float, page_number: int, title: str) -> tuple[float, int]:
    if y - needed >= BOTTOM_MARGIN:
        return y, page_number

    draw_footer(pdf, page_number)
    pdf.showPage()
    page_number += 1
    return draw_header(pdf, title), page_number


def section_title(pdf: canvas.Canvas, y: float, text: str) -> float:
    pdf.setFillColor(colors.HexColor("#0F172A"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(LEFT_MARGIN, y, text)
    pdf.setStrokeColor(colors.HexColor("#D4A017"))
    pdf.line(LEFT_MARGIN, y - 6, PAGE_WIDTH - RIGHT_MARGIN, y - 6)
    return y - 20


def add_text_field(
    pdf: canvas.Canvas,
    form: AcroForm,
    *,
    y: float,
    name: str,
    label: str,
    x: float = LEFT_MARGIN,
    width: float = 250,
    height: float = FIELD_HEIGHT,
    multiline: bool = False,
    value: str = "",
) -> float:
    pdf.setFillColor(colors.HexColor("#334155"))
    pdf.setFont("Helvetica", 9)
    pdf.drawString(x, y + 4, label)
    form.textfield(
        name=name,
        tooltip=label,
        x=x,
        y=y - height - 2,
        width=width,
        height=height,
        borderStyle="inset",
        borderColor=colors.HexColor("#94A3B8"),
        fillColor=colors.white,
        textColor=colors.HexColor("#0F172A"),
        forceBorder=True,
        value=value,
        fontName="Helvetica",
        fontSize=9,
        fieldFlags=MULTILINE_FLAG if multiline else 0,
    )
    return y - height - 14


def add_checkbox(
    pdf: canvas.Canvas,
    form: AcroForm,
    *,
    y: float,
    name: str,
    label: str,
    x: float = LEFT_MARGIN,
) -> float:
    pdf.setFillColor(colors.HexColor("#334155"))
    pdf.setFont("Helvetica", 9)
    form.checkbox(
        name=name,
        tooltip=label,
        x=x,
        y=y - 8,
        buttonStyle="check",
        borderColor=colors.HexColor("#64748B"),
        fillColor=colors.white,
        textColor=colors.HexColor("#0F172A"),
        forceBorder=True,
        size=12,
    )
    pdf.drawString(x + 18, y - 1, label)
    return y - 20


def draw_two_column_fields(
    pdf: canvas.Canvas,
    form: AcroForm,
    y: float,
    fields: list[tuple[str, str]],
    page_number: int,
    page_title: str,
) -> tuple[float, int]:
    left_x = LEFT_MARGIN
    right_x = PAGE_WIDTH / 2 + 10
    column_width = (PAGE_WIDTH / 2) - LEFT_MARGIN - 18

    for index in range(0, len(fields), 2):
        y, page_number = ensure_room(pdf, y, 46, page_number, page_title)
        left_name, left_label = fields[index]
        y_left = add_text_field(
            pdf,
            form,
            y=y,
            name=left_name,
            label=left_label,
            x=left_x,
            width=column_width,
        )
        y_right = y_left

        if index + 1 < len(fields):
            right_name, right_label = fields[index + 1]
            y_right = add_text_field(
                pdf,
                form,
                y=y,
                name=right_name,
                label=right_label,
                x=right_x,
                width=column_width,
            )

        y = min(y_left, y_right) - 4

    return y, page_number


def build_pdf(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output_path), pagesize=letter)
    form = pdf.acroForm
    page_number = 1
    page_title = "Application Intake"
    y = draw_header(pdf, page_title)

    y = section_title(pdf, y, "1. Product Selection")
    y, page_number = draw_two_column_fields(
        pdf,
        form,
        y,
        [
            ("product_type", "Product Being Applied For"),
            ("loan_purpose", "Purpose of Loan"),
            ("loan_amount", "Requested Loan Amount (PHP)"),
            ("term_months", "Loan Term (Months)"),
            ("interest_rate", "Annual Interest Rate (%)"),
            ("application_no", "Application Number (Optional)"),
        ],
        page_number,
        page_title,
    )

    y = section_title(pdf, y, "2. Applicant Information")
    y, page_number = draw_two_column_fields(
        pdf,
        form,
        y,
        [
            ("borrower_full_name", "Full Legal Name"),
            ("borrower_email", "Email Address"),
            ("borrower_phone", "Contact Number"),
            ("borrower_gov_id", "Government ID Number"),
            ("last_name", "Last Name"),
            ("first_name", "First Name"),
            ("middle_name", "Middle Name"),
            ("date_of_birth", "Date of Birth"),
            ("place_of_birth", "Place of Birth"),
            ("age", "Age"),
            ("gender", "Gender"),
            ("citizenship", "Citizenship"),
            ("number_of_dependents", "Number of Dependents"),
            ("marital_status", "Marital Status"),
            ("mothers_maiden_name", "Mother's Maiden Name"),
            ("tin", "TIN"),
            ("sss_gsis_number", "SSS / GSIS Number"),
            ("other_government_id", "Other Government ID"),
            ("id_issue_date", "ID Issue Date"),
            ("id_expiry_date", "ID Expiry Date"),
        ],
        page_number,
        page_title,
    )
    y, page_number = ensure_room(pdf, y, 90, page_number, page_title)
    y = add_text_field(
        pdf,
        form,
        y=y,
        name="borrower_address",
        label="Complete Residential Address",
        width=PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN,
        height=54,
        multiline=True,
    ) - 6

    y = section_title(pdf, y, "3. Address, Employment, and Income")
    y, page_number = draw_two_column_fields(
        pdf,
        form,
        y,
        [
            ("present_address", "Present Address"),
            ("permanent_address", "Permanent Address"),
            ("mailing_address", "Mailing Address"),
            ("length_of_stay", "Length of Stay"),
            ("home_ownership", "Home Ownership"),
            ("educational_attainment", "Educational Attainment"),
            ("vehicles_owned_count", "Number of Vehicles Owned"),
            ("employment_status", "Employment Status"),
            ("employer_business_name", "Employer / Business Name"),
            ("office_address", "Office Address"),
            ("occupation", "Occupation"),
            ("position", "Position"),
            ("nature_of_work", "Nature of Work / Business"),
            ("date_hired", "Date Hired"),
            ("office_phone_number", "Office Phone Number"),
            ("previous_employer", "Previous Employer"),
            ("total_years_working", "Total Years Working"),
            ("primary_monthly_income", "Primary Monthly Income (PHP)"),
            ("other_income", "Other Sources of Income (PHP)"),
            ("debt_obligations", "Existing Monthly Debt Obligations (PHP)"),
            ("gross_monthly_income", "Gross Monthly Income (PHP)"),
            ("monthly_living_expenses", "Monthly Living Expenses (PHP)"),
            ("other_sources_of_income", "Other Sources of Income (PHP)"),
            ("investment_income", "Investment Income (PHP)"),
            ("business_income", "Business Income (PHP)"),
            ("pension_income", "Pension Income (PHP)"),
        ],
        page_number,
        page_title,
    )

    y = section_title(pdf, y, "4. Co-Borrower, Banking, and Collateral")
    y, page_number = draw_two_column_fields(
        pdf,
        form,
        y,
        [
            ("co_borrower_name", "Co-Borrower Full Name"),
            ("co_borrower_relationship", "Co-Borrower Relationship"),
            ("co_borrower_monthly_income", "Co-Borrower Monthly Income (PHP)"),
            ("co_borrower_debt_obligations", "Co-Borrower Debt Obligations (PHP)"),
            ("co_borrower_credit_standing", "Co-Borrower Credit Standing"),
            ("spouse_full_name", "Spouse / Co-Borrower Full Name"),
            ("credit_card_issuer", "Credit Card Issuer"),
            ("credit_card_number", "Credit Card Number"),
            ("credit_limit", "Credit Limit (PHP)"),
            ("outstanding_balance", "Outstanding Balance (PHP)"),
            ("member_since", "Member Since"),
            ("bank_branch", "Bank / Branch"),
            ("account_type", "Account Type"),
            ("account_number", "Account Number"),
            ("current_balance", "Current Balance (PHP)"),
            ("loan_lender", "Previous Lender / Bank"),
            ("loan_type", "Loan Type"),
            ("loan_current_balance", "Current Loan Balance (PHP)"),
            ("loan_monthly_amortization", "Monthly Loan Amortization (PHP)"),
            ("vehicle_info", "Asset / Vehicle Information"),
            ("appraised_value", "Appraised Value (PHP)"),
            ("insurance_policy", "Insurance Provider & Policy Number"),
            ("registration_info", "Registration / OR-CR Number"),
            ("property_address", "Property Address"),
            ("registered_owner", "Registered Owner"),
            ("tct_cct_number", "TCT / CCT Number"),
        ],
        page_number,
        page_title,
    )

    page_title = "Enhanced Due Diligence"
    draw_footer(pdf, page_number)
    pdf.showPage()
    page_number += 1
    y = draw_header(pdf, page_title)

    for title, fields in [
        (
            "5. Enhanced Due Diligence - Banking Background",
            [
                ("previous_lenders_existing_accounts", "Previous Lenders and Existing Loan Accounts"),
                ("number_of_active_loans", "Number of Active Loans"),
                ("loan_restructuring_disclosures", "Previous Loan Restructuring Disclosures"),
                ("additional_bank_accounts_owned", "Additional Bank Accounts Owned"),
                ("prior_banking_relationships", "Prior Banking Relationships"),
                ("existing_insurance_policies", "Existing Insurance Policies"),
                ("assets_liabilities", "Self-Declared Assets and Liabilities"),
                ("investment_portfolio", "Self-Declared Investment Portfolio"),
            ],
        ),
        (
            "6. Employment, Residence, and Character References",
            [
                ("employment_reference_person", "Employment Reference Person"),
                ("hr_contact_information", "HR Contact Information"),
                ("supervisor_information", "Supervisor Information"),
                ("income_verification_references", "Source of Income Verification References"),
                ("length_of_residence_confirmation", "Length of Residence Confirmation"),
                ("utility_account_references", "Utility Account References"),
                ("character_references", "Character References"),
                ("guarantor_references", "Guarantor References"),
                ("co_borrower_references", "Co-Borrower References"),
                ("employer_or_community_references", "References from Employer or Community"),
                ("professional_memberships", "Professional Organization Memberships"),
                ("professional_licenses", "Professional Licenses"),
            ],
        ),
        (
            "7. Declarations, Profiles, and Outlook",
            [
                ("additional_property_declarations", "Additional Property Declarations"),
                ("additional_vehicle_declarations", "Additional Vehicle Declarations"),
                ("community_involvement_information", "Community Involvement Information"),
                ("facebook_profile", "Facebook Profile (Optional)"),
                ("instagram_profile", "Instagram Profile (Optional)"),
                ("x_profile", "X / Twitter Profile (Optional)"),
                ("tiktok_profile", "TikTok Profile (Optional)"),
                ("linkedin_profile", "LinkedIn Profile (Optional)"),
                ("other_social_media_links", "Other Social Media Links (Optional)"),
                ("business_website", "Business Website (If Self-Employed / Optional)"),
                ("financial_behavior_responses", "Financial Behavior Questionnaire Responses"),
                ("risk_appetite_responses", "Risk Appetite Questionnaire Responses"),
                ("business_outlook_responses", "Business Outlook Questionnaire Responses"),
                ("future_financial_plans", "Future Financial Plans Questionnaire"),
                ("spending_behavior", "Spending Behavior Questionnaire"),
                ("household_budgeting", "Household Budgeting Questionnaire"),
                ("emergency_preparedness", "Emergency Preparedness Questionnaire"),
                ("character_integrity_answers", "Character and Integrity Assessment Answers"),
            ],
        ),
    ]:
        y, page_number = ensure_room(pdf, y, 80, page_number, page_title)
        y = section_title(pdf, y, title)
        for name, label in fields:
            y, page_number = ensure_room(pdf, y, 86, page_number, page_title)
            y = add_text_field(
                pdf,
                form,
                y=y,
                name=name,
                label=label,
                width=PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN,
                height=48,
                multiline=True,
            ) - 4

    y, page_number = ensure_room(pdf, y, 110, page_number, page_title)
    y = section_title(pdf, y, "8. Verification Consents")
    y = add_checkbox(pdf, form, y=y, name="consent_open_banking", label="Consent for Open Banking Data Access")
    y = add_checkbox(pdf, form, y=y, name="consent_employment_verification", label="Consent for Employment Verification")
    y = add_checkbox(pdf, form, y=y, name="consent_identity_verification", label="Consent for Identity Verification")

    page_title = "Optional Psychometric Questionnaire"
    draw_footer(pdf, page_number)
    pdf.showPage()
    page_number += 1
    y = draw_header(pdf, page_title)
    y = section_title(pdf, y, "9. Optional to Answer - 20-Question Psychometric Scoring Questionnaire")
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.HexColor("#475569"))
    pdf.drawString(
        LEFT_MARGIN,
        y,
        "Please select one answer for each statement: Strongly Disagree, Disagree, Neutral, Agree, or Strongly Agree.",
    )
    y -= 20

    questions = [
        "I create a plan before making a major financial decision.",
        "I consistently pay obligations on or before their due dates.",
        "I compare several options before borrowing money.",
        "I set aside part of my income for savings or emergencies.",
        "I avoid buying non-essential items when money is tight.",
        "I stay calm and organized when facing financial pressure.",
        "I prefer long-term financial stability over short-term spending.",
        "I keep personal records such as bills, receipts, or payment schedules organized.",
        "I ask questions and clarify terms before signing contracts.",
        "I feel personally responsible for meeting every debt obligation I take on.",
        "I usually follow through on commitments even when circumstances become difficult.",
        "I review my income and expenses regularly.",
        "I think ahead about how unexpected events could affect my finances.",
        "I would rather delay a purchase than borrow beyond what I can comfortably repay.",
        "People who know me would describe me as financially disciplined.",
        "I am careful about sharing accurate information in financial applications.",
        "I am comfortable seeking advice when I do not understand financial matters.",
        "I prioritize household essentials before discretionary spending.",
        "I can adjust my lifestyle if income temporarily declines.",
        "I make financial decisions with my long-term goals in mind.",
    ]

    for index, question in enumerate(questions, start=1):
        y, page_number = ensure_room(pdf, y, 64, page_number, page_title)
        y = add_text_field(
            pdf,
            form,
            y=y,
            name=f"psychometric_question_{index:02d}",
            label=f"{index}. {question}",
            width=PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN,
            height=24,
        ) - 2

    page_title = "Supporting Document Checklist"
    draw_footer(pdf, page_number)
    pdf.showPage()
    page_number += 1
    y = draw_header(pdf, page_title)
    y = section_title(pdf, y, "10. Supporting Document Checklist")

    document_items = [
        "Valid Government ID",
        "Passport (if applicable)",
        "Driver License",
        "PhilSys ID",
        "Certificate of Employment",
        "Latest 3 Months Payslips",
        "Latest ITR / Tax Returns",
        "DTI / SEC Registration",
        "Business Permit",
        "Financial Statements",
        "Utility Bill",
        "Water Bill",
        "Internet Bill",
        "Title (TCT / CCT)",
        "Tax Declaration",
        "Lot Plan",
        "Property Photos",
        "Vehicle Quotation",
        "Vehicle Invoice",
        "OR / CR for Refinancing",
        "Proof of Income",
        "Bank Statements",
        "Existing Credit Card Statements",
        "Additional Supporting Documents",
        "Audited Financial Statements",
        "Proof of Remittance Income",
        "Investment Statements",
    ]

    for item in document_items:
        y, page_number = ensure_room(pdf, y, 28, page_number, page_title)
        safe_name = item.lower().replace(" ", "_").replace("/", "_").replace("(", "").replace(")", "")
        y = add_checkbox(pdf, form, y=y, name=f"doc_{safe_name}", label=item)

    y, page_number = ensure_room(pdf, y, 120, page_number, page_title)
    y = section_title(pdf, y, "11. Signatures and Final Notes")
    y = add_text_field(pdf, form, y=y, name="committee_remarks", label="Credit Committee Remarks", width=PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, height=54, multiline=True) - 4
    y = add_text_field(pdf, form, y=y, name="release_authorization_notes", label="Release Authorization Notes", width=PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, height=54, multiline=True) - 4
    y, page_number = draw_two_column_fields(
        pdf,
        form,
        y,
        [
            ("assigned_credit_officer", "Assigned Credit Officer"),
            ("branch_manager", "Branch Manager"),
            ("committee_status", "Committee Status"),
            ("workflow_action", "Recommended Workflow Action"),
        ],
        page_number,
        page_title,
    )

    draw_footer(pdf, page_number)
    pdf.save()


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[1]
    output_file = repo_root / "frontend" / "public" / "loan-application-intake-form.pdf"
    build_pdf(output_file)
    print(f"Created {output_file}")
