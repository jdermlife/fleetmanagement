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


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _requirements_section(payload: Any, key: str) -> dict[str, Any]:
    requirements = getattr(payload, "requirements", {}) or {}
    value = requirements.get(key, {})
    return value if isinstance(value, dict) else {}


def _normalize_product_type(payload: Any) -> str:
    raw_value = _safe_text(getattr(payload, "product_type", ""))
    if not raw_value:
        raw_value = _safe_text(_requirements_section(payload, "productInformation").get("productType"))
    normalized = " ".join(raw_value.lower().split())
    mapping = {
        "home loan": "Home Loan",
        "auto loan": "Auto Loan",
        "credit card": "Credit Card",
        "credit  card": "Credit Card",
        "personal loan": "Personal Loan",
    }
    return mapping.get(normalized, "Auto Loan")


def _monthly_payment(payload: Any) -> float:
    loan_amount = _to_float(getattr(payload, "loan_amount", 0.0))
    interest_rate = _to_float(getattr(payload, "interest_rate", 0.0))
    term_months = max(int(_to_float(getattr(payload, "term_months", 0), 0)), 1)
    monthly_rate = interest_rate / 100.0 / 12.0
    if loan_amount <= 0:
        return 0.0
    if monthly_rate <= 0:
        return loan_amount / term_months
    return loan_amount * (
        monthly_rate * ((1 + monthly_rate) ** term_months)
    ) / (((1 + monthly_rate) ** term_months) - 1)


def _years_since(date_value: str) -> float:
    text = _safe_text(date_value)
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


def _parse_years(value: Any) -> float:
    text = _safe_text(value).lower()
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


def _score_from_descending(value: float, bands: list[ScoreBand], fallback: float = 0.0) -> float:
    for band in bands:
        if value >= band.minimum:
            return band.score
    return fallback


def _score_from_keyword(text: str, keyword_scores: list[tuple[tuple[str, ...], float]], fallback: float = 0.0) -> float:
    normalized = _safe_text(text).lower()
    for keywords, score in keyword_scores:
        if any(keyword in normalized for keyword in keywords):
            return score
    return fallback


def _has_adverse_signal(*values: Any) -> bool:
    haystack = " ".join(_safe_text(value).lower() for value in values if _safe_text(value))
    return any(keyword in haystack for keyword in ADVERSE_KEYWORDS)


def _grade_for_score(total_score: float) -> GradeBand:
    for band in GRADE_BANDS:
        if total_score >= band.minimum:
            return band
    return GRADE_BANDS[-1]


def _score_capacity(payload: Any) -> float:
    applicant = _requirements_section(payload, "applicantPersonal")
    banking = _requirements_section(payload, "bankingRelationships")
    monthly_income = _to_float(getattr(payload, "monthly_income", 0.0))
    other_income = _to_float(getattr(payload, "other_income", 0.0))
    debt_obligations = _to_float(getattr(payload, "debt_obligations", 0.0))
    total_income = max(monthly_income + other_income, 0.0)
    payment = _monthly_payment(payload)
    amortization_ratio = (payment / total_income * 100.0) if total_income > 0 else 100.0
    marital_status = _safe_text(applicant.get("maritalStatus")).lower()
    married = "married" in marital_status

    if married:
        dti_score = _score_from_descending(
            100.0 - amortization_ratio,
            [
                ScoreBand(80.0, 8.0),
                ScoreBand(70.0, 6.0),
                ScoreBand(60.0, 4.0),
                ScoreBand(50.0, 2.0),
            ],
        )
    else:
        dti_score = _score_from_descending(
            100.0 - amortization_ratio,
            [
                ScoreBand(80.0, 4.0),
                ScoreBand(70.0, 3.0),
                ScoreBand(60.0, 2.0),
            ],
        )

    disposable_income = total_income - debt_obligations - payment
    disposable_score = _score_from_descending(
        disposable_income,
        [
            ScoreBand(100000.0, 6.0),
            ScoreBand(80000.0, 5.0),
            ScoreBand(60000.0, 4.0),
            ScoreBand(40000.0, 2.0),
        ],
    )

    household_members = max(int(_to_float(applicant.get("numberOfDependents"), 0.0)), 0)
    household_score = {
        0: 6.0,
        1: 5.0,
        2: 4.0,
        3: 3.0,
        4: 2.0,
    }.get(household_members, 0.0)

    avg_daily_balance = _to_float(banking.get("currentBalance"), 0.0)
    average_balance_score = _score_from_descending(
        avg_daily_balance,
        [
            ScoreBand(100000.0, 5.0),
            ScoreBand(10000.0, 3.0),
        ],
    )

    return dti_score + disposable_score + household_score + average_balance_score


