from fastapi import APIRouter
from sqlalchemy import desc

from app.database import SessionLocal
from app.models.driver import Driver
from app.schemas.driver_schema import DriverCreate

router = APIRouter()

@router.get("/drivers")
def get_drivers():

    db = SessionLocal()

    drivers = db.query(Driver).order_by(desc(Driver.id)).all()

    return [
        {
            "id": driver.id,
            "firstName": driver.first_name,
            "lastName": driver.last_name,
            "licenseNumber": driver.license_number,
            "phone": driver.phone,
            "email": driver.email,
            "status": driver.status,
            "createdAt": str(driver.created_at)
        }
        for driver in drivers
    ]


@router.post("/drivers")
def create_driver(data: DriverCreate):

    db = SessionLocal()

    driver = Driver(
        first_name=data.firstName,
        last_name=data.lastName,
        license_number=data.licenseNumber,
        phone=data.phone,
        email=data.email,
        status=data.status
    )

    db.add(driver)

    db.commit()

    db.refresh(driver)

    return {
        "id": driver.id,
        "firstName": driver.first_name,
        "lastName": driver.last_name,
        "licenseNumber": driver.license_number,
        "phone": driver.phone,
        "email": driver.email,
        "status": driver.status,
        "createdAt": str(driver.created_at)
    }