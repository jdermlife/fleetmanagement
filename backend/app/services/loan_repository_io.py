from __future__ import annotations

import csv
import io
import json
import secrets
import string
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

from app.models.loan_application import LoanApplication


UPSERT_FIELDS: list[str] = [
    "application_no",
    "status",
    "product_type",
    "borrower_name",
    "email",
    "phone",
    "gov_id",
    "address",
    "monthly_income",
    "other_income",
    "debt_obligations",
    "loan_amount",
    "term_months",
    "interest_rate",
    "purpose",
    "vehicle_info",
    "appraised_value",
    "committee_remarks",
    "executive_approval",
    "dti",
    "dsr",
    "ltv",
    "scorecard_total",
    "ai_probability",
    "created_at",
    "requirements",
]
 
STATUS_ALIASES = {
    "DRAFT": "Draft",
    "SUBMITTED": "Submitted",
    "UNDER REVIEW": "Under Review",
    "CREDIT REVIEW": "Credit Review",
    "REVIEWED": "Reviewed",
    "APPROVED": "Approved",
    "REJECTED": "Rejected",
    "RELEASED": "Released",
    "CANCELLED": "Cancelled",
}

EXPORT_FIELDS: list[str] = [column.name for column in LoanApplication.__table__.columns]
EXISTING_RECORD_LOOKUP_CHUNK_SIZE = 1000

HEADER_ALIASES: dict[str, str] = {
    "application no": "application_no",
    "application_no": "application_no",
    "application number": "application_no",
    "status": "status",
    "product": "product_type",
    "product type": "product_type",
    "product_type": "product_type",
    "borrower": "borrower_name",
    "borrower name": "borrower_name",
    "borrower_name": "borrower_name",
    "email": "email",
    "phone": "phone",
    "gov id": "gov_id",
    "gov_id": "gov_id",
    "government id": "gov_id",
    "address": "address",
    "monthly income": "monthly_income",
    "monthly_income": "monthly_income",
    "other income": "other_income",
    "other_income": "other_income",
    "debt obligations": "debt_obligations",
    "debt_obligations": "debt_obligations",
    "loan amount": "loan_amount",
    "loan_amount": "loan_amount",
    "term": "term_months",
    "term months": "term_months",
    "term_months": "term_months",
    "interest rate": "interest_rate",
    "interest_rate": "interest_rate",
    "purpose": "purpose",
    "collateral": "vehicle_info",
    "vehicle info": "vehicle_info",
    "vehicle_info": "vehicle_info",
    "appraised value": "appraised_value",
    "appraised_value": "appraised_value",
    "committee remarks": "committee_remarks",
    "committee_remarks": "committee_remarks",
    "executive approval": "executive_approval",
    "executive_approval": "executive_approval",
    "dti": "dti",
    "dsr": "dsr",
    "ltv": "ltv",
    "scorecard": "scorecard_total",
    "scorecard_total": "scorecard_total",
    "ai probability": "ai_probability",
    "ai_probability": "ai_probability",
    "created at": "created_at",
    "created_at": "created_at",
    "requirements": "requirements",
}

FLOAT_FIELDS = {
    "monthly_income",
    "other_income",
    "debt_obligations",
    "loan_amount",
    "interest_rate",
    "appraised_value",
    "dti",
    "dsr",
    "ltv",
    "ai_probability",
}

INT_FIELDS = {"term_months", "scorecard_total"}

STRING_FIELDS = {
    "application_no",
    "status",
    "product_type",
    "borrower_name",
    "email",
    "phone",
    "gov_id",
    "address",
    "purpose",
    "vehicle_info",
    "committee_remarks",
}


def normalize_header(header: str) -> str:
    key = header.strip().lower().replace("-", " ").replace("_", " ")
    return HEADER_ALIASES.get(key, header.strip().lower().replace(" ", "_"))


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    normalized = str(value).strip().lower()
    return normalized in {"1", "true", "yes", "y", "approved"}


def parse_float(value: Any) -> float:
    if value in (None, ""):
        return 0.0

    normalized = str(value).replace(",", "").replace("PHP", "").replace("$", "").strip()
    try:
        return float(normalized)
    except ValueError:
        return 0.0


def parse_int(value: Any) -> int:
    if value in (None, ""):
        return 0

    normalized = str(value).replace(",", "").strip()
    try:
        return int(float(normalized))
    except ValueError:
        return 0


def parse_datetime_value(value: Any) -> datetime | None:
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    normalized = str(value).strip()

    for parser in (
        datetime.fromisoformat,
        lambda raw: datetime.strptime(raw, "%Y-%m-%d"),
        lambda raw: datetime.strptime(raw, "%m/%d/%Y"),
    ):
        try:
            parsed = parser(normalized)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return None


def parse_requirements(value: Any) -> dict[str, Any]:
    if value in (None, ""):
        return {}

    if isinstance(value, dict):
        return value

    try:
        parsed = json.loads(str(value))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}
 