def _score_character(payload: Any) -> float:
    banking = _requirements_section(payload, "bankingRelationships")
    due_diligence = _requirements_section(payload, "enhancedDueDiligence")
    supporting = _requirements_section(payload, "supportingDocuments")

    prior_loans = int(_to_float(due_diligence.get("numberOfActiveLoans"), 0.0))
    adverse = _has_adverse_signal(
        due_diligence.get("previousLoanRestructuringDisclosures"),
        due_diligence.get("priorBankingRelationships"),
        due_diligence.get("characterAndIntegrityAssessmentAnswers"),
        due_diligence.get("spendingBehaviorQuestionnaire"),
    )

    has_credit_history = prior_loans > 0 or bool(_safe_text(banking.get("creditCardNumber"))) or bool(_safe_text(banking.get("loanLender")))
    if adverse:
        borrowing_score = -10.0
    elif has_credit_history:
        borrowing_score = 10.0
    else:
        borrowing_score = 0.0

    current_balance = _to_float(banking.get("currentBalance"), 0.0)
    if adverse and current_balance <= 0:
        deposit_score = -5.0
    elif current_balance >= 100000.0:
        deposit_score = 5.0
    elif current_balance > 0 or _safe_text(banking.get("accountNumber")):
        deposit_score = 3.0
    else:
        deposit_score = 0.0

    utility_docs_present = any(
        bool(supporting.get(key))
        for key in ("utilityBill", "waterBill", "internetBill", "bankStatements")
    )
    if adverse:
        utility_score = -6.0
    elif utility_docs_present:
        utility_score = 6.0
    elif has_credit_history:
        utility_score = 3.0
    else:
        utility_score = 0.0

    lifestyle_score = 0.0 if adverse else 4.0
    return borrowing_score + deposit_score + utility_score + lifestyle_score


def _score_condition(payload: Any) -> float:
    employment = _requirements_section(payload, "employmentInformation")
    address = _requirements_section(payload, "addressInformation")

    employment_status = _safe_text(employment.get("employmentStatus")).lower()
    if any(keyword in employment_status for keyword in ("abroad", "overseas", "foreign", "ofw")):
        employment_score = 4.0
    elif employment_status:
        employment_score = 8.0
    else:
        employment_score = 0.0

    service_years = max(
        _parse_years(employment.get("totalYearsWorking")),
        _years_since(_safe_text(employment.get("dateHired"))),
    )
    employer_years = service_years
    employer_score = _score_from_descending(
        employer_years,
        [
            ScoreBand(10.0, 7.0),
            ScoreBand(5.0, 5.0),
            ScoreBand(3.0, 3.0),
        ],
    )
    service_score = _score_from_descending(
        service_years,
        [
            ScoreBand(5.0, 5.0),
            ScoreBand(3.0, 3.0),
            ScoreBand(1.0, 1.0),
        ],
    )
    stay_years = _parse_years(address.get("lengthOfStay"))
    stay_score = _score_from_descending(
        stay_years,
        [
            ScoreBand(5.0, 5.0),
            ScoreBand(3.0, 3.0),
            ScoreBand(1.0, 1.0),
        ],
    )

    return employment_score + employer_score + service_score + stay_score


def _score_home_collateral(payload: Any) -> float:
    collateral = _requirements_section(payload, "collateralInformation")
    applicant = _requirements_section(payload, "otherInformation")
    product = _requirements_section(payload, "productInformation")

    property_descriptor = " ".join(
        filter(
            None,
            [
                _safe_text(product.get("homeCollateralType")),
                _safe_text(collateral.get("propertyAddress")),
            ],
        )
    ).lower()
    marketability_score = _score_from_keyword(
        property_descriptor,
        [
            (("subdivision", "condominium", "condo"), 7.0),
            (("lowcost", "low cost"), 4.0),
        ],
        fallback=0.0 if not property_descriptor else 4.0,
    )

    property_value = max(
        _to_float(collateral.get("propertyAppraisedValue"), 0.0),
        _to_float(getattr(payload, "appraised_value", 0.0), 0.0),
    )
    if property_value >= 3000000.0:
        value_score = 7.0
    elif property_value >= 1000000.0:
        value_score = 5.0
    elif property_value >= 300000.0:
        value_score = 3.0
    elif property_value > 0:
        value_score = 1.0
    else:
        value_score = 0.0

    unit_model_score = _score_from_keyword(
        property_descriptor,
        [
            (("single detached",), 6.0),
            (("single attached", "condominium", "condo"), 4.0),
            (("townhouse",), 2.0),
            (("row house",), 0.0),
        ],
        fallback=0.0 if not property_descriptor else 4.0,
    )

    home_ownership = _safe_text(applicant.get("homeOwnership")).lower()
    if any(keyword in home_ownership for keyword in ("owner", "owned", "mortgaged")):
        collateral_type_score = 5.0
    elif property_descriptor:
        collateral_type_score = 3.0
    else:
        collateral_type_score = 0.0

    return marketability_score + value_score + unit_model_score + collateral_type_score


