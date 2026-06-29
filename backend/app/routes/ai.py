import base64
import csv
import json
import os
import tempfile
import time
from datetime import datetime
from io import StringIO
from typing import Any

from fastapi import APIRouter, Depends, UploadFile, File, Query
from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from openai import OpenAI
from dotenv import load_dotenv

from app.database import SessionLocal
from app.fastapi_auth import CurrentUser, get_current_user, require_roles
from app.schemas.ai_governance_schema import (
    AIFeedbackRequest,
    AIFeedbackResponse,
    AIGovernanceStatsResponse,
    AIRequestAuditResponse,
    AIResponseAuditResponse,
)
from app.models.ai_governance import AIRequest, AIResponse
from app.models.meeting_minutes import MeetingMinutes
from app.services.email_service import send_email
from app.services.ai_governance_service import (
    create_ai_request,
    create_feedback,
    extract_usage,
    finalize_ai_failure,
    finalize_ai_success,
    governance_stats,
)
from app.services.pdf_service import generate_minutes_pdf

load_dotenv()

router = APIRouter()

client: OpenAI | None = None
UPLOAD_WRITE_CHUNK_SIZE = 1024 * 1024


def get_openai_client() -> OpenAI:
    global client

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI features are not configured on the backend.",
        )

    if client is None:
        client = OpenAI(api_key=api_key)

    return client


def _extract_json_payload(content: str) -> dict[str, Any]:
    normalized = content.strip()

    if normalized.startswith("```"):
        normalized = normalized.split("```", 2)[1]
        if normalized.startswith("json"):
            normalized = normalized[4:]
        normalized = normalized.strip()

    return json.loads(normalized)


@router.post("/ai/transcribe", dependencies=[Depends(require_roles("Admin", "Manager"))])
async def transcribe(
    audio: UploadFile = File(...),
    current_user: CurrentUser | None = Depends(get_current_user),
):

    tmp_path = None
    governance_db = SessionLocal()
    started_at = time.perf_counter()
    model_name = "whisper-1"
    request_log_id: int | None = None
  
    try:

        suffix = os.path.splitext(audio.filename)[1]

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as tmp:
            while True:
                chunk = await audio.read(UPLOAD_WRITE_CHUNK_SIZE)
                if not chunk:
                    break
                tmp.write(chunk)
            tmp_path = tmp.name

        print("Filename:", audio.filename)
        print("Content-Type:", audio.content_type)
        print("File Size:", os.path.getsize(tmp_path))

        request_log = create_ai_request(
            governance_db,
            user_id=current_user.id if current_user else None,
            endpoint="/ai/transcribe",
            prompt=f"Transcribe audio file: {audio.filename}",
            model=model_name,
            request_metadata={"filename": audio.filename, "content_type": audio.content_type},
        )
        request_log_id = request_log.id

        with open(tmp_path, "rb") as audio_file:

           
         result = get_openai_client().audio.transcriptions.create( 
            model=model_name,
            file=audio_file
         )

        input_tokens, output_tokens, total_tokens = extract_usage(result)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        finalize_ai_success(
            governance_db,
            request_id=request_log_id,
            user_id=current_user.id if current_user else None,
            model=model_name,
            response_text=result.text,
            response_json=None,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
        )

        return {
            "transcript": result.text
        }

    except Exception as e:
        if request_log_id:
            finalize_ai_failure(governance_db, request_id=request_log_id, error_message=str(e))
        return {
            "error": str(e)
        }

    finally:
        governance_db.close()
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


        


