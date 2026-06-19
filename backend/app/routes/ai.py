import base64
import json
from typing import Any

from fastapi import APIRouter, UploadFile, File
from openai import OpenAI
from dotenv import load_dotenv

from app.services.email_service import send_email
from datetime import datetime
from app.database import SessionLocal
from app.models.meeting_minutes import MeetingMinutes
from fastapi import HTTPException
from fastapi.responses import FileResponse
import tempfile

from app.services.pdf_service import generate_minutes_pdf
from fastapi.responses import FileResponse
import tempfile



import tempfile
import os

load_dotenv()

router = APIRouter()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY", "").strip()
)


def _extract_json_payload(content: str) -> dict[str, Any]:
    normalized = content.strip()

    if normalized.startswith("```"):
        normalized = normalized.split("```", 2)[1]
        if normalized.startswith("json"):
            normalized = normalized[4:]
        normalized = normalized.strip()

    return json.loads(normalized)


@router.post("/ai/transcribe")
async def transcribe(audio: UploadFile = File(...)):

    tmp_path = None
  
    try:

        suffix = os.path.splitext(audio.filename)[1]

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name

        print("Filename:", audio.filename)
        print("Content-Type:", audio.content_type)
        print("File Size:", os.path.getsize(tmp_path))

        with open(tmp_path, "rb") as audio_file:

           
         result = client.audio.transcriptions.create( 
            model="whisper-1",
            file=audio_file
         )

        return {
            "transcript": result.text
        }

    except Exception as e:
        return {
            "error": str(e)
        }

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


        


@router.post("/ai/minutes")
async def meeting_minutes(data: dict):

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

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    summary = response.choices[0].message.content

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


@router.get("/ai/meetings")
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

@router.get("/ai/meetings/{meeting_id}")
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

@router.get("/ai/meetings/{meeting_id}/pdf")
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



@router.post("/ai/send-minutes")
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


@router.post("/ai/loan-documents/parse")
async def parse_loan_document(file: UploadFile = File(...)):
    if not os.getenv("OPENAI_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail="AI document parsing is not configured on the backend.",
        )

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

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
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

        return parsed_payload
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI document parser returned invalid JSON: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI document parsing failed: {exc}",
        ) from exc

@router.get("/ai/dashboard/stats")
def dashboard_stats():

    db = SessionLocal()

    try:

        total_meetings = (
            db.query(MeetingMinutes)
            .count()
        )

        return {
            "total_meetings": total_meetings,
            "minutes_generated": total_meetings,
            "emails_sent": 0,
            "pdf_exports": 0
        }

    finally:
        db.close()

@router.get("/ai/meetings/search/{keyword}")
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

@router.get("/ai/dashboard/stats")
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




@router.get("/ai/health")
async def ai_health():
    return {
        "status": "AI Service Running"
           }
