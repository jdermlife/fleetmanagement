import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function MeetingHistory() {
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/ai/meetings`
      );

      setMeetings(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="container-fluid">

      <h2 className="mb-4">
        Meeting History
      </h2>

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>ID</th>
            <th>Meeting Title</th>
            <th>Meeting Date</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {meetings.map((meeting) => (
            <tr key={meeting.id}>
              <td>{meeting.id}</td>

              <td>{meeting.meeting_title}</td>

              <td>{meeting.meeting_date}</td>

              <td>{meeting.created_at}</td>

              <td>
                <Link
                  to={`/ai/history/${meeting.id}`}
                  className="btn btn-primary btn-sm"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}