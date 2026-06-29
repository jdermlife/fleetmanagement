from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


@dataclass(frozen=True)
class ScoreBand:
    minimum: float
    score: float


@dataclass(frozen=True)
class GradeBand:
    minimum: float
    label: str
    risk_level: str
    decision_hint: str


GRADE_BANDS = [
    GradeBand(95, "Platinum 1", "Exceptional", "Automatic Approval / Preferred Pricing"),
    GradeBand(89, "Platinum 2", "Very Low Risk", "Automatic Approval"),
    GradeBand(83, "Gold 1", "Low Risk", "Approve"),
    GradeBand(77, "Gold 2", "Low-Moderate Risk", "Approve"),
    GradeBand(69, "Silver 1", "Moderate Risk", "Approve with Standard Terms"),
    GradeBand(61, "Silver 2", "Moderate Risk", "Approve / Manual Review"),
    GradeBand(51, "Bronze 1", "Elevated Risk", "Manual Review"),
    GradeBand(41, "Bronze 2", "High Risk", "Additional Documents / Higher Down Payment / Guarantor"),
    GradeBand(21, "Red 1", "Very High Risk", "Credit Committee Review"),
    GradeBand(-21, "Red 2", "Critical Risk", "Decline / Exception Approval Only"),
]

HIGH_DEMAND_AUTO_BRANDS = {"toyota", "honda", "mitsubishi", "ford"}
POPULAR_AUTO_BRANDS = {
    "nissan",
    "hyundai",
    "kia",
    "isuzu",
    "mazda",
    "suzuki",
    "chevrolet",
    "subaru",
    "volkswagen",
    "byd",
}
LOW_DEMAND_AUTO_BRANDS = {"geely", "mg", "chery", "foton", "gac", "jac"}
ADVERSE_KEYWORDS = {
    "delinquent",
    "default",
    "past due",
    "late payment",
    "restructure",
    "returned check",
    "gambling",
    "fraud",
    "adverse",
    "dismissed",
    "not satisfactory",
}


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def requirements_section(payload: Any, key: str) -> dict[str, Any]:
    requirements = getattr(payload, "requirements", {}) or {}
    value = requirements.get(key, {})
    return value if isinstance(value, dict) else {}


def normalize_product_type(payload: Any) -> str:
    raw_value = safe_text(getattr(payload, "product_type", ""))
    if not raw_value:
        raw_value = safe_text(requirements_section(payload, "productInformation").get("productType"))
    normalized = " ".join(raw_value.lower().split())
    mapping = {
        "home loan": "Home Loan",
        "auto loan": "Auto Loan",
        "credit card": "Credit Card",
        "credit  card": "Credit Card",
        "personal loan": "Personal Loan",
    }
    return mapping.get(normalized, "Auto Loan")


def monthly_payment(payload: Any) -> float:
    loan_amount = to_float(getattr(payload, "loan_amount", 0.0))
    interest_rate = to_float(getattr(payload, "interest_rate", 0.0))
    term_months = max(int(to_float(getattr(payload, "term_months", 0), 0)), 1)
    monthly_rate = interest_rate / 100.0 / 12.0
    if loan_amount <= 0:
        return 0.0
    if monthly_rate <= 0:
        return loan_amount / term_months
    return loan_amount * (
        monthly_rate * ((1 + monthly_rate) ** term_months)
    ) / (((1 + monthly_rate) ** term_months) - 1)


def years_since(date_value: str) -> float:
    text = safe_text(date_value)
    if not text:
        return 0.0
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = datetime.strptime(text, "%Y-%m-%d")
        except ValueError:
            return 0.0
    now = datetime.now(UTC).replace(tzinfo=parsed.tzinfo)
    return max((now - parsed).days / 365.25, 0.0)


def parse_years(value: Any) -> float:
    text = safe_text(value).lower()
    if not text:
        return 0.0

    numeric = []
    token = ""
    for char in text:
        if char.isdigit() or char == ".":
            token += char
            continue
        if token:
            numeric.append(float(token))
            token = ""
    if token:
        numeric.append(float(token))

    if numeric:
        return max(numeric)

    if "less than 1" in text or "< 1" in text:
        return 0.5
    return 0.0


def score_from_descending(value: float, bands: list[ScoreBand], fallback: float = 0.0) -> float:
    for band in bands:
        if value >= band.minimum:
            return band.score
    return fallback


def score_from_keyword(
    text: str,
    keyword_scores: list[tuple[tuple[str, ...], float]],
    fallback: float = 0.0,
) -> float:
    normalized = safe_text(text).lower()
    for keywords, score in keyword_scores:
        if any(keyword in normalized for keyword in keywords):
            return score
    return fallback


def has_adverse_signal(*values: Any) -> bool:
    haystack = " ".join(safe_text(value).lower() for value in values if safe_text(value))
    return any(keyword in haystack for keyword in ADVERSE_KEYWORDS)


def grade_for_score(total_score: float) -> GradeBand:
    for band in GRADE_BANDS:
        if total_score >= band.minimum:
            return band
    return GRADE_BANDS[-1]
