from typing import Any

from pydantic import BaseModel, Field

class LoanApplicationCreate(BaseModel):

    application_no: str
    status: str
    product_type: str

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


    dti: float
    dsr: float
    ltv: float

    scorecard_total: int

    ai_probability: float

    requirements: dict[str, Any] = Field(default_factory=dict)