from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

def generate_minutes_pdf(filename, meeting):

    doc = SimpleDocTemplate(filename)

    styles = getSampleStyleSheet()

    content = [
        Paragraph(meeting.meeting_title, styles["Title"]),
        Paragraph(meeting.summary, styles["BodyText"]),
        Paragraph(meeting.action_items, styles["BodyText"]),
        Paragraph(meeting.transcript, styles["BodyText"]),
    ]

    doc.build(content)

    return filename