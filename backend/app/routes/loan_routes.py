from fastapi import APIRouter
from app.database import SessionLocal
from app.models.loan_application import LoanApplication
from app.schemas.loan_schema import LoanApplicationCreate

router = APIRouter()

@router.post("/loan-applications")
def create_loan_application(data: LoanApplicationCreate):

    db = SessionLocal()

    try:

        record = LoanApplication(
            application_no=data.application_no,
            status=data.status,

            borrower_name=data.borrower_name,
            email=data.email,
            phone=data.phone,
            gov_id=data.gov_id,
            address=data.address,

            monthly_income=data.monthly_income,
            other_income=data.other_income,
            debt_obligations=data.debt_obligations,

            loan_amount=data.loan_amount,
            term_months=data.term_months,
            interest_rate=data.interest_rate,
            purpose=data.purpose,

            vehicle_info=data.vehicle_info,
            appraised_value=data.appraised_value,

            committee_remarks=data.committee_remarks,

            executive_approval=data.executive_approval
        )

        db.add(record)
        db.commit()

        return {
            "message": "Loan application saved"
        }
    

    
    finally:
        db.close()

@router.get("/loan-applications")
def get_loan_applications():

    db = SessionLocal()

    try:
        loans = db.query(LoanApplication).all()

        return loans

    finally:
        db.close()


@router.put("/loan-applications/{id}/status")
def update_status(id: int, status: str):
    db = SessionLocal()

    loan = (
        db.query(LoanApplication)
        .filter(LoanApplication.id == id)
        .first()
    )

    loan.status = status

    db.commit()

    return {"message": "Status updated"}

