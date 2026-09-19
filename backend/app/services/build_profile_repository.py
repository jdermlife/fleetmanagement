from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.fastapi_auth import CurrentUser
from app.models.loan_application import (
    AIRecommendation,
    CollateralScore,
    CreditBureauReport,
    CreditScore,
    FraudScore,
    LoanApplication,
    OverallScore,
    ProfitabilityScore,
    PsychometricScore,
    RelationshipScore,
    SocialScore,
)
from app.services.loan_application_profile_columns import apply_profile_columns
from app.services.overall_scoring_engine import compute_quant_score_package


def _number(values: dict[str, Any], key: str) -> float:
    try:
        return float(values.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def _boolean(values: dict[str, Any], key: str) -> bool:
    value = values.get(key)
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def _profile_requirements(profile: dict[str, Any]) -> dict[str, Any]:
    values = profile["values"]

    def fields(*keys: str) -> dict[str, Any]:
        return {key: values.get(key) for key in keys if key in values}

    credit_values = {
        key.removeprefix("creditValues."): value
        for key, value in values.items()
        if key.startswith("creditValues.")
    }
    psychometric_assessment = profile.get("psychometricAssessment")
    if not isinstance(psychometric_assessment, dict):
        psychometric_assessment = credit_values
    return {
        "buildProfile": jsonable_encoder(profile),
        "productInformation": {
            "productType": values.get("productType") or "Personal Loan",
        },
        "applicantPersonal": {
            **fields("dateOfBirth", "placeOfBirth", "age", "gender", "citizenship"),
            "numberOfDependents": _number(values, "dependents"),
            "maritalStatus": values.get("civilStatus") or "",
        },
        "contactInformation": {
            **fields("mobileNumber", "homePhoneNumber", "mobileYearsUsed", "emailYearsUsed"),
            "emailAddress": values.get("email") or "",
        },
        "governmentIds": {
            "tin": values.get("tin") or "",
            "sssGsisNumber": values.get("sssGsis") or "",
            "otherGovernmentId": values.get("otherGovernmentId") or "",
            "idNumber": values.get("otherGovernmentIdNumber") or values.get("governmentId") or "",
            "issueDate": values.get("idIssueDate") or "",
            "expiryDate": values.get("idExpiryDate") or "",
        },
        "addressInformation": {
            "presentAddress": values.get("address") or "",
            **fields("permanentAddress", "mailingAddress", "lengthOfStay"),
        },
        "otherInformation": {
            "homeOwnership": values.get("homeOwnership") or "",
            "educationalAttainment": values.get("education") or "",
            "numberOfVehiclesOwned": _number(values, "numberOfVehiclesOwned"),
            "deviceVerified": _boolean(values, "deviceVerified"),
            "hasCoBorrower": bool(profile.get("coBorrowers")),
        },
        "employmentInformation": {
            **fields(
                "employmentStatus", "employmentLocation", "officeAddress", "occupation",
                "position", "natureOfWorkBusiness", "dateHired", "officePhoneNumber",
                "previousEmployer", "totalYearsWorking", "employerBusinessYears",
            ),
            "employerBusinessName": values.get("employerName") or values.get("employmentHistory") or "",
            "grossMonthlyIncome": _number(values, "monthlyIncome"),
            "monthlyLivingExpenses": _number(values, "monthlyExpenses"),
            "otherSourcesOfIncome": _number(values, "otherIncome"),
            "investmentIncome": _number(values, "investmentIncome"),
            "businessIncome": _number(values, "businessIncome"),
            "pensionIncome": _number(values, "pensionIncome"),
        },
        "spouseInformation": {
            "fullName": values.get("spouseFullName") or "",
            "dateOfBirth": values.get("spouseDateOfBirth") or "",
            "placeOfBirth": values.get("spousePlaceOfBirth") or "",
            "citizenship": values.get("spouseCitizenship") or "",
            "mobileNumber": values.get("spouseMobileNumber") or "",
            "presentAddress": values.get("spousePresentAddress") or "",
            "employerBusinessName": values.get("spouseEmployerBusinessName") or "",
            "officeAddress": values.get("spouseOfficeAddress") or "",
            "occupation": values.get("spouseOccupation") or "",
            "position": values.get("spousePosition") or "",
            "natureOfWork": values.get("spouseNatureOfWork") or "",
            "yearsWithEmployer": values.get("spouseYearsWithEmployer") or "",
            "previousEmployer": values.get("spousePreviousEmployer") or "",
            "totalYearsWorking": values.get("spouseTotalYearsWorking") or "",
            "grossMonthlyIncome": _number(values, "spouseGrossMonthlyIncome"),
            "monthlyExpenses": _number(values, "spouseMonthlyExpenses"),
            "otherIncomeSources": values.get("spouseOtherIncomeSources") or "",
        },
        "bankingRelationships": fields(
            "creditCardIssuer", "creditCardNumber", "creditLimit", "outstandingBalance",
            "memberSince", "bankBranch", "accountType", "accountNumber", "currentBalance",
            "loanLender", "loanType", "loanCurrentBalance", "loanMonthlyAmortization",
            "creditBureauLatePaymentFrequency", "creditBureauDelinquencyDefaultHistory",
            "creditBureauOverallBalanceRatio", "creditBureauCreditLimitUtilization",
            "creditBureauActiveLoanCount", "creditBureauCollectionCallsLast12Months",
            "creditBureauCreditHistoryLength", "creditBureauWrittenOffAccountStatus",
            "creditBureauLegalCaseCollectionStatus", "creditBureauUnpaidDebtRecord",
            "creditBureauLoanAmount", "creditBureauLoanPaidStatus", "creditPaymentHistory",
            "accountHandling", "utilityCreditBureauStatus", "creditCardRelationshipStatus",
            "additionalBankAccountsOwned", "priorBankingRelationships", "averageSavingsBalance",
            "averageDailyBalance", "depositRegularity", "bankingRelationshipTier",
            "existingInsurancePolicies",
        ),
        "enhancedDueDiligence": fields(
            "previousLendersAndExistingLoanAccounts", "numberOfActiveLoans",
            "previousLoanRestructuringDisclosures", "employmentReferencePerson",
            "hrContactInformation", "supervisorInformation",
            "sourceOfIncomeVerificationReferences", "lengthOfResidenceConfirmation",
            "utilityAccountReferences", "lifestyleIndicator", "secondaryIncomeProfile",
            "characterReferences", "guarantorReferences", "coBorrowerReferences",
            "referencesFromEmployerOrCommunity", "communityReputation",
            "professionalOrganizationMemberships", "professionalLicenses",
            "communityInvolvementInformation", "consentOpenBankingDataAccess",
            "consentEmploymentVerification", "consentIdentityVerification",
        ),
        "fraudVerification": fields(
            "faceMatchScore", "livenessDetection", "incomeDocumentsStatus",
            "employmentVerificationStatus", "bankStatementVerificationStatus",
            "payrollVerificationStatus", "bankAccountOwnershipStatus",
        ),
        "fraudIntelligence": fields(
            "watchlistStatus", "previousFraudRecords", "applicationVelocity",
            "fakeNationalId", "forgedPayslip", "forgedBankStatement",
            "identityTheftIndicator", "sanctionsPepMatch",
            "fraudAndDocumentAuthenticityAttestation",
        ),
        "documentAnalysis": fields("ocrAnalysisStatus"),
        "deviceRisk": fields("deviceReputation", "ipAddressRisk", "deviceConsistency"),
        "psychometricAssessment": jsonable_encoder(psychometric_assessment),
        "collateralAssetDetails": {
            **fields(
                "securityClassification", "assetType", "maker", "brand", "model", "year",
                "vehicleMarketabilityCategory", "vehicleConditionCategory",
                "vehicleTypeCategory", "motorcycleIntendedUse", "insuranceProviderCompany",
                "policyNumber", "orNumber", "crNumber",
            ),
            "useAsCollateral": _boolean(values, "useAsCollateral"),
        },
        "collateralInformation": fields(
            "propertyAddress", "registeredOwner", "lotNumber", "blockNumber", "tctCctNumber",
            "propertyMarketabilityCategory", "houseUnitModelCategory",
            "collateralOccupancyType", "propertyAppraisedValue",
        ),
        "coBorrowers": profile.get("coBorrowers") or [],
        "dependents": profile.get("dependents") or [],
    }


_SCORE_MODELS = {
    "credit_scores": CreditScore,
    "fraud_scores": FraudScore,
    "social_scores": SocialScore,
    "psychometric_scores": PsychometricScore,
    "credit_bureau_reports": CreditBureauReport,
    "collateral_scores": CollateralScore,
    "profitability_scores": ProfitabilityScore,
    "relationship_scores": RelationshipScore,
    "ai_recommendations": AIRecommendation,
    "overall_scores": OverallScore,
}


def compute_and_persist_build_profile_scores(
    db: Session,
    record: LoanApplication,
) -> dict[str, Any]:
    db.flush()
    score_package = compute_quant_score_package(record)
    final_score = float(score_package["overall_scores"]["final_score"])
    record.scorecard_total = int(final_score)
    record.ai_probability = final_score

    for package_key, model_class in _SCORE_MODELS.items():
        related_record = (
            db.query(model_class)
            .filter(model_class.loan_application_id == record.id)
            .order_by(model_class.id.desc())
            .first()
        )
        if related_record is None:
            related_record = model_class(loan_application_id=record.id)
            db.add(related_record)

        model_columns = set(model_class.__table__.columns.keys())
        for field, value in score_package[package_key].items():
            if field in model_columns and field not in {"id", "loan_application_id", "created_at"}:
                setattr(related_record, field, value)

    return score_package["quant_scores"]


def upsert_build_profile_record(
    db: Session,
    user: CurrentUser,
    profile: dict[str, Any],
    profile_id: str,
) -> tuple[LoanApplication, bool]:
    normalized_profile_id = profile_id.strip()
    payload_profile_id = str(profile.get("profileId") or "").strip()
    if (
        not normalized_profile_id
        or len(normalized_profile_id) > 255
        or payload_profile_id != normalized_profile_id
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Profile ID must match the application number.",
        )

    values = profile.get("values")
    if not isinstance(values, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Build Profile values are required.",
        )

    record = (
        db.query(LoanApplication)
        .filter(LoanApplication.application_no == normalized_profile_id)
        .first()
    )
    created = record is None
    if created:
        record = LoanApplication(
            application_no=normalized_profile_id,
            created_by=user.id,
            created_by_user_id=user.id,
            status="Draft",
        )
        db.add(record)
    elif record.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to update this profile draft",
        )

    borrower_name = str(values.get("fullName") or "").strip()
    record.product_type = str(values.get("productType") or "Personal Loan")
    record.client_name = borrower_name
    record.borrower_name = borrower_name
    record.email = str(values.get("email") or "")
    record.phone = str(values.get("mobileNumber") or "")
    record.gov_id = str(
        values.get("governmentId") or values.get("otherGovernmentIdNumber") or ""
    )
    record.address = str(values.get("address") or "")
    record.monthly_income = _number(values, "monthlyIncome")
    record.other_income = _number(values, "otherIncome")
    record.debt_obligations = _number(values, "debtObligations")
    record.loan_amount = _number(values, "requestedAmount")
    record.term_months = int(_number(values, "loanTerm"))
    record.interest_rate = _number(values, "interestRate")
    record.purpose = str(values.get("loanPurpose") or "")
    record.vehicle_info = " ".join(
        str(values.get(key) or "").strip()
        for key in ("maker", "brand", "model", "year")
        if str(values.get(key) or "").strip()
    )
    record.appraised_value = _number(values, "appraisedValue") or _number(
        values, "propertyAppraisedValue"
    )
    record.committee_remarks = record.committee_remarks or ""
    record.executive_approval = bool(record.executive_approval)
    record.dti = record.dti or 0
    record.dsr = record.dsr or 0
    record.ltv = record.ltv or 0
    record.scorecard_total = record.scorecard_total or 0
    record.ai_probability = record.ai_probability or 0
    record.updated_by = user.id
    record.requirements = {**(record.requirements or {}), **_profile_requirements(profile)}
    apply_profile_columns(record, record.requirements)
    return record, created