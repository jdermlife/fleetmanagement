from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.fastapi_auth import require_roles
from app.models.fuel_logs import FuelLog
from app.models.gps_tracking import GpsTrackingRecord
from app.models.insurance_records import InsuranceRecord
from app.models.maintenance_logs import MaintenanceRecord
from app.models.vehicles import Vehicle

router = APIRouter()


def _serialize_timestamp(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _serialize_vehicle(row: Vehicle) -> dict[str, object]:
    return {
        "id": row.id,
        "make": row.make,
        "model": row.model,
        "year": row.year,
        "createdAt": _serialize_timestamp(row.created_at),
        "updatedAt": _serialize_timestamp(row.updated_at),
    }


def _serialize_fuel_log(row: FuelLog) -> dict[str, object]:
    return {
        "id": row.id,
        "date": row.date.isoformat(),
        "vehicle": row.vehicle,
        "fuelCard": row.fuel_card,
        "liters": row.liters,
        "amount": row.amount,
        "notes": row.notes,
        "theftSuspected": bool(row.theft_suspected),
        "abnormalRefill": bool(row.abnormal_refill),
        "createdAt": _serialize_timestamp(row.created_at),
        "updatedAt": _serialize_timestamp(row.updated_at),
    }


def _serialize_maintenance_record(row: MaintenanceRecord) -> dict[str, object]:
    return {
        "id": row.id,
        "vehicleId": row.vehicle_id,
        "vehicleLabel": row.vehicle_label,
        "maintenanceType": row.maintenance_type,
        "serviceDate": row.service_date.isoformat(),
        "nextServiceDate": row.next_service_date.isoformat() if row.next_service_date else None,
        "odometerKm": row.odometer_km,
        "vendor": row.vendor,
        "estimatedCost": row.estimated_cost,
        "status": row.status,
        "notes": row.notes,
        "createdAt": _serialize_timestamp(row.created_at),
    }


def _serialize_insurance_record(row: InsuranceRecord) -> dict[str, object]:
    return {
        "id": row.id,
        "vehicleId": row.vehicle_id,
        "vehicleLabel": row.vehicle_label,
        "provider": row.provider,
        "policyNumber": row.policy_number,
        "coverageType": row.coverage_type,
        "premiumAmount": row.premium_amount,
        "insuredValue": row.insured_value,
        "startDate": row.start_date.isoformat(),
        "endDate": row.end_date.isoformat(),
        "status": row.status,
        "contactPerson": row.contact_person,
        "notes": row.notes,
        "createdAt": _serialize_timestamp(row.created_at),
    }


def _serialize_gps_record(row: GpsTrackingRecord) -> dict[str, object]:
    return {
        "id": row.id,
        "vehicleId": row.vehicle_id,
        "vehicleLabel": row.vehicle_label,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "speedKph": row.speed_kph,
        "heading": row.heading,
        "status": row.status,
        "routeLabel": row.route_label,
        "geofence": row.geofence,
        "recordedAt": _serialize_timestamp(row.recorded_at),
        "createdAt": _serialize_timestamp(row.created_at),
    }


class VehiclePayload(BaseModel):
    make: str = Field(min_length=1)
    model: str = Field(min_length=1)
    year: int = Field(ge=1900)


class FuelLogPayload(BaseModel):
    date: str
    vehicle: str = Field(min_length=1)
    fuelCard: str = Field(min_length=1)
    liters: float = Field(gt=0)
    amount: float = Field(ge=0)
    notes: str = ""
    theftSuspected: bool = False
    abnormalRefill: bool = False


class MaintenanceRecordPayload(BaseModel):
    vehicleId: int | None = None
    vehicleLabel: str = Field(min_length=1)
    maintenanceType: str = Field(min_length=1)
    serviceDate: str
    nextServiceDate: str | None = None
    odometerKm: float = Field(ge=0)
    vendor: str = ""
    estimatedCost: float = Field(ge=0)
    status: str = Field(min_length=1)
    notes: str = ""


class InsuranceRecordPayload(BaseModel):
    vehicleId: int | None = None
    vehicleLabel: str = Field(min_length=1)
    provider: str = Field(min_length=1)
    policyNumber: str = Field(min_length=1)
    coverageType: str = Field(min_length=1)
    premiumAmount: float = Field(ge=0)
    insuredValue: float = Field(gt=0)
    startDate: str
    endDate: str
    status: str = Field(min_length=1)
    contactPerson: str = ""
    notes: str = ""


class GpsTrackingPayload(BaseModel):
    vehicleId: int | None = None
    vehicleLabel: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speedKph: float = Field(ge=0)
    heading: str = ""
    status: str = Field(min_length=1)
    routeLabel: str = ""
    geofence: str = ""
    recordedAt: str | None = None


def _parse_date(raw: str, field_name: str):
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must use YYYY-MM-DD format.",
        ) from exc