def normalize_status(value: Any) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        return "Draft"
 
    return STATUS_ALIASES.get(normalized.upper(), normalized)


def row_to_application_payload(row: dict[str, Any]) -> dict[str, Any]:
    normalized_row = {
        normalize_header(key): value for key, value in row.items() if key is not None
    }

    payload: dict[str, Any] = {
        "application_no": str(normalized_row.get("application_no", "")).strip(),
        "status": normalize_status(normalized_row.get("status", "Draft")),
        "product_type": str(normalized_row.get("product_type", "Auto Loan") or "Auto Loan").strip() or "Auto Loan",
        "executive_approval": parse_bool(normalized_row.get("executive_approval")),
        "requirements": parse_requirements(normalized_row.get("requirements")),
        "created_at": parse_datetime_value(normalized_row.get("created_at")),
    }

    for field in STRING_FIELDS:
        if field in payload:
            continue
        payload[field] = str(normalized_row.get(field, "") or "").strip()

    for field in FLOAT_FIELDS:
        payload[field] = parse_float(normalized_row.get(field))

    for field in INT_FIELDS:
        payload[field] = parse_int(normalized_row.get(field))

    return payload


def generate_application_no(db, reserved_numbers: set[str]) -> str:
    alphabet = string.ascii_uppercase + string.digits

    for _ in range(100):
        candidate = "APP-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if candidate in reserved_numbers:
            continue

        existing_record = (
            db.query(LoanApplication)
            .filter(LoanApplication.application_no == candidate)
            .first()
        )
        if existing_record is None:
            reserved_numbers.add(candidate)
            return candidate

    raise ValueError("Unable to generate a unique application number for import.")


def chunk_values(values: list[str], size: int) -> list[list[str]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def load_existing_loan_applications(
    db,
    application_numbers: list[str],
) -> dict[str, LoanApplication]:
    unique_numbers = list(dict.fromkeys(number for number in application_numbers if number))
    existing_records: dict[str, LoanApplication] = {}

    for chunk in chunk_values(unique_numbers, EXISTING_RECORD_LOOKUP_CHUNK_SIZE):
        records = (
            db.query(LoanApplication)
            .filter(LoanApplication.application_no.in_(chunk))
            .all()
        )
        for record in records:
            existing_records[record.application_no] = record

    return existing_records


def parse_csv_rows(file_bytes: bytes) -> list[dict[str, Any]]:
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def get_excel_cell_value(
    cell: ET.Element,
    shared_strings: list[str],
    namespace: dict[str, str],
) -> Any:
    cell_type = cell.attrib.get("t")
    value_node = cell.find("main:v", namespace)

    if cell_type == "inlineStr":
        inline_node = cell.find("main:is/main:t", namespace)
        return inline_node.text if inline_node is not None else ""

    if value_node is None or value_node.text is None:
        return ""

    raw_value = value_node.text

    if cell_type == "s":
        index = int(raw_value)
        return shared_strings[index] if 0 <= index < len(shared_strings) else ""

    return raw_value


def column_letters_to_index(reference: str) -> int:
    letters = "".join(character for character in reference if character.isalpha()).upper()
    index = 0
    for character in letters:
        index = index * 26 + (ord(character) - 64)
    return max(index - 1, 0)


def parse_xlsx_rows(file_bytes: bytes) -> list[dict[str, Any]]:
    namespace = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    }

    with ZipFile(io.BytesIO(file_bytes)) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_tree = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(node.itertext())
                for node in shared_tree.findall("main:si", namespace)
            ]

        workbook_tree = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = workbook_tree.find("main:sheets/main:sheet", namespace)
        if sheet is None:
            return []

        relationship_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        if relationship_id is None:
            return []

        relationships_tree = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = None
        for relationship in relationships_tree.findall("rel:Relationship", namespace):
            if relationship.attrib.get("Id") == relationship_id:
                target = relationship.attrib.get("Target")
                break

        if not target:
            return []

        worksheet_path = f"xl/{target.lstrip('/')}"
        sheet_tree = ET.fromstring(archive.read(worksheet_path))
        rows: list[list[Any]] = []

        for row_node in sheet_tree.findall("main:sheetData/main:row", namespace):
            row_values: list[Any] = []
            for cell in row_node.findall("main:c", namespace):
                cell_reference = cell.attrib.get("r", "")
                column_index = column_letters_to_index(cell_reference)
                while len(row_values) <= column_index:
                    row_values.append("")
                row_values[column_index] = get_excel_cell_value(
                    cell,
                    shared_strings,
                    namespace,
                )
            rows.append(row_values)

    if not rows:
        return []

    headers = [str(header).strip() for header in rows[0]]
    records: list[dict[str, Any]] = []

    for values in rows[1:]:
        if not any(str(value).strip() for value in values):
            continue
        row = {
            headers[index]: values[index] if index < len(values) else ""
            for index in range(len(headers))
            if headers[index]
        }
        records.append(row)

    return records


