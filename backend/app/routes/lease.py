from fastapi import APIRouter
from sqlalchemy import desc

from app.database import SessionLocal
from app.models.lease import Leasee
from app.schemas.lease_schema import LeaseCreate

router = APIRouter()

@router.get("/lease-scorecards")
def get_lease_scorecards():

    db = SessionLocal()

    records = (
        db.query(Leasee)
        .order_by(desc(Leasee.id))
        .limit(20)
        .all()
    )

    return [
        {
            "id": r.id,
            "customerName": r.customer_name,
            "finalScore": r.final_score,
            "riskGrade": r.risk_grade,
            "decision": r.decision,
            "monthlyEstimatedPayment": r.monthly_estimated_payment,
            "loanToValue": r.loan_to_value,
            "summary": r.summary,
        }
        for r in records
    ]

@router.post("/lease-scorecards")
def create_lease_scorecard(data: LeaseCreate):
     

     db = SessionLocal()

     vehicle_age_score = 0

     if data.vehicleAge <= 3:
      vehicle_age_score = 5
     elif data.vehicleAge <= 7:
      vehicle_age_score = 3
     else:
      vehicle_age_score = 1

     final_score = round(
        credit_component +
        affordability_component +
        equity_component +
        stability_component +
        asset_component +
        vehicle_age_score,
        2
    )

     credit_component = min(
        (data.creditScore / 850) * 35,
        35
    )

     debt_ratio = (
        data.existingDebt /
        max(data.monthlyIncome, 1)
    )

     affordability_component = (
        max(0, 1 - debt_ratio)
        * 30
    )

     equity_ratio = (
        data.downPayment /
        max(data.vehicleValue, 1)
    )

     equity_component = min(
        equity_ratio * 15,
        15
    )

     stability_component = min(
        (
            data.yearsInBusiness +
            data.employmentYears
        ) / 20 * 10,
        10
    )

     asset_component = min(
        (
            data.estimatedResidualValue /
            max(data.vehicleValue, 1)
        ) * 10,
        10
         )
     vehicle_use_score = 0

     if data.vehicleUse == 1:
       vehicle_use_score = 3
     final_score = round(
        credit_component +
        affordability_component +
        equity_component +
        stability_component +
        asset_component +
        vehicle_age_score +
        vehicle_use_score,
        2
     )    
     if final_score >= 90:
      risk_grade = "A+"
      decision = "APPROVED"

     elif final_score >= 80:
      risk_grade = "A"
      decision = "APPROVED"

     elif final_score >= 70:
      risk_grade = "B"
      decision = "REVIEW"

     elif final_score >= 60:
       risk_grade = "C"
       decision = "REVIEW"

     else:
       risk_grade = "D"
       decision = "DECLINED"

     financed_amount = (
        data.requestedAmount -
        data.downPayment
      )

     monthly_payment = (
        financed_amount /
        max(data.leaseTermMonths, 1)
     )

     loan_to_value = (
        data.requestedAmount /
        max(data.vehicleValue, 1)
     )

     lease = Leasee(
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

        vehicle_age=data.vehicleAge,
        vehicle_use=data.vehicleUse,
        estimated_residual_value=data.estimatedResidualValue,

        final_score=final_score,
        risk_grade=risk_grade,
        decision=decision,

        monthly_estimated_payment=monthly_payment,
        loan_to_value=loan_to_value,

        summary=f"Lease rated {risk_grade}"
      )

     db.add(lease)

     db.commit()

     db.refresh(lease)   

     return {
        "id": lease.id,
        "customerName": lease.customer_name,
        "finalScore": lease.final_score,
        "riskGrade": lease.risk_grade,
        "decision": lease.decision,
        "monthlyEstimatedPayment": lease.monthly_estimated_payment,
        "loanToValue": lease.loan_to_value,
        "summary": lease.summary
    } 

