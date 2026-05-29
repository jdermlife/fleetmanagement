from fastapi import APIRouter, UploadFile, File
from openai import OpenAI
from dotenv import load_dotenv
import tempfile
import os

load_dotenv()
router = APIRouter()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


@router.post("/ai/transcribe")
async def transcribe(audio: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    with open(tmp_path, "rb") as audio_file:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )

    os.remove(tmp_path)

    return {
        "transcript": result.text
    }


@router.post("/ai/minutes")
async def meeting_minutes(data: dict):

    transcript = data.get("transcript", "")

    if not transcript:
        return {
            "error": "Transcript is required"
        }

    prompt = f"""
Generate the following:

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

    return {
        "minutes": response.choices[0].message.content
    }


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