@router.post("/ai/minutes", dependencies=[Depends(require_roles("Admin", "Manager"))])
async def meeting_minutes(
    data: dict,
    current_user: CurrentUser | None = Depends(get_current_user),
):

    transcript = data.get("transcript", "")
    meeting_title = data.get("meeting_title", "Meeting")
    meeting_date = data.get("meeting_date")

    if not transcript:
        return {
            "error": "Transcript is required"
        }

    prompt = f"""
Generate:

1. Meeting Summary
2. Key Decisions
3. Risks
4. Action Items
5. Assigned Personnel

Transcript:

{transcript}
"""

    model_name = "gpt-4.1"
    governance_db = SessionLocal()
    started_at = time.perf_counter()
    request_log = create_ai_request(
        governance_db,
        user_id=current_user.id if current_user else None,
        endpoint="/ai/minutes",
        prompt=prompt,
        model=model_name,
        request_metadata={"meeting_title": meeting_title},
    )

    try:
        response = get_openai_client().chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        summary = response.choices[0].message.content

        input_tokens, output_tokens, total_tokens = extract_usage(response)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        finalize_ai_success(
            governance_db,
            request_id=request_log.id,
            user_id=current_user.id if current_user else None,
            model=model_name,
            response_text=summary,
            response_json=None,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        finalize_ai_failure(governance_db, request_id=request_log.id, error_message=str(exc))
        governance_db.close()
        raise

    governance_db.close()

    db = SessionLocal()

    try:

        meeting = MeetingMinutes(
            meeting_title=meeting_title,
            meeting_date=datetime.fromisoformat(
                meeting_date
            ) if meeting_date else None,
            transcript=transcript,
            summary=summary,
            action_items=summary
        )

        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        return {
            "id": meeting.id,
            "meeting_title": meeting.meeting_title,
            "summary": meeting.summary,
            "message": "Meeting saved successfully"
        }

    finally:
        db.close()


@router.get("/ai/meetings", dependencies=[Depends(require_roles("Admin", "Manager", "Viewer"))])
def get_meetings():

    db = SessionLocal()

    try:

        meetings = (
            db.query(MeetingMinutes)
            .order_by(MeetingMinutes.id.desc())
            .all()
        )

        return [
            {
                "id": m.id,
                "meeting_title": m.meeting_title,
                "meeting_date": str(m.meeting_date),
                "created_at": str(m.created_at)
            }
            for m in meetings
        ]
    
    except Exception as e:
        return {
            "error": str(e)
        }

    finally:
        db.close()

@router.get("/ai/meetings/{meeting_id}", dependencies=[Depends(require_roles("Admin", "Manager", "Viewer"))])
def get_meeting(meeting_id: int):


  db = SessionLocal()

  try:

    meeting = (
        db.query(MeetingMinutes)
        .filter(
            MeetingMinutes.id == meeting_id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    return {
        "id": meeting.id,
        "meeting_title": meeting.meeting_title,
        "meeting_date": str(meeting.meeting_date),
        "transcript": meeting.transcript,
        "summary": meeting.summary,
        "action_items": meeting.action_items,
        "created_at": str(meeting.created_at)
    }

  finally:
    db.close()

@router.get("/ai/meetings/{meeting_id}/pdf", dependencies=[Depends(require_roles("Admin", "Manager", "Viewer"))])
def download_meeting_pdf(meeting_id: int):

    db = SessionLocal()

    try:

        meeting = (
            db.query(MeetingMinutes)
            .filter(
                MeetingMinutes.id == meeting_id
            )
            .first()
        )

        if not meeting:
            raise HTTPException(
                status_code=404,
                detail="Meeting not found"
            )

        pdf_path = tempfile.mktemp(
            suffix=".pdf"
        )

        generate_minutes_pdf(
            pdf_path,
            meeting
        )
        
        return FileResponse(
            path=pdf_path,
            filename=f"{meeting.meeting_title}.pdf",
            media_type="application/pdf"
        )

    finally:
        db.close()



@router.post("/ai/send-minutes", dependencies=[Depends(require_roles("Admin", "Manager"))])
async def send_minutes(data: dict):

    recipient = data.get("recipient")

    subject = data.get(
        "subject",
        "Meeting Minutes"
    )

    body = data.get(
        "body",
        ""
    )

    send_email(
        recipient,
        subject,
        body
    )

    return {
        "message": "Email sent successfully"
    }


@router.post("/ai/loan-documents/parse", dependencies=[Depends(require_roles("Admin", "Manager"))])
async def parse_loan_document(
    file: UploadFile = File(...),
    current_user: CurrentUser | None = Depends(get_current_user),
):
    get_openai_client()

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image uploads are supported for automatic requirement capture.",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    image_data_url = (
        f"data:{file.content_type};base64,"
        f"{base64.b64encode(file_bytes).decode('utf-8')}"
    )

    prompt = """
You are reviewing a single uploaded loan application document image.

Extract only information that is clearly visible. Do not guess missing values.
Return strict JSON with this shape:
{
  "documentName": "string",
  "documentType": "string",
  "confidence": 0.0,
  "summary": "string",
  "notes": ["string"],
  "supportingDocuments": {
    "validGovernmentId": false,
    "passportIfApplicable": false,
    "driversLicense": false,
    "philSysId": false,
    "certificateOfEmployment": false,
    "latestPayslips": false,
    "latestItr": false,
    "dtiSecRegistration": false,
    "businessPermit": false,
    "financialStatements": false,
    "utilityBill": false,
    "waterBill": false,
    "internetBill": false,
    "titleTctCct": false,
    "taxDeclaration": false,
    "lotPlan": false,
    "propertyPhotos": false,
    "vehicleQuotation": false,
    "vehicleInvoice": false,
    "orCrForRefinancing": false,
    "proofOfIncome": false,
    "bankStatements": false,
    "existingCreditCardStatements": false
  },
  "extractedData": {
    "borrower": {
      "fullName": "",
      "email": "",
      "phone": "",
      "govId": "",
      "address": ""
    },
    "applicantPersonal": {
      "lastName": "",
      "firstName": "",
      "middleName": "",
      "dateOfBirth": "",
      "placeOfBirth": ""
    },
    "contactInformation": {
      "mobileNumber": "",
      "homePhoneNumber": "",
      "emailAddress": ""
    },
    "governmentIds": {
      "tin": "",
      "sssGsisNumber": "",
      "idNumber": "",
      "issueDate": "",
      "expiryDate": ""
    },
    "addressInformation": {
      "presentAddress": "",
      "permanentAddress": "",
      "mailingAddress": ""
    },
    "employment": {
      "history": "",
      "monthlyIncome": 0,
      "otherIncome": 0,
      "debtObligations": 0
    },
    "employmentInformation": {
      "employmentStatus": "",
      "employerBusinessName": "",
      "occupation": "",
      "grossMonthlyIncome": 0,
      "otherSourcesOfIncome": 0,
      "investmentIncome": 0,
      "businessIncome": 0
    },
    "collateralInformation": {
      "propertyAddress": "",
      "registeredOwner": "",
      "tctCctNumber": ""
    },
    "otherInformation": {}
  }
}

Rules:
- Keep unsupported or unknown fields empty strings, zeros, or false.
- Only mark a supporting document true when the image actually appears to match it.
- Dates must be YYYY-MM-DD if confidently readable, otherwise empty.
- Numeric amounts must be plain numbers without commas or currency symbols.
- Confidence must be between 0 and 1.
"""

    model_name = "gpt-4.1-mini"
    governance_db = SessionLocal()
    started_at = time.perf_counter()
    request_log = create_ai_request(
        governance_db,
        user_id=current_user.id if current_user else None,
        endpoint="/ai/loan-documents/parse",
        prompt=prompt,
        model=model_name,
        request_metadata={
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(file_bytes),
        },
    )

    try:
        response = get_openai_client().chat.completions.create(
            model=model_name,
            temperature=0,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_url,
                            },
                        },
                    ],
                }
            ],
        )

        message_content = response.choices[0].message.content or "{}"
        parsed_payload = _extract_json_payload(message_content)

        input_tokens, output_tokens, total_tokens = extract_usage(response)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        finalize_ai_success(
            governance_db,
            request_id=request_log.id,
            user_id=current_user.id if current_user else None,
            model=model_name,
            response_text=message_content,
            response_json=parsed_payload,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
        )

        return parsed_payload
    except json.JSONDecodeError as exc:
        finalize_ai_failure(governance_db, request_id=request_log.id, error_message=str(exc))
        raise HTTPException(
            status_code=502,
            detail=f"AI document parser returned invalid JSON: {exc}",
        ) from exc
    except Exception as exc:
        finalize_ai_failure(governance_db, request_id=request_log.id, error_message=str(exc))
        raise HTTPException(
            status_code=500,
            detail=f"AI document parsing failed: {exc}",
        ) from exc
    finally:
        governance_db.close()

