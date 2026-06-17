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

            executive_approval=data.executive_approval,

            dti=data.dti,
            dsr=data.dsr,
            ltv=data.ltv,

            scorecard_total=data.scorecard_total,

            ai_probability=data.ai_probability,



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




@router.put("/loan-applications/{application_no}/status")
def update_status(application_no: str, status: str):

    db = SessionLocal()

    try:

        record = db.query(LoanApplication).filter(
            LoanApplication.application_no == application_no
        ).first()

        if not record:
            return {"error": "Application not found"}

        record.status = status

        db.commit()

        return {
            "message": f"Status updated to {status}"
        }

    finally:
        db.close()

@router.get("/loan-applications/{application_no}")
def get_loan_application(application_no: str):

    db = SessionLocal()

    try:

        record = db.query(LoanApplication).filter(
            LoanApplication.application_no == application_no
        ).first()

        if not record:
            return {"error": "Application not found"}

        return record

    finally:
        db.close()       



@router.put("/loan-applications/{application_no}")
def update_loan_application(
    application_no: str,
    data: LoanApplicationCreate
):

    db = SessionLocal()

    try:

        record = db.query(LoanApplication).filter(
            LoanApplication.application_no == application_no
        ).first()

        if not record:
            return {"error": "Application not found"}

        record.status = data.status

        record.borrower_name = data.borrower_name
        record.email = data.email
        record.phone = data.phone
        record.gov_id = data.gov_id
        record.address = data.address

        record.monthly_income = data.monthly_income
        record.other_income = data.other_income
        record.debt_obligations = data.debt_obligations

        record.loan_amount = data.loan_amount
        record.term_months = data.term_months
        record.interest_rate = data.interest_rate
        record.purpose = data.purpose

        record.vehicle_info = data.vehicle_info
        record.appraised_value = data.appraised_value

        record.committee_remarks = data.committee_remarks

        record.executive_approval = data.executive_approval

        record.dti = data.dti
        record.dsr = data.dsr
        record.ltv = data.ltv

        record.scorecard_total = data.scorecard_total

        record.ai_probability = data.ai_probability

        db.commit()

        return {
            "message": "Loan application updated"
        }

    finally:
        db.close()        