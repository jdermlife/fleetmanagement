from __future__ import annotations

from typing import Any

from app.services.credit_scoring.common import (
    parse_years,
    requirements_section,
    safe_text,
    to_float,
    years_since,
)


def _has_value(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return bool(safe_text(value))


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    normalized = safe_text(value).lower()
    return normalized in {"true", "yes", "1", "verified", "passed", "clear", "trusted"}


def _years_from_any(*values: Any) -> float:
    best = 0.0
    for value in values:
        best = max(best, parse_years(value), years_since(safe_text(value)))
    return best


def _requirements(payload: Any, key: str) -> dict[str, Any]:
    return requirements_section(payload, key)


def _score_identity_verification(payload: Any) -> tuple[float, dict[str, Any]]:
    supporting = _requirements(payload, "supportingDocuments")
    government_ids = _requirements(payload, "governmentIds")
    contact = _requirements(payload, "contactInformation")
    other = _requirements(payload, "otherInformation")
    due_diligence = _requirements(payload, "enhancedDueDiligence")
    fraud_verification = _requirements(payload, "fraudVerification")
    fraud_intelligence = _requirements(payload, "fraudIntelligence")

    has_national_or_passport = bool(supporting.get("philSysId")) or bool(
        supporting.get("passportIfApplicable")
    )
    has_drivers_license_or_professional_id = bool(supporting.get("driversLicense")) or any(
        keyword in safe_text(government_ids.get("otherGovernmentId")).lower()
        for keyword in ("driver", "license", "umid", "prc")
    )
    has_any_government_id = _has_value(getattr(payload, "gov_id", "")) or _has_value(
        government_ids.get("idNumber")
    ) or bool(supporting.get("validGovernmentId"))

    if has_national_or_passport:
        government_identity_score = 8.0
    elif has_drivers_license_or_professional_id:
        government_identity_score = 6.0
    elif has_any_government_id:
        government_identity_score = 4.0
    else:
        government_identity_score = 0.0

    explicit_face_match = to_float(
        fraud_verification.get("faceMatchScore")
        or fraud_verification.get("facialMatchScore")
        or getattr(payload, "face_match_score", 0.0),
        0.0,
    )
    if explicit_face_match >= 99.0:
        face_verification_score = 5.0
    elif explicit_face_match >= 95.0:
        face_verification_score = 4.0
    elif explicit_face_match >= 90.0:
        face_verification_score = 2.0
    elif explicit_face_match > 0:
        face_verification_score = 0.0
    elif other.get("recentPhotoUploaded"):
        face_verification_score = 2.0
    else:
        face_verification_score = 0.0

    liveness_result = safe_text(
        fraud_verification.get("livenessDetection")
        or fraud_verification.get("livenessResult")
        or getattr(payload, "liveness_detection_result", "")
    ).lower()
    if "pass" in liveness_result:
        liveness_score = 4.0
    elif "manual" in liveness_result or "review" in liveness_result:
        liveness_score = 2.0
    elif "fail" in liveness_result:
        liveness_score = 0.0
    elif due_diligence.get("consentIdentityVerification"):
        liveness_score = 2.0
    else:
        liveness_score = 0.0

    mobile_verified = _has_value(contact.get("mobileNumber")) or _has_value(getattr(payload, "phone", ""))
    email_verified = _has_value(contact.get("emailAddress")) or _has_value(getattr(payload, "email", ""))
    if mobile_verified and email_verified:
        contact_verification_score = 3.0
    elif mobile_verified or email_verified:
        contact_verification_score = 2.0
    else:
        contact_verification_score = 0.0

    fake_national_id = _to_bool(fraud_intelligence.get("fakeNationalId")) or _to_bool(
        fraud_verification.get("fakeNationalId")
    )
    failed_face_match = explicit_face_match > 0 and explicit_face_match < 90.0
    failed_liveness = "fail" in liveness_result
    identity_theft_indicator = _to_bool(
        fraud_intelligence.get("identityTheftIndicator")
        or getattr(payload, "identity_theft_indicator", False)
    )

    return (
        government_identity_score + face_verification_score + liveness_score + contact_verification_score,
        {
            "government_identity_score": government_identity_score,
            "face_verification_score": face_verification_score,
            "liveness_score": liveness_score,
            "contact_verification_score": contact_verification_score,
            "fake_national_id": fake_national_id,
            "failed_face_match": failed_face_match,
            "failed_liveness_detection": failed_liveness,
            "identity_theft_indicator": identity_theft_indicator,
        },
    )


def _score_document_verification(payload: Any) -> tuple[float, dict[str, Any]]:
    supporting = _requirements(payload, "supportingDocuments")
    employment = _requirements(payload, "employmentInformation")
    banking = _requirements(payload, "bankingRelationships")
    due_diligence = _requirements(payload, "enhancedDueDiligence")
    fraud_verification = _requirements(payload, "fraudVerification")
    document_analysis = _requirements(payload, "documentAnalysis")

    income_docs_status = safe_text(
        fraud_verification.get("incomeDocumentsStatus")
        or document_analysis.get("incomeDocumentsStatus")
    ).lower()
    if "verified" in income_docs_status:
        income_documents_score = 6.0
    elif "minor" in income_docs_status or "partial" in income_docs_status:
        income_documents_score = 3.0
    elif "suspicious" in income_docs_status or "forged" in income_docs_status:
        income_documents_score = 0.0
    else:
        has_income_docs = any(
            bool(supporting.get(key))
            for key in ("proofOfIncome", "certificateOfEmployment", "latestPayslips", "latestItr")
        )
        if has_income_docs and _has_value(employment.get("grossMonthlyIncome")):
            income_documents_score = 6.0
        elif has_income_docs or _has_value(due_diligence.get("sourceOfIncomeVerificationReferences")):
            income_documents_score = 3.0
        else:
            income_documents_score = 0.0

    employment_status = safe_text(
        fraud_verification.get("employmentVerificationStatus")
        or document_analysis.get("employmentVerificationStatus")
    ).lower()
    if "verified" in employment_status:
        employment_verification_score = 5.0
    elif "partial" in employment_status:
        employment_verification_score = 3.0
    elif "cannot" in employment_status or "fail" in employment_status:
        employment_verification_score = 0.0
    else:
        if _has_value(due_diligence.get("hrContactInformation")) and _has_value(
            due_diligence.get("employmentReferencePerson")
        ):
            employment_verification_score = 5.0
        elif _has_value(employment.get("employerBusinessName")):
            employment_verification_score = 3.0
        else:
            employment_verification_score = 0.0

    bank_statement_status = safe_text(
        fraud_verification.get("bankStatementVerificationStatus")
        or document_analysis.get("bankStatementVerificationStatus")
    ).lower()
    if "match" in bank_statement_status or "verified" in bank_statement_status:
        bank_statement_score = 5.0
    elif "minor" in bank_statement_status or "variance" in bank_statement_status:
        bank_statement_score = 3.0
    elif "significant" in bank_statement_status or "forged" in bank_statement_status:
        bank_statement_score = 0.0
    else:
        if bool(supporting.get("bankStatements")) and _has_value(banking.get("accountNumber")):
            bank_statement_score = 5.0
        elif bool(supporting.get("bankStatements")):
            bank_statement_score = 3.0
        else:
            bank_statement_score = 0.0

    ocr_status = safe_text(
        fraud_verification.get("ocrAnalysisStatus")
        or document_analysis.get("ocrAnalysisStatus")
        or document_analysis.get("tamperStatus")
    ).lower()
    if "no signs" in ocr_status or "clear" in ocr_status or "no tampering" in ocr_status:
        ocr_analysis_score = 4.0
    elif "minor" in ocr_status or "anomal" in ocr_status:
        ocr_analysis_score = 2.0
    elif "suspected" in ocr_status or "alter" in ocr_status or "tamper" in ocr_status:
        ocr_analysis_score = 0.0
    else:
        if bool(supporting.get("bankStatements")) or bool(supporting.get("proofOfIncome")):
            ocr_analysis_score = 2.0
        else:
            ocr_analysis_score = 0.0

    forged_payslip = "forged" in income_docs_status
    forged_bank_statement = "forged" in bank_statement_status

    return (
        income_documents_score
        + employment_verification_score
        + bank_statement_score
        + ocr_analysis_score,
        {
            "income_documents_score": income_documents_score,
            "employment_verification_score": employment_verification_score,
            "bank_statement_score": bank_statement_score,
            "ocr_analysis_score": ocr_analysis_score,
            "forged_payslip": forged_payslip,
            "forged_bank_statement": forged_bank_statement,
        },
    )


def _score_application_consistency(payload: Any) -> tuple[float, dict[str, Any]]:
    employment = _requirements(payload, "employmentInformation")
    address = _requirements(payload, "addressInformation")
    contact = _requirements(payload, "contactInformation")
    banking = _requirements(payload, "bankingRelationships")
    due_diligence = _requirements(payload, "enhancedDueDiligence")
    fraud_verification = _requirements(payload, "fraudVerification")

    app_income = max(
        to_float(getattr(payload, "monthly_income", 0.0), 0.0) + to_float(getattr(payload, "other_income", 0.0), 0.0),
        0.0,
    )
    gross_income = max(to_float(employment.get("grossMonthlyIncome"), 0.0), 0.0)
    supporting_income = max(
        to_float(employment.get("otherSourcesOfIncome"), 0.0)
        + to_float(employment.get("investmentIncome"), 0.0)
        + to_float(employment.get("businessIncome"), 0.0)
        + to_float(employment.get("pensionIncome"), 0.0),
        0.0,
    )
    reference_income = max(gross_income, app_income, supporting_income)
    income_ratio = abs(app_income - reference_income) / reference_income if reference_income > 0 else 1.0
    if reference_income > 0 and income_ratio <= 0.10:
        income_consistency_score = 6.0
    elif reference_income > 0 and income_ratio <= 0.25:
        income_consistency_score = 4.0
    else:
        income_consistency_score = 0.0

    addresses = [
        safe_text(getattr(payload, "address", "")),
        safe_text(address.get("presentAddress")),
        safe_text(address.get("permanentAddress")),
        safe_text(address.get("mailingAddress")),
    ]
    unique_addresses = {value.lower() for value in addresses if value}
    if len(unique_addresses) <= 1 and unique_addresses:
        address_consistency_score = 5.0
    elif len(unique_addresses) <= 2 and unique_addresses:
        address_consistency_score = 3.0
    else:
        address_consistency_score = 0.0

    employer_values = {
        safe_text(employment.get("employerBusinessName")).lower(),
        safe_text(due_diligence.get("hrContactInformation")).lower(),
        safe_text(due_diligence.get("employmentReferencePerson")).lower(),
        safe_text(due_diligence.get("supervisorInformation")).lower(),
    }
    employer_values.discard("")
    if len(employer_values) >= 3:
        employer_consistency_score = 5.0
    elif len(employer_values) >= 1:
        employer_consistency_score = 3.0
    else:
        employer_consistency_score = 0.0

    mobile_years = _years_from_any(contact.get("mobileYearsUsed"), due_diligence.get("mobileNumberYears"))
    email_years = _years_from_any(contact.get("emailYearsUsed"), due_diligence.get("emailYearsUsed"))
    if mobile_years >= 3.0 and email_years >= 3.0:
        contact_consistency_score = 4.0
    elif _has_value(contact.get("mobileNumber")) or _has_value(getattr(payload, "phone", "")) or _has_value(
        contact.get("emailAddress")
    ) or _has_value(getattr(payload, "email", "")):
        contact_consistency_score = 2.0
    else:
        contact_consistency_score = 0.0

    return (
        income_consistency_score
        + address_consistency_score
        + employer_consistency_score
        + contact_consistency_score,
        {
            "income_consistency_score": income_consistency_score,
            "address_consistency_score": address_consistency_score,
            "employer_consistency_score": employer_consistency_score,
            "contact_consistency_score": contact_consistency_score,
        },
    )


def _score_financial_verification(payload: Any) -> tuple[float, dict[str, Any]]:
    supporting = _requirements(payload, "supportingDocuments")
    banking = _requirements(payload, "bankingRelationships")
    employment = _requirements(payload, "employmentInformation")
    fraud_verification = _requirements(payload, "fraudVerification")

    payroll_status = safe_text(fraud_verification.get("payrollVerificationStatus")).lower()
    if "verified" in payroll_status:
        payroll_score = 5.0
    elif "partial" in payroll_status:
        payroll_score = 3.0
    elif "none" in payroll_status or "fail" in payroll_status:
        payroll_score = 0.0
    else:
        if bool(supporting.get("latestPayslips")) and _has_value(employment.get("grossMonthlyIncome")):
            payroll_score = 5.0
        elif bool(supporting.get("latestPayslips")) or bool(supporting.get("proofOfIncome")):
            payroll_score = 3.0
        else:
            payroll_score = 0.0

    ownership_status = safe_text(fraud_verification.get("bankAccountOwnershipStatus")).lower()
    if "verified" in ownership_status:
        bank_account_ownership_score = 5.0
    elif "manual" in ownership_status or "review" in ownership_status:
        bank_account_ownership_score = 3.0
    elif "fail" in ownership_status:
        bank_account_ownership_score = 0.0
    else:
        if _has_value(banking.get("accountNumber")) and _has_value(banking.get("accountType")):
            bank_account_ownership_score = 5.0
        elif _has_value(banking.get("accountNumber")):
            bank_account_ownership_score = 3.0
        else:
            bank_account_ownership_score = 0.0

    banking_years = _years_from_any(banking.get("memberSince"))
    if banking_years > 5.0:
        existing_banking_relationship_score = 5.0
    elif banking_years >= 2.0:
        existing_banking_relationship_score = 3.0
    elif banking_years > 0.0:
        existing_banking_relationship_score = 1.0
    else:
        existing_banking_relationship_score = 0.0

    return (
        payroll_score + bank_account_ownership_score + existing_banking_relationship_score,
        {
            "payroll_score": payroll_score,
            "bank_account_ownership_score": bank_account_ownership_score,
            "existing_banking_relationship_score": existing_banking_relationship_score,
        },
    )


def _score_device_and_digital_risk(payload: Any) -> tuple[float, dict[str, Any]]:
    other = _requirements(payload, "otherInformation")
    fraud_verification = _requirements(payload, "fraudVerification")
    device_risk = _requirements(payload, "deviceRisk")

    reputation = safe_text(
        device_risk.get("deviceReputation")
        or fraud_verification.get("deviceReputation")
        or getattr(payload, "device_reputation", "")
    ).lower()
    if "trusted" in reputation:
        device_reputation_score = 4.0
    elif "black" in reputation:
        device_reputation_score = 0.0
    elif reputation:
        device_reputation_score = 2.0
    elif _to_bool(other.get("deviceVerified")) or _to_bool(getattr(payload, "device_verified", False)):
        device_reputation_score = 4.0
    else:
        device_reputation_score = 2.0

    ip_risk = safe_text(
        device_risk.get("ipAddressRisk")
        or fraud_verification.get("ipAddressRisk")
        or getattr(payload, "ip_address_risk", "")
    ).lower()
    if "high" in ip_risk:
        ip_address_risk_score = 0.0
    elif "vpn" in ip_risk or "proxy" in ip_risk:
        ip_address_risk_score = 1.0
    elif ip_risk:
        ip_address_risk_score = 3.0
    else:
        ip_address_risk_score = 3.0

    device_consistency = safe_text(
        device_risk.get("deviceConsistency")
        or fraud_verification.get("deviceConsistency")
        or getattr(payload, "device_consistency", "")
    ).lower()
    if "same" in device_consistency:
        device_consistency_score = 3.0
    elif "multiple trusted" in device_consistency:
        device_consistency_score = 2.0
    elif "multiple unknown" in device_consistency:
        device_consistency_score = 0.0
    elif _to_bool(other.get("deviceVerified")):
        device_consistency_score = 2.0
    else:
        device_consistency_score = 0.0

    return (
        device_reputation_score + ip_address_risk_score + device_consistency_score,
        {
            "device_reputation_score": device_reputation_score,
            "ip_address_risk_score": ip_address_risk_score,
            "device_consistency_score": device_consistency_score,
        },
    )


def _score_fraud_intelligence(payload: Any) -> tuple[float, dict[str, Any]]:
    due_diligence = _requirements(payload, "enhancedDueDiligence")
    fraud_intelligence = _requirements(payload, "fraudIntelligence")

    watchlist_status = safe_text(
        fraud_intelligence.get("watchlistStatus")
        or fraud_intelligence.get("watchlistScreening")
        or getattr(payload, "watchlist_status", "")
    ).lower()
    if "positive" in watchlist_status or "match" in watchlist_status:
        watchlist_score = 0.0
    elif "manual" in watchlist_status or "review" in watchlist_status:
        watchlist_score = 2.0
    elif watchlist_status:
        watchlist_score = 5.0
    else:
        watchlist_score = 5.0

    fraud_record_status = safe_text(
        fraud_intelligence.get("previousFraudRecords")
        or fraud_intelligence.get("fraudRecordStatus")
        or getattr(payload, "previous_fraud_records", "")
    ).lower()
    if "confirmed" in fraud_record_status or "fraud" in fraud_record_status:
        previous_fraud_records_score = 0.0
    elif "minor" in fraud_record_status or "alert" in fraud_record_status:
        previous_fraud_records_score = 2.0
    elif fraud_record_status:
        previous_fraud_records_score = 5.0
    else:
        previous_fraud_records_score = 5.0

    velocity_status = safe_text(
        fraud_intelligence.get("applicationVelocity")
        or getattr(payload, "application_velocity", "")
    ).lower()
    if "excessive" in velocity_status:
        application_velocity_score = 0.0
    elif "multiple" in velocity_status or "recent" in velocity_status:
        application_velocity_score = 2.0
    elif velocity_status:
        application_velocity_score = 5.0
    else:
        active_loans = int(to_float(due_diligence.get("numberOfActiveLoans"), 0.0))
        application_velocity_score = 2.0 if active_loans >= 3 else 5.0

    sanctions_or_pep_match = _to_bool(
        fraud_intelligence.get("sanctionsPepMatch")
        or getattr(payload, "sanctions_pep_match", False)
    )

    return (
        watchlist_score + previous_fraud_records_score + application_velocity_score,
        {
            "watchlist_score": watchlist_score,
            "previous_fraud_records_score": previous_fraud_records_score,
            "application_velocity_score": application_velocity_score,
            "watchlist_positive_match": "positive" in watchlist_status or "match" in watchlist_status,
            "sanctions_pep_match": sanctions_or_pep_match,
        },
    )


def _risk_level_and_grade(score: float) -> tuple[str, str]:
    if score >= 95.0:
        return "Platinum", "Extremely Low Fraud Risk"
    if score >= 90.0:
        return "Gold+", "Very Low Fraud Risk"
    if score >= 80.0:
        return "Gold", "Low Fraud Risk"
    if score >= 70.0:
        return "Silver", "Acceptable"
    if score >= 60.0:
        return "Bronze", "Review Required"
    if score >= 40.0:
        return "Red", "High Fraud Risk"
    return "Black", "Critical Fraud Risk"


def compute_fraud_score(payload: Any) -> dict[str, float | str | dict[str, Any]]:
    identity_score, identity_meta = _score_identity_verification(payload)
    document_score, document_meta = _score_document_verification(payload)
    application_consistency_score, consistency_meta = _score_application_consistency(payload)
    financial_verification_score, financial_meta = _score_financial_verification(payload)
    device_risk_score, device_meta = _score_device_and_digital_risk(payload)
    fraud_intelligence_score, intelligence_meta = _score_fraud_intelligence(payload)

    total_score = round(
        identity_score
        + document_score
        + application_consistency_score
        + financial_verification_score
        + device_risk_score
        + fraud_intelligence_score,
        2,
    )

    override_action = ""
    if identity_meta["fake_national_id"]:
        override_action = "Automatic Decline"
    elif document_meta["forged_payslip"]:
        override_action = "Automatic Decline"
    elif document_meta["forged_bank_statement"]:
        override_action = "Automatic Decline"
    elif identity_meta["failed_face_match"]:
        override_action = "Automatic Decline"
    elif identity_meta["failed_liveness_detection"]:
        override_action = "Automatic Decline"
    elif identity_meta["identity_theft_indicator"]:
        override_action = "Automatic Decline"
    elif intelligence_meta["watchlist_positive_match"]:
        override_action = "Manual Investigation"
    elif intelligence_meta["sanctions_pep_match"]:
        override_action = "Enhanced Due Diligence"

    if override_action == "Automatic Decline":
        total_score = 0.0
    elif override_action == "Manual Investigation":
        total_score = min(total_score, 40.0)
    elif override_action == "Enhanced Due Diligence":
        total_score = min(total_score, 60.0)

    grade, risk_interpretation = _risk_level_and_grade(total_score)
    fraud_risk_level = (
        f"{risk_interpretation} | {override_action}"
        if override_action
        else risk_interpretation
    )

    return {
        "identity_score": round(identity_score, 2),
        "document_score": round(document_score, 2),
        "geo_location_score": round(application_consistency_score, 2),
        "device_score": round(device_risk_score, 2),
        "duplicate_application_score": round(fraud_intelligence_score, 2),
        "overall_fraud_score": total_score,
        "fraud_risk_level": fraud_risk_level,
        "fraud_flags": {
            "fraud_grade": grade,
            "override_action": override_action,
            "missing_government_id": not _has_value(getattr(payload, "gov_id", "")),
            "missing_email": not _has_value(getattr(payload, "email", "")),
            "missing_phone": not _has_value(getattr(payload, "phone", "")),
            **identity_meta,
            **document_meta,
            **consistency_meta,
            **financial_meta,
            **device_meta,
            **intelligence_meta,
        },
    }


def evaluate(payload: Any) -> dict[str, float | str | dict[str, Any]]:
    return compute_fraud_score(payload)
