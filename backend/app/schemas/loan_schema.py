from pydantic import BaseModel

class LoanApplicationCreate(BaseModel):

    application_no: str
    status: str

    borrower_name: str
    email: str
    phone: str
    gov_id: str
    address: str

    monthly_income: float
    other_income: float
    debt_obligations: float

    loan_amount: float
    term_months: int
    interest_rate: float
    purpose: str

    vehicle_info: str
    appraised_value: float

    committee_remarks: str

    executive_approval: bool