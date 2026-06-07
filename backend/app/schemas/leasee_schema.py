from pydantic import BaseModel

class LeaseScorecardSubmission(BaseModel):
    customerName: str
    companyName: str
    vehicleType: str
    vehicleValue: float
    downPayment: float
    requestedAmount: float
    monthlyIncome: float
    existingDebt: float
    leaseTermMonths: int
    creditScore: int
    yearsInBusiness: int
    employmentYears: int
    VehicleAge: int
    VehiclesUse: int
    EstimatedResidualValue: float
