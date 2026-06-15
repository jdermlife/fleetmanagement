from app.database import engine, Base

from app.models.driver import Driver
from app.models.borrower import Borrower
from app.models.loan_application import LoanApplication

print("Creating tables...")

Base.metadata.create_all(bind=engine)

print("TABLES CREATED SUCCESSFULLY")