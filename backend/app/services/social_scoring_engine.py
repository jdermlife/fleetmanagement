from __future__ import annotations

from typing import Any

from app.services.credit_scoring.common import (
    parse_years,
    requirements_section,
    safe_text,
    to_float,
    years_since,
)


FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
}


def _years_from_any(*values: Any) -> float:
    best = 0.0
    for value in values:
        best = max(best, parse_years(value), years_since(safe_text(value)))
    return best


def _count_present(*values: Any) -> int:
    return sum(1 for value in values if safe_text(value))


def _identity_and_digital_trust(payload: Any) -> float:
    government_ids = requirements_section(payload, "governmentIds")
    contact = requirements_section(payload, "contactInformation")
    other = requirements_section(payload, "otherInformation")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")
    supporting = requirements_section(payload, "supportingDocuments")

    has_national_or_passport = bool(supporting.get("philSysId")) or bool(
        supporting.get("passportIfApplicable")
    )
    has_drivers_license_or_professional_id = bool(supporting.get("driversLicense")) or any(
        keyword in safe_text(government_ids.get("otherGovernmentId")).lower()
        for keyword in ("driver", "license", "umid", "prc")
    )
    has_any_government_id = bool(safe_text(getattr(payload, "gov_id", ""))) or bool(
        safe_text(government_ids.get("idNumber"))
    ) or bool(supporting.get("validGovernmentId"))

    if has_national_or_passport:
        government_identity_score = 5.0
    elif has_drivers_license_or_professional_id:
        government_identity_score = 4.0
    elif has_any_government_id:
        government_identity_score = 3.0
    elif any(
        safe_text(value)
        for value in (
            government_ids.get("tin"),
            government_ids.get("sssGsisNumber"),
            government_ids.get("otherGovernmentId"),
        )
    ):
        government_identity_score = 1.0
    else:
        government_identity_score = 0.0

    mobile_years = _years_from_any(
        contact.get("mobileYearsUsed"),
        contact.get("phoneYearsUsed"),
        due_diligence.get("mobileNumberYears"),
    )
    has_mobile = bool(
        safe_text(contact.get("mobileNumber"))
        or safe_text(getattr(payload, "phone", ""))
    )
    if mobile_years > 5.0:
        contact_stability_score = 5.0
    elif mobile_years >= 3.0:
        contact_stability_score = 4.0
    elif mobile_years >= 1.0:
        contact_stability_score = 2.0
    elif has_mobile:
        contact_stability_score = 1.0
    else:
        contact_stability_score = 0.0

    email_value = safe_text(contact.get("emailAddress") or getattr(payload, "email", ""))
    email_years = _years_from_any(
        contact.get("emailYearsUsed"),
        due_diligence.get("emailYearsUsed"),
    )
    email_domain = email_value.split("@", 1)[1].lower() if "@" in email_value else ""
    is_professional_email = bool(email_domain) and email_domain not in FREE_EMAIL_DOMAINS
    if email_value and is_professional_email and email_years > 5.0:
        email_stability_score = 5.0
    elif email_value and email_years > 5.0:
        email_stability_score = 4.0
    elif email_value and email_years >= 2.0:
        email_stability_score = 3.0
    elif email_value:
        email_stability_score = 1.0
    else:
        email_stability_score = 0.0

    verified_count = 0
    if has_mobile:
        verified_count += 1
    if email_value:
        verified_count += 1
    device_verified = bool(
        getattr(payload, "device_verified", False)
        or getattr(payload, "deviceVerified", False)
        or other.get("deviceVerified")
        or other.get("recentPhotoUploaded")
        or due_diligence.get("consentIdentityVerification")
    )
    if device_verified:
        verified_count += 1

    if verified_count >= 3:
        digital_identity_score = 5.0
    elif verified_count == 2:
        digital_identity_score = 4.0
    elif verified_count == 1:
        digital_identity_score = 2.0
    elif has_any_government_id:
        digital_identity_score = 1.0
    else:
        digital_identity_score = 0.0

    return (
        government_identity_score
        + contact_stability_score
        + email_stability_score
        + digital_identity_score
    )


