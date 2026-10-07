import os
import smtplib
from collections.abc import Sequence

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_email(
    recipient: str | Sequence[str],
    subject: str,
    body: str,
) -> None:

    server = os.getenv("SMTP_SERVER")
    port = int(os.getenv("SMTP_PORT"))

    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")

    msg = MIMEMultipart()

    msg["From"] = username
    recipients = [recipient] if isinstance(recipient, str) else list(recipient)
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject

    msg.attach(
        MIMEText(body, "plain")
    )

    smtp = smtplib.SMTP(
        server,
        port,
        timeout=float(os.getenv("SMTP_TIMEOUT_SECONDS", "15")),
    )
    try:
        smtp.starttls()
        smtp.login(username, password)
        smtp.send_message(msg, to_addrs=recipients)
    finally:
        smtp.quit()