@router.get("/ai/meetings/search/{keyword}", dependencies=[Depends(require_roles("Admin", "Manager", "Viewer"))])
def search_meetings(keyword: str):

    db = SessionLocal()

    try:

        meetings = (
            db.query(MeetingMinutes)
            .filter(
                MeetingMinutes.meeting_title.ilike(
                    f"%{keyword}%"
                )
            )
            .all()
        )

        return [
            {
                "id": m.id,
                "meeting_title": m.meeting_title,
                "meeting_date": str(m.meeting_date)
            }
            for m in meetings
        ]

    finally:
        db.close()

@router.get("/ai/dashboard/stats", dependencies=[Depends(require_roles("Admin", "Manager", "Viewer"))])
def dashboard_stats():

    db = SessionLocal()

    try:

        total_meetings = (
            db.query(MeetingMinutes)
            .count()
        )

        total_action_items = (
            db.query(MeetingMinutes)
            .count()
        )

        meetings_this_month = (
            db.query(MeetingMinutes)
            .count()
        )

        return {
            "total_meetings": total_meetings,
            "minutes_generated": total_meetings,
            "emails_sent": 0,
            "pdf_exports": 0,
            "action_items": total_action_items,
            "meetings_this_month": meetings_this_month
        }

    finally:
        db.close()




