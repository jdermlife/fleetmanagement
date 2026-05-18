from pydantic import BaseModel

class BorrowerCreate(BaseModel):

    full_name: str

    dsr_percent: float

    net_disposable_income: float