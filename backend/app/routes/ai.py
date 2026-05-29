# app/api/ai.py

from fastapi import APIRouter, UploadFile, File
from openai import OpenAI
import tempfile
import os

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
@ai_bp.route("/ai/minutes", methods=["POST"])
def meeting_minutes():

    transcript = request.json["transcript"]

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
                "role":"user",
                "content":prompt
            }
        ]
    )

    return jsonify({
        "minutes":
            response.choices[0].message.content
    })
@ai_bp.route("/ai/send-minutes", methods=["POST"])
def send_minutes():

    minutes = request.json["minutes"]

    # Send email via SMTP

    return jsonify({
        "message":"Minutes sent"
    })