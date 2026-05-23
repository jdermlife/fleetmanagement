from pydantic import BaseModel

class DriverCreate(BaseModel):

    firstName: str

    lastName: str

    licenseNumber: str

    phone: str

    email: str

    status: str