def _parse_timestamp(raw: str | None):
    if not raw:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recorded at must be a valid ISO timestamp.",
        ) from exc


@router.get("/vehicles", dependencies=[Depends(require_roles("admin", "manager", "viewer"))])
def list_vehicles(db: Session = Depends(get_db)):
    rows = db.query(Vehicle).order_by(Vehicle.year.desc(), Vehicle.make.asc(), Vehicle.model.asc()).all()
    return [_serialize_vehicle(row) for row in rows]


@router.post("/vehicles", dependencies=[Depends(require_roles("admin", "manager"))], status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehiclePayload, db: Session = Depends(get_db)):
    current_year = datetime.now(timezone.utc).year + 1
    if payload.year > current_year:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Year must be between 1900 and {current_year}.",
        )

    row = Vehicle(
        make=payload.make.strip(),
        model=payload.model.strip(),
        year=payload.year,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_vehicle(row)


@router.put("/vehicles/{vehicle_id}", dependencies=[Depends(require_roles("admin", "manager"))])
def update_vehicle(vehicle_id: int, payload: VehiclePayload, db: Session = Depends(get_db)):
    row = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    current_year = datetime.now(timezone.utc).year + 1
    if payload.year > current_year:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Year must be between 1900 and {current_year}.",
        )

    row.make = payload.make.strip()
    row.model = payload.model.strip()
    row.year = payload.year
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _serialize_vehicle(row)


@router.delete("/vehicles/{vehicle_id}", dependencies=[Depends(require_roles("admin", "manager"))])
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    row = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/fuel-logs", dependencies=[Depends(require_roles("admin", "manager", "viewer"))])
def list_fuel_logs(db: Session = Depends(get_db)):
    rows = db.query(FuelLog).order_by(FuelLog.date.desc(), FuelLog.id.desc()).all()
    return [_serialize_fuel_log(row) for row in rows]


