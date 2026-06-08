from pydantic import BaseModel

class LeaseCreate(BaseModel):
    customerName: str
    companyName: str | None = None
    vehicleType: str

    vehicleValue: float
    downPayment: float
    requestedAmount: float

    monthlyIncome: float
    existingDebt: float

    leaseTermMonths: int
    creditScore: int

    yearsInBusiness: float
    employmentYears: float

    vehicleAge: int
    vehicleUse: int
    estimatedResidualValue: float