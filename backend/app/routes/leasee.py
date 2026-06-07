from fastapi import APIRouter
from sqlalchemy import desc

from app.database import SessionLocal
from app.models.leasee import Leasee
from app.schemas.leasee_schema import LeaseScorecardSubmission

router = APIRouter()

@router.get("/leasees")
def get_leasees():
    db = SessionLocal()

    leasees = db.query(Leasee).order_by(desc(Leasee.id)).all()

    return [
        {
            "id": leasee.id,
            "customerName": leasee.customer_name,
            "companyName": leasee.company_name,
            "vehicleType": leasee.vehicle_type,
            "vehicleValue": leasee.vehicle_value,
            "downPayment": leasee.down_payment,
            "requestedAmount": leasee.requested_amount,
            "monthlyIncome": leasee.monthly_income,
            "existingDebt": leasee.existing_debt,
            "leaseTermMonths": leasee.lease_term_months,
            "creditScore": leasee.credit_score,
            "yearsInBusiness": leasee.years_in_business,
            "employmentYears": leasee.employment_years,
            "VehicleAge": leasee.vehicle_age,
            "VehiclesUse": leasee.vehicles_use,
            "EstimatedResidualValue": leasee.estimated_residual_value,
            "createdAt": str(leasee.created_at)
        }
        for leasee in leasees
    ]


@router.post("/leasees")
def create_leasee(data: LeaseScorecardSubmission):
    db = SessionLocal()

    leasee = Leasee(
        customer_name=data.customerName,
        company_name=data.companyName,
        vehicle_type=data.vehicleType,
        vehicle_value=data.vehicleValue,
        down_payment=data.downPayment,
        requested_amount=data.requestedAmount,
        monthly_income=data.monthlyIncome,
        existing_debt=data.existingDebt,
        lease_term_months=data.leaseTermMonths,
        credit_score=data.creditScore,
        years_in_business=data.yearsInBusiness,
        employment_years=data.employmentYears,
        vehicle_age=data.VehicleAge,
        vehicles_use=data.VehiclesUse,
        estimated_residual_value=data.EstimatedResidualValue
    )

    db.add(leasee)
    db.commit()
    db.refresh(leasee)

    return {
        "id": leasee.id,
        "customerName": leasee.customer_name,
        "companyName": leasee.company_name,
        "vehicleType": leasee.vehicle_type,
        "vehicleValue": leasee.vehicle_value,
        "downPayment": leasee.down_payment,
        "requestedAmount": leasee.requested_amount,
        "monthlyIncome": leasee.monthly_income,
        "existingDebt": leasee.existing_debt,
        "leaseTermMonths": leasee.lease_term_months,
        "creditScore": leasee.credit_score,
        "yearsInBusiness": leasee.years_in_business,
        "employmentYears": leasee.employment_years,
        "VehicleAge": leasee.vehicle_age,
        "VehiclesUse": leasee.vehicles_use,
        "EstimatedResidualValue": leasee.estimated_residual_value,
        "createdAt": str(leasee.created_at)
    }