def _residential_and_community_stability(payload: Any) -> float:
    address = requirements_section(payload, "addressInformation")
    other = requirements_section(payload, "otherInformation")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")

    stay_years = _years_from_any(
        address.get("lengthOfStay"),
        due_diligence.get("lengthOfResidenceConfirmation"),
    )
    if stay_years > 10.0:
        length_of_stay_score = 8.0
    elif stay_years >= 5.0:
        length_of_stay_score = 6.0
    elif stay_years >= 3.0:
        length_of_stay_score = 4.0
    elif stay_years >= 1.0:
        length_of_stay_score = 2.0
    else:
        length_of_stay_score = 0.0

    home_ownership = safe_text(other.get("homeOwnership")).lower()
    if any(keyword in home_ownership for keyword in ("own", "owned")):
        residence_ownership_score = 6.0
    elif "mortg" in home_ownership:
        residence_ownership_score = 5.0
    elif any(keyword in home_ownership for keyword in ("family", "relative", "living with")):
        residence_ownership_score = 4.0
    elif any(keyword in home_ownership for keyword in ("rent", "lease")):
        residence_ownership_score = 2.0
    elif home_ownership:
        residence_ownership_score = 0.0
    else:
        residence_ownership_score = 0.0

    references_found = 0
    if safe_text(due_diligence.get("characterReferences")):
        references_found += 1
    if safe_text(due_diligence.get("referencesFromEmployerOrCommunity")):
        references_found += 1
    if safe_text(due_diligence.get("coBorrowerReferences")) or safe_text(
        due_diligence.get("guarantorReferences")
    ):
        references_found += 1

    if references_found >= 2:
        community_references_score = 6.0
    elif references_found == 1:
        community_references_score = 4.0
    elif safe_text(due_diligence.get("communityInvolvementInformation")):
        community_references_score = 2.0
    else:
        community_references_score = 0.0

    return length_of_stay_score + residence_ownership_score + community_references_score


def _employment_and_professional_stability(payload: Any) -> float:
    employment = requirements_section(payload, "employmentInformation")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")

    employment_years = max(
        _years_from_any(employment.get("totalYearsWorking"), employment.get("dateHired")),
        to_float(employment.get("employerBusinessYears"), 0.0),
    )
    if employment_years > 10.0:
        employment_stability_score = 8.0
    elif employment_years >= 5.0:
        employment_stability_score = 6.0
    elif employment_years >= 3.0:
        employment_stability_score = 4.0
    elif employment_years >= 1.0:
        employment_stability_score = 2.0
    else:
        employment_stability_score = 0.0

    occupation_text = " ".join(
        filter(
            None,
            [
                safe_text(employment.get("employmentStatus")),
                safe_text(employment.get("occupation")),
                safe_text(employment.get("position")),
                safe_text(employment.get("natureOfWorkBusiness")),
            ],
        )
    ).lower()
    if any(keyword in occupation_text for keyword in ("government", "professional", "executive", "manager", "director")):
        occupation_risk_score = 6.0
    elif any(keyword in occupation_text for keyword in ("regular", "permanent")):
        occupation_risk_score = 5.0
    elif any(keyword in occupation_text for keyword in ("skilled", "technician", "specialist", "supervisor")):
        occupation_risk_score = 4.0
    elif any(keyword in occupation_text for keyword in ("contract", "project", "part-time", "consult")):
        occupation_risk_score = 2.0
    elif any(keyword in occupation_text for keyword in ("unemployed", "jobless", "none")):
        occupation_risk_score = 0.0
    elif occupation_text:
        occupation_risk_score = 4.0
    else:
        occupation_risk_score = 0.0

    has_membership = bool(safe_text(due_diligence.get("professionalOrganizationMemberships")))
    has_license = bool(safe_text(due_diligence.get("professionalLicenses")))
    if has_license and has_membership:
        professional_membership_score = 6.0
    elif has_license:
        professional_membership_score = 5.0
    elif has_membership:
        professional_membership_score = 3.0
    else:
        professional_membership_score = 0.0

    return (
        employment_stability_score
        + occupation_risk_score
        + professional_membership_score
    )