def _score_auto_collateral(payload: Any) -> float:
    collateral = _requirements_section(payload, "collateralAssetDetails")
    product = _requirements_section(payload, "productInformation")

    brand = _safe_text(collateral.get("brand") or collateral.get("maker")).lower()
    if brand in HIGH_DEMAND_AUTO_BRANDS:
        marketability_score = 7.0
    elif brand in POPULAR_AUTO_BRANDS:
        marketability_score = 5.0
    elif brand in LOW_DEMAND_AUTO_BRANDS:
        marketability_score = 3.0
    else:
        marketability_score = 0.0 if not brand else 3.0

    vehicle_value = max(
        _to_float(collateral.get("appraisedValue"), 0.0),
        _to_float(product.get("autoSellingPrice"), 0.0),
        _to_float(getattr(payload, "appraised_value", 0.0), 0.0),
    )
    if vehicle_value > 2500000.0:
        value_score = 7.0
    elif vehicle_value >= 1500001.0:
        value_score = 5.0
    elif vehicle_value >= 800001.0:
        value_score = 3.0
    elif vehicle_value >= 300001.0:
        value_score = 1.0
    else:
        value_score = 0.0

    year_text = _safe_text(collateral.get("year") or product.get("autoYearModel"))
    current_year = datetime.now(UTC).year
    vehicle_year = int(_to_float(year_text, 0.0)) if year_text else 0
    vehicle_age = max(current_year - vehicle_year, 0) if vehicle_year else 99
    if vehicle_age <= 0:
        age_score = 6.0
    elif vehicle_age <= 3:
        age_score = 4.0
    elif vehicle_age <= 6:
        age_score = 2.0
    else:
        age_score = 0.0

    vehicle_type = _safe_text(collateral.get("assetType") or product.get("autoVehicleClassification")).lower()
    type_score = _score_from_keyword(
        vehicle_type,
        [
            (("passenger", "sedan", "hatchback"), 5.0),
            (("suv", "mpv", "pickup"), 4.0),
            (("commercial", "van", "light truck"), 3.0),
            (("heavy equipment", "specialized"), 1.0),
            (("salvage", "rebuilt", "unregistered"), 0.0),
        ],
        fallback=0.0 if not vehicle_type else 3.0,
    )

    return marketability_score + value_score + age_score + type_score


def _score_credit_card_capital(payload: Any) -> float:
    banking = _requirements_section(payload, "bankingRelationships")
    monthly_income = max(_to_float(getattr(payload, "monthly_income", 0.0), 0.0), 1.0)
    requested_limit = max(
        _to_float(getattr(payload, "loan_amount", 0.0), 0.0),
        _to_float(banking.get("creditLimit"), 0.0),
    )
    available_limit = _to_float(banking.get("creditLimit"), 0.0)
    outstanding_balance = _to_float(banking.get("outstandingBalance"), 0.0)

    if available_limit > 0:
        utilization_ratio = (outstanding_balance / available_limit) * 100.0
        if utilization_ratio <= 30.0:
            utilization_score = 7.0
        elif utilization_ratio <= 50.0:
            utilization_score = 5.0
        elif utilization_ratio <= 75.0:
            utilization_score = 3.0
        else:
            utilization_score = 0.0
    else:
        utilization_score = 0.0

    relationship_years = _years_since(_safe_text(banking.get("memberSince")))
    has_card_relationship = bool(_safe_text(banking.get("creditCardNumber")))
    if has_card_relationship and relationship_years > 5.0:
        card_relationship_score = 7.0
    elif has_card_relationship and relationship_years >= 2.0:
        card_relationship_score = 5.0
    elif has_card_relationship:
        card_relationship_score = 3.0
    else:
        card_relationship_score = 0.0

    products_count = sum(
        1
        for value in (
            banking.get("accountNumber"),
            banking.get("creditCardNumber"),
            banking.get("loanLender"),
        )
        if _safe_text(value)
    )
    current_balance = _to_float(banking.get("currentBalance"), 0.0)
    if products_count >= 2 and current_balance > 0:
        banking_score = 6.0
    elif current_balance > 0:
        banking_score = 4.0
    elif products_count > 0:
        banking_score = 2.0
    else:
        banking_score = 0.0

    requested_multiple = requested_limit / monthly_income if monthly_income > 0 else 99.0
    if requested_multiple <= 2.0:
        limit_score = 5.0
    elif requested_multiple <= 3.0:
        limit_score = 3.0
    elif requested_multiple > 3.0:
        limit_score = 1.0
    else:
        limit_score = 0.0
    if requested_limit <= 0:
        limit_score = 0.0

    return utilization_score + card_relationship_score + banking_score + limit_score


