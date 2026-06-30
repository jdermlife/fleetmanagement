from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from app.services.credit_scoring.auto_loan import compute_auto_loan_collateral_breakdown
from app.services.credit_scoring_engine import compute_credit_score


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _requirements_section(payload: Any, key: str) -> dict[str, Any]:
    requirements = getattr(payload, "requirements", {}) or {}
    value = requirements.get(key, {})
    return value if isinstance(value, dict) else {}


def _product_type_for_risk(payload: Any) -> str:
    raw_value = getattr(payload, "product_type", None)
    if isinstance(raw_value, str) and raw_value.strip():
        return raw_value.strip()

    product_info = _requirements_section(payload, "productInformation")
    product_type = product_info.get("productType")
    if isinstance(product_type, str):
        return product_type.strip()

    return ""


def _normalize_customer_since(value: Any) -> date | None:
    if not value:
        return None

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value).date()
        except ValueError:
            try:
                return date.fromisoformat(value)
            except ValueError:
                return None

    return None


def _compute_relationship_score(payload: Any) -> dict[str, date | float | int | None]:
    banking = _requirements_section(payload, "bankingRelationships")
    due_diligence = _requirements_section(payload, "enhancedDueDiligence")

    number_of_accounts = 0
    for field in ("accountNumber", "creditCardNumber", "loanLender"):
        if banking.get(field):
            number_of_accounts += 1

    return {
        "customer_since": _normalize_customer_since(banking.get("memberSince")),
        "number_of_accounts": max(number_of_accounts, 1),
        "deposit_balance": _to_float(banking.get("currentBalance"), 0.0),
        "prior_loans": _to_int(due_diligence.get("numberOfActiveLoans"), 0),
        "relationship_score": 88.0,
    }


def _compute_credit_bureau_report(payload: Any, credit_scores: dict[str, Any]) -> dict[str, Any]:
    banking = _requirements_section(payload, "bankingRelationships")
    due_diligence = _requirements_section(payload, "enhancedDueDiligence")

    total_loans = _to_int(due_diligence.get("numberOfActiveLoans"), 0)
    outstanding_balance = _to_float(banking.get("loanCurrentBalance"), 0.0)

    return {
        "bureau_name": "Quant Score Bureau Proxy",
        "bureau_score": credit_scores.get("bureau_score", credit_scores["total_credit_score"]),
        "total_loans": total_loans,
        "active_loans": total_loans,
        "closed_loans": 0,
        "delinquent_accounts": 0,
        "defaulted_accounts": 0,
        "outstanding_balance": outstanding_balance,
        "report_json": {
            "source": "quant-scoring-engine",
            "version": "v1",
        },
        "report_date": datetime.now(UTC),
    }


