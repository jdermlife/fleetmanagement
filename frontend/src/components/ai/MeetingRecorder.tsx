import { useState, useRef } from "react";

export default function MeetingRecorder() {
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef<any>(null);
  const chunksRef = useRef<any[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      chunksRef.current.push(event.data);
    };

    recorder.start();

    mediaRecorderRef.current = recorder;

    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: "audio/webm"
      });

      const formData = new FormData();

      formData.append("audio", blob);

      await fetch(
        `${import.meta.env.VITE_API_URL}/ai/transcribe`,
        {
          method: "POST",
          body: formData
        }
      );
    };

    setRecording(false);
  };

  return (
    <div>
      {!recording ? (
        <button onClick={startRecording}>
          Start Recording
        </button>
      ) : (
        <button onClick={stopRecording}>
          Stop Recording
        </button>
      )}
    </div>
  );
}