def _score_personal_loan_capital(payload: Any) -> float:
    banking = _requirements_section(payload, "bankingRelationships")
    employment = _requirements_section(payload, "employmentInformation")

    current_balance = _to_float(banking.get("currentBalance"), 0.0)
    if current_balance > 500000.0:
        savings_score = 7.0
    elif current_balance >= 200000.0:
        savings_score = 5.0
    elif current_balance >= 50000.0:
        savings_score = 3.0
    else:
        savings_score = 0.0

    income_years = max(
        _parse_years(employment.get("totalYearsWorking")),
        _years_since(_safe_text(employment.get("dateHired"))),
    )
    income_stability_score = _score_from_descending(
        income_years,
        [
            ScoreBand(5.0, 7.0),
            ScoreBand(3.0, 5.0),
            ScoreBand(1.0, 3.0),
        ],
    )

    monthly_expenses = max(_to_float(employment.get("monthlyLivingExpenses"), 0.0), 1.0)
    liquid_assets = (
        current_balance
        + max(_to_float(employment.get("investmentIncome"), 0.0), 0.0)
        + max(_to_float(employment.get("businessIncome"), 0.0), 0.0)
        + max(_to_float(employment.get("pensionIncome"), 0.0), 0.0)
    )
    months_of_coverage = liquid_assets / monthly_expenses if monthly_expenses > 0 else 0.0
    emergency_score = _score_from_descending(
        months_of_coverage,
        [
            ScoreBand(12.0, 6.0),
            ScoreBand(6.0, 4.0),
            ScoreBand(3.0, 2.0),
        ],
    )

    secondary_sources = 0
    for numeric_value in (
        employment.get("otherSourcesOfIncome"),
        employment.get("investmentIncome"),
        employment.get("businessIncome"),
        employment.get("pensionIncome"),
    ):
        if _to_float(numeric_value, 0.0) > 0:
            secondary_sources += 1
    if _safe_text(employment.get("otherIncome")):
        secondary_sources = max(secondary_sources, 1)

    if secondary_sources >= 2:
        secondary_income_score = 5.0
    elif secondary_sources == 1:
        secondary_income_score = 3.0
    else:
        secondary_income_score = 0.0

    return savings_score + income_stability_score + emergency_score + secondary_income_score


def compute_credit_score(payload: Any) -> dict[str, float | str]:
    product_type = _normalize_product_type(payload)
    capacity_score = _score_capacity(payload)
    character_score = _score_character(payload)
    conditions_score = _score_condition(payload)

    if product_type == "Home Loan":
        capital_score = 0.0
        collateral_score = _score_home_collateral(payload)
    elif product_type == "Auto Loan":
        capital_score = 0.0
        collateral_score = _score_auto_collateral(payload)
    elif product_type == "Credit Card":
        capital_score = _score_credit_card_capital(payload)
        collateral_score = 0.0
    else:
        capital_score = _score_personal_loan_capital(payload)
        collateral_score = 0.0

    scorecard_total = round(
        capacity_score + character_score + capital_score + collateral_score + conditions_score,
        2,
    )
    bureau_score = round(min(850.0, max(300.0, 300.0 + (scorecard_total * 5.5))), 2)
    grade = _grade_for_score(scorecard_total)

    return {
        "character_score": round(character_score, 2),
        "capacity_score": round(capacity_score, 2),
        "capital_score": round(capital_score, 2),
        "collateral_score": round(collateral_score, 2),
        "conditions_score": round(conditions_score, 2),
        "bureau_score": bureau_score,
        "internal_score": round(scorecard_total, 2),
        "total_credit_score": round(scorecard_total, 2),
        "credit_grade": grade.label,
        "model_version": f"product-scorecard-v1:{product_type}",
    }


def evaluate(application: Any) -> dict[str, float | str]:
    return compute_credit_score(application)
