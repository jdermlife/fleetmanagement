from fastapi import APIRouter, UploadFile, File
from openai import OpenAI
from dotenv import load_dotenv

from datetime import datetime
from app.database import SessionLocal
from app.models.meeting_minutes import MeetingMinutes

import tempfile
import os

load_dotenv()

router = APIRouter()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY", "").strip()
)


@router.post("/ai/transcribe")
async def transcribe(audio: UploadFile = File(...)):

    try:

        suffix = os.path.splitext(audio.filename)[1]

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name

        print("========== AUDIO DEBUG ==========")
        print("Filename:", audio.filename)
        print("Content-Type:", audio.content_type)
        print("Temp Path:", tmp_path)
        print("File Size:", os.path.getsize(tmp_path))
        print("=================================")

        return {
            "filename": audio.filename,
            "content_type": audio.content_type,
            "size": os.path.getsize(tmp_path),
            "temp_path": tmp_path
        }

    except Exception as e:
        return {
            "error": str(e)
        }


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

    finally:
        db.close()


@router.post("/ai/send-minutes")
async def send_minutes(data: dict):

    minutes = data.get("minutes", "")

    return {
        "message": "Minutes sent successfully",
        "minutes": minutes
    }


@router.get("/ai/health")
async def ai_health():
    return {
        "status": "AI Service Running"
    }