def parse_upload_rows(filename: str, file_bytes: bytes) -> list[dict[str, Any]]:
    lower_name = filename.lower()
    if lower_name.endswith(".csv"):
        return parse_csv_rows(file_bytes)
    if lower_name.endswith(".xlsx"):
        return parse_xlsx_rows(file_bytes)
    raise ValueError("Only .csv and .xlsx files are supported.")


def upsert_loan_applications(
    db,
    rows: list[dict[str, Any]],
) -> dict[str, int]:
    payloads = [row_to_application_payload(raw_row) for raw_row in rows]

    inserted = 0
    updated = 0
    skipped = 0
    reserved_numbers: set[str] = set()
    existing_records = load_existing_loan_applications(
        db,
        [payload["application_no"] for payload in payloads if payload.get("application_no")],
    )

    for payload in payloads:
        application_no = payload["application_no"] or generate_application_no(
            db,
            reserved_numbers,
        )
        payload["application_no"] = application_no

        reserved_numbers.add(application_no)
        record = existing_records.get(application_no)

        if record is None:
            record = LoanApplication(application_no=application_no)
            db.add(record)
            existing_records[application_no] = record
            inserted += 1
        else:
            updated += 1

        for field in UPSERT_FIELDS:
            if field == "created_at":
                if payload.get("created_at") is not None:
                    record.created_at = payload["created_at"]
                continue
            if field == "requirements":
                record.requirements = payload.get("requirements", {})
                continue
            setattr(record, field, payload.get(field))

    db.commit()

    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
    }


def normalize_export_value(field: str, value: Any) -> str:
    if value is None:
        return ""
    if field == "requirements":
        return json.dumps(value, ensure_ascii=True)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def build_export_rows(records: list[LoanApplication]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for record in records:
        rows.append(
            {
                field: normalize_export_value(field, getattr(record, field, ""))
                for field in EXPORT_FIELDS
            }
        )
    return rows


def generate_csv_bytes(records: list[LoanApplication]) -> bytes:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=EXPORT_FIELDS)
    writer.writeheader()
    for row in build_export_rows(records):
        writer.writerow(row)
    return output.getvalue().encode("utf-8")


def build_shared_strings(values: list[str]) -> tuple[dict[str, int], list[str]]:
    string_to_index: dict[str, int] = {}
    ordered_strings: list[str] = []

    for value in values:
        if value not in string_to_index:
            string_to_index[value] = len(ordered_strings)
            ordered_strings.append(value)

    return string_to_index, ordered_strings


def generate_xlsx_bytes(records: list[LoanApplication]) -> bytes:
    rows = build_export_rows(records)
    matrix: list[list[str]] = [EXPORT_FIELDS]
    matrix.extend([[row.get(field, "") for field in EXPORT_FIELDS] for row in rows])

    all_strings = [value for row in matrix for value in row]
    shared_string_map, ordered_strings = build_shared_strings(all_strings)

    sheet_rows: list[str] = []
    for row_index, row in enumerate(matrix, start=1):
        cells: list[str] = []
        for col_index, value in enumerate(row, start=1):
            column_name = ""
            current = col_index
            while current > 0:
                current, remainder = divmod(current - 1, 26)
                column_name = chr(65 + remainder) + column_name
            shared_index = shared_string_map[value]
            cells.append(
                f'<c r="{column_name}{row_index}" t="s"><v>{shared_index}</v></c>'
            )
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    shared_strings_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        f'count="{len(all_strings)}" uniqueCount="{len(ordered_strings)}">'
        + "".join(f"<si><t>{escape(value)}</t></si>" for value in ordered_strings)
        + "</sst>"
    )

    worksheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData>'
        "</worksheet>"
    )

    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="LoanRepository" sheetId="1" '
        'r:id="rId1"/></sheets></workbook>'
    )

    workbook_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" '
        'Target="sharedStrings.xml"/>'
        '</Relationships>'
    )

    root_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        '</Relationships>'
    )

    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        '</Types>'
    )

    buffer = io.BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", root_rels_xml)
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        archive.writestr("xl/worksheets/sheet1.xml", worksheet_xml)
        archive.writestr("xl/sharedStrings.xml", shared_strings_xml)

    return buffer.getvalue()


def apply_repository_filters(query, status: str | None, date_from: str | None, date_to: str | None):
    if status and status != "All":
        query = query.filter(LoanApplication.status == normalize_status(status))

    if date_from:
        parsed_from = date.fromisoformat(date_from)
        query = query.filter(
            LoanApplication.created_at
            >= datetime.combine(parsed_from, time.min, tzinfo=timezone.utc)
        )

    if date_to:
        parsed_to = date.fromisoformat(date_to)
        query = query.filter(
            LoanApplication.created_at
            < datetime.combine(parsed_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )

    return query
