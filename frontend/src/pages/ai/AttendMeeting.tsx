import { useState } from "react";

export default function AttendMeeting() {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  return (
    <div className="card">
      <h1>AI Meeting Assistant</h1>

      <div style={{ marginBottom: "20px" }}>
        <label>Meeting Title</label>
        <input
          type="text"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          placeholder="Fleet Operations Weekly Meeting"
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>Meeting Link</label>
        <input
          type="text"
          value={meetingLink}
          onChange={(e) => setMeetingLink(e.target.value)}
          placeholder="Google Meet / Zoom Link"
        />
      </div>

      <button>
        Start AI Meeting Session
      </button>
    </div>
  );
}