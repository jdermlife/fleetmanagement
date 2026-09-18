from __future__ import annotations

import json
from datetime import date
from typing import Any, Callable


PROFILE_COLUMN_NAMES = (
    "last_name",
    "first_name",
    "middle_name",
    "date_of_birth",
    "place_of_birth",
    "age",
    "gender",
    "citizenship",
    "number_of_dependents",
    "marital_status",
    "mothers_maiden_name",
    "mobile_number",
    "home_phone_number",
    "tin",
    "sss_gsis_number",
    "other_government_id",
    "id_number",
    "issue_date",
    "expiry_date",
    "present_address",
    "permanent_address",
    "mailing_address",
    "length_of_stay",
    "home_ownership",
    "educational_attainment",
    "number_of_vehicles_owned",
    "recent_photo_uploaded",
    "employment_status",
    "employer_business_name",
    "office_address",
    "occupation",
    "position",
    "nature_of_work_business",
    "date_hired",
    "office_phone_number",
    "previous_employer",
    "total_years_working",
    "gross_monthly_income",
    "monthly_living_expenses",
    "other_sources_of_income",
    "investment_income",
    "business_income",
    "pension_income",
    "insurance",
    "registration",
    "property_address",
    "registered_owner",
    "lot_number",
    "block_number",
    "tct_cct_number",
    "spouse_name",
    "spouse_date_of_birth",
    "spouse_place_of_birth",
    "spouse_citizenship",
    "spouse_mobile_number",
    "spouse_present_address",
    "spouse_employer_business_name",
    "spouse_office_address",
    "spouse_occupation",
    "spouse_position",
    "spouse_nature_of_work",
    "spouse_years_with_employer",
    "spouse_previous_employer",
    "spouse_total_years_working",
    "spouse_gross_monthly_income",
    "spouse_monthly_expenses",
    "spouse_other_income_sources",
    "credit_card_issuer",
    "credit_card_number",
    "credit_limit",
    "outstanding_balance",
    "member_since",
    "bank_branch",
    "account_type",
    "account_number",
    "current_balance",
    "loan_lender",
    "loan_type",
    "loan_current_balance",
    "loan_monthly_amortization",
    "credit_officer",
    "branch_manager",
    "credit_committee",
    "bank_account",
    "disbursement_account_number",
    "disbursement_date",
    "booking_date",
    "start_repayment_date",
    "first_payment_date",
    "all_required_documents_provided",
    "all_signatures_collected",
    "credit_committee_approved",
    "executive_approval_obtained",
    "collateral_documentation_ready",
    "co_borrower_name",
    "co_borrower_relationship",
    "co_borrower_monthly_income",
    "guarantor_name",
    "guarantor_mobile",
    "guarantor_address",
    "guarantor_relationship",
    "guarantor_monthly_income",
    "enhanced_due_diligence",
    "identity_verification_status",
    "document_verification_status",
    "banking_verification_status",
    "device_verification_status",
    "questionnaire_responses",
    "asset_details",
    "liability_details",
    "additional_loan_details",
    "bank_account_details",
    "credit_history_details",
    "financial_goal_target_amount",
    "financial_goal_target_period",
    "financial_goal_target_period_unit",
)