@router.get("/ai/health", dependencies=[Depends(require_roles("Admin", "Manager", "Viewer"))])
async def ai_health():
    return {
        "status": "AI Service Running"
           }


@router.post("/ai/feedback", response_model=AIFeedbackResponse, dependencies=[Depends(require_roles("Admin", "Manager", "Viewer"))])
async def submit_ai_feedback(
    payload: AIFeedbackRequest,
    current_user: CurrentUser | None = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        row = create_feedback(
            db,
            user_id=current_user.id if current_user else None,
            request_id=payload.request_id,
            response_id=payload.response_id,
            rating=payload.rating,
            feedback_text=payload.feedback_text,
        )
        return AIFeedbackResponse.model_validate(row)
    finally:
        db.close()


@router.get("/ai/governance/stats", response_model=AIGovernanceStatsResponse, dependencies=[Depends(require_roles("Admin", "Manager", "Viewer", "Auditor"))])
async def ai_governance_stats():
    db = SessionLocal()
    try:
        return AIGovernanceStatsResponse(**governance_stats(db))
    finally:
        db.close()


@router.get(
    "/ai/governance/requests",
    response_model=list[AIRequestAuditResponse],
    dependencies=[Depends(require_roles("Admin", "Manager", "Auditor"))],
)
async def list_ai_governance_requests(
    user_id: int | None = Query(None),
    model: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    min_cost: float | None = Query(None, ge=0),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        query = db.query(AIRequest)

        if user_id is not None:
            query = query.filter(AIRequest.user_id == user_id)
        if model:
            query = query.filter(AIRequest.model == model)
        if start_date:
            query = query.filter(AIRequest.created_at >= start_date)
        if end_date:
            query = query.filter(AIRequest.created_at <= end_date)
        if min_cost is not None:
            query = query.filter(AIRequest.cost >= min_cost)

        rows = query.order_by(AIRequest.id.desc()).offset(offset).limit(limit).all()
        return [AIRequestAuditResponse.model_validate(row) for row in rows]
    finally:
        db.close()


@router.get(
    "/ai/governance/responses",
    response_model=list[AIResponseAuditResponse],
    dependencies=[Depends(require_roles("Admin", "Manager", "Auditor"))],
)
async def list_ai_governance_responses(
    user_id: int | None = Query(None),
    model: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    min_cost: float | None = Query(None, ge=0),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        query = db.query(AIResponse)

        if user_id is not None:
            query = query.filter(AIResponse.user_id == user_id)
        if model:
            query = query.filter(AIResponse.model == model)
        if start_date:
            query = query.filter(AIResponse.created_at >= start_date)
        if end_date:
            query = query.filter(AIResponse.created_at <= end_date)
        if min_cost is not None:
            query = query.filter(AIResponse.cost >= min_cost)

        rows = query.order_by(AIResponse.id.desc()).offset(offset).limit(limit).all()
        return [AIResponseAuditResponse.model_validate(row) for row in rows]
    finally:
        db.close()


@router.get(
    "/ai/governance/requests/export",
    dependencies=[Depends(require_roles("Admin", "Manager", "Auditor"))],
)
async def export_ai_governance_requests_csv(
    user_id: int | None = Query(None),
    model: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    min_cost: float | None = Query(None, ge=0),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        query = db.query(AIRequest)

        if user_id is not None:
            query = query.filter(AIRequest.user_id == user_id)
        if model:
            query = query.filter(AIRequest.model == model)
        if start_date:
            query = query.filter(AIRequest.created_at >= start_date)
        if end_date:
            query = query.filter(AIRequest.created_at <= end_date)
        if min_cost is not None:
            query = query.filter(AIRequest.cost >= min_cost)

        rows = query.order_by(AIRequest.id.desc()).offset(offset).limit(limit).all()

        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "id",
                "user_id",
                "endpoint",
                "prompt",
                "model",
                "cost",
                "input_tokens",
                "output_tokens",
                "total_tokens",
                "status",
                "error_message",
                "created_at",
            ]
        )

        for row in rows:
            writer.writerow(
                [
                    row.id,
                    row.user_id,
                    row.endpoint,
                    row.prompt,
                    row.model,
                    row.cost,
                    row.input_tokens,
                    row.output_tokens,
                    row.total_tokens,
                    row.status,
                    row.error_message,
                    row.created_at,
                ]
            )

        filename = f"ai_governance_requests_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    finally:
        db.close()


@router.get(
    "/ai/governance/responses/export",
    dependencies=[Depends(require_roles("Admin", "Manager", "Auditor"))],
)
async def export_ai_governance_responses_csv(
    user_id: int | None = Query(None),
    model: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    min_cost: float | None = Query(None, ge=0),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        query = db.query(AIResponse)

        if user_id is not None:
            query = query.filter(AIResponse.user_id == user_id)
        if model:
            query = query.filter(AIResponse.model == model)
        if start_date:
            query = query.filter(AIResponse.created_at >= start_date)
        if end_date:
            query = query.filter(AIResponse.created_at <= end_date)
        if min_cost is not None:
            query = query.filter(AIResponse.cost >= min_cost)

        rows = query.order_by(AIResponse.id.desc()).offset(offset).limit(limit).all()

        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "id",
                "request_id",
                "user_id",
                "model",
                "cost",
                "input_tokens",
                "output_tokens",
                "total_tokens",
                "latency_ms",
                "created_at",
            ]
        )

        for row in rows:
            writer.writerow(
                [
                    row.id,
                    row.request_id,
                    row.user_id,
                    row.model,
                    row.cost,
                    row.input_tokens,
                    row.output_tokens,
                    row.total_tokens,
                    row.latency_ms,
                    row.created_at,
                ]
            )

        filename = f"ai_governance_responses_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    finally:
        db.close()