def _social_and_financial_responsibility(payload: Any) -> float:
    applicant = requirements_section(payload, "applicantPersonal")
    banking = requirements_section(payload, "bankingRelationships")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")

    dependents = max(int(to_float(applicant.get("numberOfDependents"), 0.0)), 0)
    total_income = max(to_float(getattr(payload, "monthly_income", 0.0), 0.0), 0.0) + max(
        to_float(getattr(payload, "other_income", 0.0), 0.0),
        0.0,
    )
    debt_obligations = max(to_float(getattr(payload, "debt_obligations", 0.0), 0.0), 0.0)
    payment = max(to_float(banking.get("loanMonthlyAmortization"), 0.0), 0.0)
    disposable = total_income - debt_obligations - payment
    if dependents <= 2 and disposable >= 40000.0:
        household_responsibility_score = 5.0
    elif dependents <= 4 and disposable >= 20000.0:
        household_responsibility_score = 4.0
    elif disposable > 0:
        household_responsibility_score = 3.0
    elif total_income > 0:
        household_responsibility_score = 1.0
    else:
        household_responsibility_score = 0.0

    utility_text = safe_text(banking.get("utilityCreditBureauStatus")).lower()
    if "very satisfactory" in utility_text or "no late" in utility_text:
        utility_payment_score = 5.0
    elif "satisfactory" in utility_text or "minor" in utility_text:
        utility_payment_score = 4.0
    elif "dismissed" in utility_text or "settled" in utility_text or "occasional" in utility_text:
        utility_payment_score = 2.0
    elif "not satisfactory" in utility_text or "frequent" in utility_text:
        utility_payment_score = 0.0
    elif safe_text(due_diligence.get("utilityAccountReferences")):
        utility_payment_score = 4.0
    else:
        utility_payment_score = 0.0

    banking_years = _years_from_any(banking.get("memberSince"))
    if banking_years > 10.0:
        banking_relationship_score = 5.0
    elif banking_years >= 5.0:
        banking_relationship_score = 4.0
    elif banking_years >= 2.0:
        banking_relationship_score = 3.0
    elif banking_years > 0.0:
        banking_relationship_score = 1.0
    else:
        banking_relationship_score = 0.0

    reputation_text = " ".join(
        filter(
            None,
            [
                safe_text(due_diligence.get("characterReferences")),
                safe_text(due_diligence.get("referencesFromEmployerOrCommunity")),
                safe_text(due_diligence.get("communityInvolvementInformation")),
                safe_text(due_diligence.get("lifestyleIndicator")),
            ],
        )
    ).lower()
    reputation_override = safe_text(due_diligence.get("communityReputation")).lower()
    if "excellent" in reputation_override:
        community_reputation_score = 5.0
    elif "good" in reputation_override:
        community_reputation_score = 4.0
    elif reputation_override == "average":
        community_reputation_score = 3.0
    elif "limited" in reputation_override:
        community_reputation_score = 1.0
    elif "adverse" in reputation_override:
        community_reputation_score = 0.0
    elif any(keyword in reputation_text for keyword in ("adverse", "gambling", "fraud")):
        community_reputation_score = 0.0
    elif any(keyword in reputation_text for keyword in ("excellent", "outstanding")):
        community_reputation_score = 5.0
    elif any(keyword in reputation_text for keyword in ("good", "respectable", "verified")):
        community_reputation_score = 4.0
    elif reputation_text:
        community_reputation_score = 3.0
    elif safe_text(due_diligence.get("characterReferences")):
        community_reputation_score = 1.0
    else:
        community_reputation_score = 1.0 if _count_present(
            due_diligence.get("characterReferences"),
            due_diligence.get("referencesFromEmployerOrCommunity"),
        ) else 0.0

    return (
        household_responsibility_score
        + utility_payment_score
        + banking_relationship_score
        + community_reputation_score
    )


