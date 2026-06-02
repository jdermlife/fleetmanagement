import os
import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_email(
    recipient,
    subject,
    body
):

    server = os.getenv("SMTP_SERVER")
    port = int(os.getenv("SMTP_PORT"))

    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")

    msg = MIMEMultipart()

    msg["From"] = username
    msg["To"] = recipient
    msg["Subject"] = subject

    msg.attach(
        MIMEText(body, "plain")
    )

    smtp = smtplib.SMTP(
        server,
        port
    )

    smtp.starttls()

    smtp.login(
        username,
        password
    )

    smtp.send_message(msg)

    smtp.quit()