def _compute_collateral_score(payload: Any) -> dict[str, float]:
    if _product_type_for_risk(payload).lower() == "auto loan":
        breakdown = compute_auto_loan_collateral_breakdown(payload)
        appraised_value = _to_float(getattr(payload, "appraised_value", 0.0))
        loan_amount = _to_float(getattr(payload, "loan_amount", 0.0))
        if appraised_value > 0 and loan_amount > 0:
            ltv_percent = (loan_amount / appraised_value) * 100.0
            ltv_score = round(max(0.0, min(100.0, 100.0 - ltv_percent)), 2)
        else:
            ltv_score = round((breakdown["value_score"] / 7.0) * 100.0, 2)

        marketability_score = round((breakdown["marketability_score"] / 3.0) * 100.0, 2)
        age_score = round((breakdown["age_score"] / 4.0) * 100.0, 2)
        type_score = round((breakdown["type_score"] / 4.0) * 100.0, 2)
        asset_quality_score = round((age_score + type_score) / 2.0, 2)

        requirements = _requirements_section(payload, "collateralAssetDetails")
        insurance_present = bool(requirements.get("insuranceProviderCompany")) and bool(
            requirements.get("policyNumber")
        )
        insurance_score = 100.0 if insurance_present else 40.0
        overall_collateral_score = round(
            (ltv_score + asset_quality_score + marketability_score + insurance_score) / 4.0,
            2,
        )

        return {
            "ltv_score": ltv_score,
            "asset_quality_score": asset_quality_score,
            "marketability_score": marketability_score,
            "insurance_score": insurance_score,
            "overall_collateral_score": overall_collateral_score,
        }

    if _product_type_for_risk(payload).lower() == "home loan":
        collateral = _requirements_section(payload, "collateralInformation")
        property_value = max(
            _to_float(collateral.get("propertyAppraisedValue"), 0.0),
            _to_float(getattr(payload, "appraised_value", 0.0), 0.0),
        )
        loan_amount = _to_float(getattr(payload, "loan_amount", 0.0))
        if property_value > 0 and loan_amount > 0:
            ltv_percent = (loan_amount / property_value) * 100.0
            ltv_score = round(max(0.0, min(100.0, 100.0 - ltv_percent)), 2)
        else:
            ltv_score = 82.0

        marketability_value = str(collateral.get("propertyMarketabilityCategory", "")).lower()
        if "subdivision" in marketability_value or "condominium" in marketability_value:
            marketability_score = 100.0
        elif "lowcost" in marketability_value or "low cost" in marketability_value:
            marketability_score = 57.14
        elif "outside" in marketability_value:
            marketability_score = 0.0
        else:
            marketability_score = 70.0

        unit_model_value = str(collateral.get("houseUnitModelCategory", "")).lower()
        if "single detached" in unit_model_value:
            asset_quality_score = 100.0
        elif "single attached" in unit_model_value or "condominium" in unit_model_value:
            asset_quality_score = 66.67
        elif "townhouse" in unit_model_value:
            asset_quality_score = 33.33
        elif "row house" in unit_model_value:
            asset_quality_score = 0.0
        else:
            asset_quality_score = 66.67

        insurance_score = 79.0
        overall_collateral_score = round(
            (ltv_score + marketability_score + asset_quality_score + insurance_score) / 4.0,
            2,
        )

        return {
            "ltv_score": ltv_score,
            "asset_quality_score": asset_quality_score,
            "marketability_score": marketability_score,
            "insurance_score": insurance_score,
            "overall_collateral_score": overall_collateral_score,
        }

    return {
        "ltv_score": 82.0,
        "asset_quality_score": 80.0,
        "marketability_score": 81.0,
        "insurance_score": 79.0,
        "overall_collateral_score": 81.0,
    }


def _normalize_score_100(value: Any) -> float:
    numeric = _to_float(value, 0.0)
    if numeric <= 0:
        return 0.0
    if numeric <= 100:
        return numeric
    return min(numeric / 10.0, 100.0)


def evaluate(
    payload: Any,
    credit_scores: dict[str, Any],
    fraud_scores: dict[str, Any] | None = None,
) -> dict[str, Any]:
    relationship_scores = _compute_relationship_score(payload)
    credit_bureau_reports = _compute_credit_bureau_report(payload, credit_scores)
    collateral_scores = _compute_collateral_score(payload)
    fraud_score = _normalize_score_100((fraud_scores or {}).get("overall_fraud_score"))
    credit_score = _normalize_score_100(credit_scores.get("total_credit_score"))
    collateral_score = _normalize_score_100(collateral_scores.get("overall_collateral_score"))
    relationship_score = _normalize_score_100(
        relationship_scores.get("relationship_score")
    )
    overall_credit_risk_score = round(
        (
            (credit_score * 0.50)
            + (relationship_score * 0.20)
            + (collateral_score * 0.20)
            + (fraud_score * 0.10)
        ),
        2,
    )

    return {
        "relationship_scores": relationship_scores,
        "credit_bureau_reports": credit_bureau_reports,
        "collateral_scores": collateral_scores,
        "overall_credit_risk_score": overall_credit_risk_score,
        "model_version": "ai-orchestrator-v1",
    }


def compute_credit_risk_package(payload: Any) -> dict[str, Any]:
    credit_scores = compute_credit_score(payload)
    risk_package = evaluate(payload, credit_scores)
    return {
        "credit_scores": credit_scores,
        "relationship_scores": risk_package["relationship_scores"],
        "credit_bureau_reports": risk_package["credit_bureau_reports"],
        "collateral_scores": risk_package["collateral_scores"],
    }
