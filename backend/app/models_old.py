from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class Borrower(Base):

    __tablename__ = "borrowers"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String)

    dsr_percent = Column(Float)

    net_disposable_income = Column(Float)