from fastapi import APIRouter, HTTPException, status as http_status
from app.database import SessionLocal
from app.models.loan_application import LoanApplication
from app.schemas.loan_schema import LoanApplicationCreate

router = APIRouter()


def get_loan_application_or_404(db, application_no: str) -> LoanApplication:
    record = db.query(LoanApplication).filter(
        LoanApplication.application_no == application_no
    ).first()

    if not record:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    return record


@router.post("/loan-applications", status_code=http_status.HTTP_201_CREATED)
def create_loan_application(data: LoanApplicationCreate):

    db = SessionLocal()

    try:
        existing_record = db.query(LoanApplication).filter(
            LoanApplication.application_no == data.application_no
        ).first()

        if existing_record:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Application already exists",
            )

        record = LoanApplication(
            application_no=data.application_no,
            status=data.status,
            product_type=data.product_type,

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

            requirements=data.requirements,



        )

        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "message": "Loan application saved",
            "application_no": record.application_no,
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
        record = get_loan_application_or_404(db, application_no)

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
        record = get_loan_application_or_404(db, application_no)
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
        record = get_loan_application_or_404(db, application_no)

        record.status = data.status
        record.product_type = data.product_type

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

        record.requirements = data.requirements

        db.commit()

        return {
            "message": "Loan application updated",
            "application_no": record.application_no,
        }

    finally:
        db.close()        