def _digital_and_lifestyle_behavior(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    employment = requirements_section(payload, "employmentInformation")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")

    digital_banking_usage = safe_text(due_diligence.get("digitalBankingUsage")).lower()
    if "daily" in digital_banking_usage or "weekly" in digital_banking_usage or "frequent" in digital_banking_usage:
        digital_banking_usage_score = 5.0
    elif "monthly" in digital_banking_usage or "regular" in digital_banking_usage:
        digital_banking_usage_score = 4.0
    elif "occasional" in digital_banking_usage:
        digital_banking_usage_score = 2.0
    elif "rare" in digital_banking_usage:
        digital_banking_usage_score = 1.0
    elif "none" in digital_banking_usage:
        digital_banking_usage_score = 0.0
    elif bool(due_diligence.get("consentOpenBankingDataAccess")) and safe_text(
        banking.get("accountNumber")
    ):
        digital_banking_usage_score = 5.0
    elif safe_text(banking.get("accountNumber")) and to_float(
        banking.get("currentBalance"),
        0.0,
    ) > 0:
        digital_banking_usage_score = 4.0
    elif safe_text(banking.get("accountNumber")):
        digital_banking_usage_score = 2.0
    elif safe_text(due_diligence.get("priorBankingRelationships")):
        digital_banking_usage_score = 1.0
    else:
        digital_banking_usage_score = 0.0

    relationship_years = _years_from_any(banking.get("memberSince"))
    has_savings_or_investments = (
        to_float(banking.get("averageSavingsBalance"), 0.0) > 0
        or safe_text(due_diligence.get("selfDeclaredInvestmentPortfolio"))
        or to_float(employment.get("investmentIncome"), 0.0) > 0
    )
    if has_savings_or_investments and relationship_years > 5.0:
        financial_relationship_score = 5.0
    elif has_savings_or_investments and relationship_years >= 4.0:
        financial_relationship_score = 4.0
    elif has_savings_or_investments and relationship_years >= 3.0:
        financial_relationship_score = 3.0
    elif has_savings_or_investments and relationship_years >= 2.0:
        financial_relationship_score = 1.0
    else:
        financial_relationship_score = 0.0

    insurance_text = safe_text(due_diligence.get("existingInsurancePolicies")).lower()
    insurance_markers = sum(
        1
        for keyword in ("life", "health", "medical", "vehicle", "property", "fire", "accident")
        if keyword in insurance_text
    )
    if insurance_markers >= 2:
        insurance_coverage_score = 5.0
    elif "life" in insurance_text or "health" in insurance_text:
        insurance_coverage_score = 4.0
    elif insurance_text:
        insurance_coverage_score = 2.0
    else:
        insurance_coverage_score = 0.0

    if safe_text(due_diligence.get("linkedInProfile")):
        digital_connections_score = 5.0
    elif safe_text(due_diligence.get("businessWebsite")) or safe_text(
        due_diligence.get("professionalOrganizationMemberships")
    ):
        digital_connections_score = 4.0
    elif safe_text(due_diligence.get("facebookProfile")) or safe_text(
        due_diligence.get("instagramProfile")
    ):
        digital_connections_score = 3.0
    elif safe_text(due_diligence.get("tikTokProfile")):
        digital_connections_score = 1.0
    else:
        digital_connections_score = 0.0

    return (
        digital_banking_usage_score
        + financial_relationship_score
        + insurance_coverage_score
        + digital_connections_score
    )


def _grade_for_social_score(score: float) -> tuple[str, str]:
    if score >= 95.0:
        return "Platinum 1", "Exceptional Social Stability"
    if score >= 89.0:
        return "Platinum 2", "Excellent"
    if score >= 83.0:
        return "Gold 1", "Very Stable"
    if score >= 77.0:
        return "Gold 2", "Stable"
    if score >= 69.0:
        return "Silver 1", "Acceptable"
    if score >= 61.0:
        return "Silver 2", "Moderate Stability"
    if score >= 51.0:
        return "Bronze 1", "Below Average"
    if score >= 41.0:
        return "Bronze 2", "Weak Stability"
    if score >= 21.0:
        return "Red 1", "High Social Risk"
    return "Red 2", "Very High Social Risk"


def compute_social_score(payload: Any) -> dict[str, float | str]:
    identity_and_digital_trust_score = _identity_and_digital_trust(payload)
    residential_and_community_stability_score = _residential_and_community_stability(payload)
    employment_and_professional_stability_score = _employment_and_professional_stability(payload)
    social_and_financial_responsibility_score = _social_and_financial_responsibility(payload)
    digital_and_lifestyle_behavior_score = _digital_and_lifestyle_behavior(payload)
    overall_social_score = round(
        identity_and_digital_trust_score
        + residential_and_community_stability_score
        + employment_and_professional_stability_score
        + social_and_financial_responsibility_score
        + digital_and_lifestyle_behavior_score,
        2,
    )
    grade, interpretation = _grade_for_social_score(overall_social_score)

    return {
        "residence_stability_score": round(residential_and_community_stability_score, 2),
        "employment_stability_score": round(employment_and_professional_stability_score, 2),
        "family_stability_score": round(social_and_financial_responsibility_score, 2),
        "education_score": round(identity_and_digital_trust_score, 2),
        "banking_relationship_score": round(digital_and_lifestyle_behavior_score, 2),
        "overall_social_score": overall_social_score,
        "social_grade": grade,
        "social_interpretation": interpretation,
    }


def evaluate(application: Any) -> dict[str, float | str]:
    return compute_social_score(application)
