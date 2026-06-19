import { useState } from "react";

interface TranscriptResponse {
transcript: string;
}

interface MinutesResponse {
id?: number;
summary?: string;
message?: string;
}

const API_URL =
import.meta.env.VITE_API_URL ||
"https://fleetmanagement-api.onrender.com";

export default function AttendMeeting(): JSX.Element {
const [meetingTitle, setMeetingTitle] = useState<string>("");
const [audioFile, setAudioFile] = useState<File | null>(null);
const [transcript, setTranscript] = useState<string>("");
const [minutes, setMinutes] = useState<string>("");
const [loading, setLoading] = useState<boolean>(false);

const generateMinutes = async (): Promise<void> => {
if (!audioFile) {
alert("Please select an audio file.");
return;
}


try {
  setLoading(true);

  const formData = new FormData();
  formData.append("audio", audioFile);

  const transcriptResponse = await fetch(
    `${API_URL}/ai/transcribe`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!transcriptResponse.ok) {
    throw new Error("Failed to transcribe audio");
  }

  const transcriptData: TranscriptResponse =
    await transcriptResponse.json();

  setTranscript(transcriptData.transcript);

  const minutesResponse = await fetch(
    `${API_URL}/ai/minutes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meeting_title: meetingTitle,
        meeting_date: new Date().toISOString(),
        transcript: transcriptData.transcript,
      }),
    }
  );

  if (!minutesResponse.ok) {
    throw new Error("Failed to generate minutes");
  }

  const minutesData: MinutesResponse =
    await minutesResponse.json();

  setMinutes(minutesData.summary || "");
} catch (error) {
  console.error(error);
  alert("Failed to generate meeting minutes.");
} finally {
  setLoading(false);
}


};

return ( <div className="card"> <h1>AI Meeting Assistant</h1>

```
  <div style={{ marginBottom: "20px" }}>
    <label>Meeting Title</label>

    <input
      type="text"
      value={meetingTitle}
      onChange={(e) =>
        setMeetingTitle(e.target.value)
      }
      placeholder="Fleet Operations Weekly Meeting"
    />
  </div>

  <div style={{ marginBottom: "20px" }}>
    <label>Upload Recording</label>

    <input
      type="file"
      accept="audio/*"
      onChange={(e) =>
        setAudioFile(
          e.target.files?.[0] || null
        )
      }
    />
  </div>

  <button
    onClick={generateMinutes}
    disabled={loading}
  >
    {loading
      ? "Generating..."
      : "Generate Minutes"}
  </button>

  {transcript && (
    <div style={{ marginTop: "30px" }}>
      <h2>Transcript</h2>

      <textarea
        value={transcript}
        readOnly
        rows={10}
        style={{ width: "100%" }}
      />
    </div>
  )}

  {minutes && (
    <div style={{ marginTop: "30px" }}>
      <h2>Meeting Minutes</h2>

      <textarea
        value={minutes}
        readOnly
        rows={15}
        style={{ width: "100%" }}
      />
    </div>
  )}
</div>


);
}