@router.post("/fuel-logs", dependencies=[Depends(require_roles("admin", "manager"))], status_code=status.HTTP_201_CREATED)
def create_fuel_log(payload: FuelLogPayload, db: Session = Depends(get_db)):
    row = FuelLog(
        date=_parse_date(payload.date, "Date"),
        vehicle=payload.vehicle.strip(),
        fuel_card=payload.fuelCard.strip(),
        liters=payload.liters,
        amount=payload.amount,
        notes=payload.notes.strip(),
        theft_suspected=payload.theftSuspected,
        abnormal_refill=payload.abnormalRefill,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_fuel_log(row)


@router.put("/fuel-logs/{fuel_log_id}", dependencies=[Depends(require_roles("admin", "manager"))])
def update_fuel_log(fuel_log_id: int, payload: FuelLogPayload, db: Session = Depends(get_db)):
    row = db.query(FuelLog).filter(FuelLog.id == fuel_log_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fuel log not found.")

    row.date = _parse_date(payload.date, "Date")
    row.vehicle = payload.vehicle.strip()
    row.fuel_card = payload.fuelCard.strip()
    row.liters = payload.liters
    row.amount = payload.amount
    row.notes = payload.notes.strip()
    row.theft_suspected = payload.theftSuspected
    row.abnormal_refill = payload.abnormalRefill
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _serialize_fuel_log(row)


@router.delete("/fuel-logs/{fuel_log_id}", dependencies=[Depends(require_roles("admin", "manager"))])
def delete_fuel_log(fuel_log_id: int, db: Session = Depends(get_db)):
    row = db.query(FuelLog).filter(FuelLog.id == fuel_log_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fuel log not found.")

    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/maintenance-records", dependencies=[Depends(require_roles("admin", "manager", "viewer"))])
def list_maintenance_records(db: Session = Depends(get_db)):
    rows = db.query(MaintenanceRecord).order_by(MaintenanceRecord.service_date.desc(), MaintenanceRecord.id.desc()).all()
    return [_serialize_maintenance_record(row) for row in rows]


@router.post("/maintenance-records", dependencies=[Depends(require_roles("admin", "manager"))], status_code=status.HTTP_201_CREATED)
def create_maintenance_record(payload: MaintenanceRecordPayload, db: Session = Depends(get_db)):
    row = MaintenanceRecord(
        vehicle_id=payload.vehicleId,
        vehicle_label=payload.vehicleLabel.strip(),
        maintenance_type=payload.maintenanceType.strip(),
        service_date=_parse_date(payload.serviceDate, "Service date"),
        next_service_date=_parse_date(payload.nextServiceDate, "Next service date") if payload.nextServiceDate else None,
        odometer_km=payload.odometerKm,
        vendor=payload.vendor.strip(),
        estimated_cost=payload.estimatedCost,
        status=payload.status.strip(),
        notes=payload.notes.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_maintenance_record(row)


@router.get("/insurance-records", dependencies=[Depends(require_roles("admin", "manager", "viewer"))])
def list_insurance_records(db: Session = Depends(get_db)):
    rows = db.query(InsuranceRecord).order_by(InsuranceRecord.end_date.asc(), InsuranceRecord.id.desc()).all()
    return [_serialize_insurance_record(row) for row in rows]


@router.post("/insurance-records", dependencies=[Depends(require_roles("admin", "manager"))], status_code=status.HTTP_201_CREATED)
def create_insurance_record(payload: InsuranceRecordPayload, db: Session = Depends(get_db)):
    start_date = _parse_date(payload.startDate, "Start date")
    end_date = _parse_date(payload.endDate, "End date")
    if end_date < start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be on or after the start date.")

    row = InsuranceRecord(
        vehicle_id=payload.vehicleId,
        vehicle_label=payload.vehicleLabel.strip(),
        provider=payload.provider.strip(),
        policy_number=payload.policyNumber.strip(),
        coverage_type=payload.coverageType.strip(),
        premium_amount=payload.premiumAmount,
        insured_value=payload.insuredValue,
        start_date=start_date,
        end_date=end_date,
        status=payload.status.strip(),
        contact_person=payload.contactPerson.strip(),
        notes=payload.notes.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_insurance_record(row)


@router.get("/gps-tracking", dependencies=[Depends(require_roles("admin", "manager", "viewer"))])
def list_gps_tracking(db: Session = Depends(get_db)):
    rows = db.query(GpsTrackingRecord).order_by(GpsTrackingRecord.recorded_at.desc(), GpsTrackingRecord.id.desc()).all()
    return [_serialize_gps_record(row) for row in rows]


@router.post("/gps-tracking", dependencies=[Depends(require_roles("admin", "manager"))], status_code=status.HTTP_201_CREATED)
def create_gps_tracking(payload: GpsTrackingPayload, db: Session = Depends(get_db)):
    row = GpsTrackingRecord(
        vehicle_id=payload.vehicleId,
        vehicle_label=payload.vehicleLabel.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        speed_kph=payload.speedKph,
        heading=payload.heading.strip(),
        status=payload.status.strip(),
        route_label=payload.routeLabel.strip(),
        geofence=payload.geofence.strip(),
        recorded_at=_parse_timestamp(payload.recordedAt),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_gps_record(row)