_MISSING = object()


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _items(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _integer(value: Any) -> int | None:
    number = _number(value)
    return int(number) if number is not None else None


def _boolean(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _date(value: Any) -> date | None:
    text = _text(value)
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _json_text(value: Any) -> str | None:
    if not value:
        return None
    return json.dumps(value, ensure_ascii=True, sort_keys=True)


def _first_present(*values: Any) -> Any:
    for value in values:
        if value is not _MISSING:
            return value
    return _MISSING


def profile_column_values(requirements: Any) -> dict[str, Any]:
    source = _mapping(requirements)
    build_profile = _mapping(source.get("buildProfile"))
    values = _mapping(build_profile.get("values"))

    result: dict[str, Any] = {}

    def add(
        column: str,
        section_name: str,
        section_key: str,
        *profile_keys: str,
        converter: Callable[[Any], Any] = _text,
    ) -> None:
        section = _mapping(source.get(section_name))
        section_value = section.get(section_key, _MISSING)
        profile_value = _MISSING
        for key in profile_keys:
            if key in values:
                profile_value = values[key]
                break
        value = _first_present(section_value, profile_value)
        if value is not _MISSING:
            result[column] = converter(value)

    personal = {
        "last_name": ("lastName", ()),
        "first_name": ("firstName", ()),
        "middle_name": ("middleName", ()),
        "date_of_birth": ("dateOfBirth", ("dateOfBirth",)),
        "place_of_birth": ("placeOfBirth", ("placeOfBirth",)),
        "age": ("age", ("age",)),
        "gender": ("gender", ("gender",)),
        "citizenship": ("citizenship", ("citizenship",)),
        "number_of_dependents": ("numberOfDependents", ("dependents",)),
        "marital_status": ("maritalStatus", ("civilStatus",)),
        "mothers_maiden_name": ("mothersMaidenName", ()),
    }
    for column, (key, fallbacks) in personal.items():
        converter = _date if column == "date_of_birth" else _integer if column in {"age", "number_of_dependents"} else _text
        add(column, "applicantPersonal", key, *fallbacks, converter=converter)

    for column, key, fallback in (
        ("mobile_number", "mobileNumber", "mobileNumber"),
        ("home_phone_number", "homePhoneNumber", "homePhoneNumber"),
    ):
        add(column, "contactInformation", key, fallback)

    for column, key, fallback, converter in (
        ("tin", "tin", "tin", _text),
        ("sss_gsis_number", "sssGsisNumber", "sssGsis", _text),
        ("other_government_id", "otherGovernmentId", "otherGovernmentId", _text),
        ("id_number", "idNumber", "otherGovernmentIdNumber", _text),
        ("issue_date", "issueDate", "idIssueDate", _date),
        ("expiry_date", "expiryDate", "idExpiryDate", _date),
    ):
        add(column, "governmentIds", key, fallback, converter=converter)

    for column, key, fallback in (
        ("present_address", "presentAddress", "address"),
        ("permanent_address", "permanentAddress", "permanentAddress"),
        ("mailing_address", "mailingAddress", "mailingAddress"),
        ("length_of_stay", "lengthOfStay", "lengthOfStay"),
    ):
        add(column, "addressInformation", key, fallback)

    for column, key, fallback, converter in (
        ("home_ownership", "homeOwnership", "homeOwnership", _text),
        ("educational_attainment", "educationalAttainment", "education", _text),
        ("number_of_vehicles_owned", "numberOfVehiclesOwned", "numberOfVehiclesOwned", _integer),
        ("recent_photo_uploaded", "recentPhotoUploaded", "recentPhotoUploaded", _boolean),
    ):
        add(column, "otherInformation", key, fallback, converter=converter)

    employment_map = (
        ("employment_status", "employmentStatus", ("employmentStatus",), _text),
        ("employer_business_name", "employerBusinessName", ("employerName", "employmentHistory"), _text),
        ("office_address", "officeAddress", ("officeAddress",), _text),
        ("occupation", "occupation", ("occupation",), _text),
        ("position", "position", ("position",), _text),
        ("nature_of_work_business", "natureOfWorkBusiness", ("natureOfWorkBusiness",), _text),
        ("date_hired", "dateHired", ("dateHired",), _date),
        ("office_phone_number", "officePhoneNumber", ("officePhoneNumber",), _text),
        ("previous_employer", "previousEmployer", ("previousEmployer",), _text),
        ("total_years_working", "totalYearsWorking", ("totalYearsWorking",), _text),
        ("gross_monthly_income", "grossMonthlyIncome", ("monthlyIncome",), _number),
        ("monthly_living_expenses", "monthlyLivingExpenses", ("monthlyExpenses",), _number),
        ("other_sources_of_income", "otherSourcesOfIncome", ("otherIncome",), _text),
        ("investment_income", "investmentIncome", ("investmentIncome",), _number),
        ("business_income", "businessIncome", ("businessIncome",), _number),
        ("pension_income", "pensionIncome", ("pensionIncome",), _number),
    )
    for column, key, fallbacks, converter in employment_map:
        add(column, "employmentInformation", key, *fallbacks, converter=converter)

    collateral = _mapping(source.get("collateralAssetDetails"))
    insurance_value = _first_present(
        collateral.get("insuranceProviderCompany", _MISSING),
        values.get("insurance", _MISSING),
        values.get("insuranceProviderCompany", _MISSING),
    )
    if insurance_value is not _MISSING:
        result["insurance"] = _text(insurance_value)
    registration_value = _first_present(values.get("registration", _MISSING), collateral.get("orNumber", _MISSING))
    if registration_value is not _MISSING:
        result["registration"] = _text(registration_value)

    for column, key, fallback in (
        ("property_address", "propertyAddress", "propertyAddress"),
        ("registered_owner", "registeredOwner", "registeredOwner"),
        ("lot_number", "lotNumber", "lotNumber"),
        ("block_number", "blockNumber", "blockNumber"),
        ("tct_cct_number", "tctCctNumber", "tctCctNumber"),
    ):
        add(column, "collateralInformation", key, fallback)

    spouse_map = (
        ("spouse_name", "fullName", "spouseFullName", _text),
        ("spouse_date_of_birth", "dateOfBirth", "spouseDateOfBirth", _date),
        ("spouse_place_of_birth", "placeOfBirth", "spousePlaceOfBirth", _text),
        ("spouse_citizenship", "citizenship", "spouseCitizenship", _text),
        ("spouse_mobile_number", "mobileNumber", "spouseMobileNumber", _text),
        ("spouse_present_address", "presentAddress", "spousePresentAddress", _text),
        ("spouse_employer_business_name", "employerBusinessName", "spouseEmployerBusinessName", _text),
        ("spouse_office_address", "officeAddress", "spouseOfficeAddress", _text),
        ("spouse_occupation", "occupation", "spouseOccupation", _text),
        ("spouse_position", "position", "spousePosition", _text),
        ("spouse_nature_of_work", "natureOfWork", "spouseNatureOfWork", _text),
        ("spouse_years_with_employer", "yearsWithEmployer", "spouseYearsWithEmployer", _text),
        ("spouse_previous_employer", "previousEmployer", "spousePreviousEmployer", _text),
        ("spouse_total_years_working", "totalYearsWorking", "spouseTotalYearsWorking", _text),
        ("spouse_gross_monthly_income", "grossMonthlyIncome", "spouseGrossMonthlyIncome", _number),
        ("spouse_monthly_expenses", "monthlyExpenses", "spouseMonthlyExpenses", _number),
        ("spouse_other_income_sources", "otherIncomeSources", "spouseOtherIncomeSources", _text),
    )
    for column, key, fallback, converter in spouse_map:
        add(column, "spouseInformation", key, fallback, converter=converter)

    banking_map = (
        ("credit_card_issuer", "creditCardIssuer", _text),
        ("credit_card_number", "creditCardNumber", _text),
        ("credit_limit", "creditLimit", _number),
        ("outstanding_balance", "outstandingBalance", _number),
        ("member_since", "memberSince", _date),
        ("bank_branch", "bankBranch", _text),
        ("account_type", "accountType", _text),
        ("account_number", "accountNumber", _text),
        ("current_balance", "currentBalance", _number),
        ("loan_lender", "loanLender", _text),
        ("loan_type", "loanType", _text),
        ("loan_current_balance", "loanCurrentBalance", _number),
        ("loan_monthly_amortization", "loanMonthlyAmortization", _number),
    )
    for column, key, converter in banking_map:
        add(column, "bankingRelationships", key, key, converter=converter)

    editor_state = _mapping(source.get("editorState"))
    routing = _mapping(editor_state.get("routing"))
    disbursement = _mapping(editor_state.get("disbursement"))
    for column, key in (("credit_officer", "creditOfficer"), ("branch_manager", "branchManager"), ("credit_committee", "creditCommittee")):
        if key in routing:
            result[column] = _text(routing[key])
    for column, key, converter in (
        ("bank_account", "bankAccount", _text),
        ("disbursement_account_number", "accountNumber", _text),
        ("disbursement_date", "disbursementDate", _date),
        ("booking_date", "bookingDate", _date),
        ("start_repayment_date", "startRepaymentDate", _date),
        ("first_payment_date", "firstPaymentDate", _date),
    ):
        if key in disbursement:
            result[column] = converter(disbursement[key])

    checklist = _mapping(_mapping(source.get("releaseReadiness")).get("finalChecklist"))
    for column, key in (
        ("all_required_documents_provided", "allRequiredDocumentsProvided"),
        ("all_signatures_collected", "allSignaturesCollected"),
        ("credit_committee_approved", "creditCommitteeApproved"),
        ("executive_approval_obtained", "executiveApprovalObtained"),
        ("collateral_documentation_ready", "collateralDocumentationReady"),
    ):
        if key in checklist:
            result[column] = _boolean(checklist[key])

    co_borrowers = _items(source.get("coBorrowers")) or _items(build_profile.get("coBorrowers"))
    if co_borrowers:
        first = co_borrowers[0]
        result.update({
            "co_borrower_name": _text(first.get("name")),
            "co_borrower_relationship": _text(first.get("relationship")),
            "co_borrower_monthly_income": _number(first.get("monthlyIncome")),
        })

    guarantors = _items(build_profile.get("guarantors"))
    if guarantors:
        first = guarantors[0]
        result.update({
            "guarantor_name": _text(first.get("name")),
            "guarantor_mobile": _text(first.get("mobileNumber")),
            "guarantor_address": _text(first.get("presentAddress")),
            "guarantor_relationship": _text(first.get("relationship")),
            "guarantor_monthly_income": _number(first.get("monthlyIncome")),
        })

    due_diligence = _mapping(source.get("enhancedDueDiligence"))
    fraud_verification = _mapping(source.get("fraudVerification"))
    device_risk = _mapping(source.get("deviceRisk"))
    psychometric = _mapping(source.get("psychometricAssessment"))
    if due_diligence:
        result["enhanced_due_diligence"] = _json_text(due_diligence)
    if fraud_verification:
        result["identity_verification_status"] = _text(fraud_verification.get("livenessDetection"))
        result["document_verification_status"] = _text(fraud_verification.get("incomeDocumentsStatus"))
        result["banking_verification_status"] = _text(fraud_verification.get("bankStatementVerificationStatus"))
    if device_risk:
        result["device_verification_status"] = _text(device_risk.get("deviceReputation"))
    if psychometric:
        result["questionnaire_responses"] = psychometric

    asset_details = {
        "collateral": collateral,
        "additionalCollaterals": build_profile.get("additionalCollaterals", []),
        "propertyDeclarations": build_profile.get("propertyDeclarations", []),
        "financialInvestments": build_profile.get("financialInvestments", []),
    }
    if any(asset_details.values()):
        result["asset_details"] = asset_details
    additional_loans = build_profile.get("additionalLoans")
    if additional_loans:
        result["liability_details"] = additional_loans
        result["additional_loan_details"] = additional_loans
    banking = _mapping(source.get("bankingRelationships"))
    if banking:
        result["bank_account_details"] = banking
        result["credit_history_details"] = {
            "creditPaymentHistory": banking.get("creditPaymentHistory"),
            "creditCardRelationshipStatus": banking.get("creditCardRelationshipStatus"),
            "accountHandling": banking.get("accountHandling"),
            "utilityCreditBureauStatus": banking.get("utilityCreditBureauStatus"),
        }

    if "targetAmount" in values:
        result["financial_goal_target_amount"] = _number(values["targetAmount"])
    if "targetMonths" in values:
        result["financial_goal_target_period"] = _integer(values["targetMonths"])
        result["financial_goal_target_period_unit"] = "months"

    return result


def apply_profile_columns(record: Any, requirements: Any) -> None:
    for column, value in profile_column_values(requirements).items():
        if column in PROFILE_COLUMN_NAMES:
            setattr(record, column, value)