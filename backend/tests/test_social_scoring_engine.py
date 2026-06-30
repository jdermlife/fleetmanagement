from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.social_scoring_engine import compute_social_score


class SocialScoringEngineTests(unittest.TestCase):
    def test_social_score_matches_lendwise_sheet_for_high_stability_profile(self) -> None:
        payload = SimpleNamespace(
            monthly_income=140000.0,
            other_income=10000.0,
            debt_obligations=12000.0,
            gov_id="ID-123",
            email="leader@company.com",
            phone="09171234567",
            requirements={
                "governmentIds": {
                    "idNumber": "ID-123",
                },
                "contactInformation": {
                    "mobileNumber": "09171234567",
                    "mobileYearsUsed": "6 years",
                    "emailAddress": "leader@company.com",
                    "emailYearsUsed": "6 years",
                },
                "otherInformation": {
                    "homeOwnership": "Own",
                    "recentPhotoUploaded": True,
                },
                "addressInformation": {
                    "lengthOfStay": "11 years",
                },
                "employmentInformation": {
                    "employmentStatus": "Government Executive",
                    "occupation": "Professional",
                    "position": "Executive Director",
                    "employerBusinessYears": 12,
                    "totalYearsWorking": "11 years",
                    "dateHired": "2012-01-01",
                    "monthlyLivingExpenses": 30000,
                    "investmentIncome": 5000,
                },
                "bankingRelationships": {
                    "accountNumber": "001",
                    "currentBalance": 250000,
                    "averageSavingsBalance": 650000,
                    "memberSince": "2010-01-01",
                    "utilityCreditBureauStatus": "Very satisfactory to satisfactory",
                    "loanMonthlyAmortization": 15000,
                },
                "enhancedDueDiligence": {
                    "consentIdentityVerification": True,
                    "characterReferences": "Excellent barangay captain reference",
                    "referencesFromEmployerOrCommunity": "Excellent employer and community verification",
                    "professionalOrganizationMemberships": "Active chamber and professional association member",
                    "professionalLicenses": "PRC active license",
                    "communityInvolvementInformation": "Excellent community volunteer profile",
                    "lifestyleIndicator": "Respectable lifestyle with excellent community standing",
                    "utilityAccountReferences": "No late payments in 24 months",
                    "selfDeclaredInvestmentPortfolio": "Mutual funds and UITF",
                    "existingInsurancePolicies": "Life insurance, health insurance, property insurance",
                    "linkedInProfile": "https://linkedin.com/in/example",
                    "consentOpenBankingDataAccess": True,
                },
                "supportingDocuments": {
                    "passportIfApplicable": True,
                },
            },
        )

        result = compute_social_score(payload)

        self.assertEqual(result["education_score"], 20.0)
        self.assertEqual(result["residence_stability_score"], 20.0)
        self.assertEqual(result["employment_stability_score"], 20.0)
        self.assertEqual(result["family_stability_score"], 20.0)
        self.assertEqual(result["banking_relationship_score"], 20.0)
        self.assertEqual(result["overall_social_score"], 100.0)
        self.assertEqual(result["social_grade"], "Platinum 1")

    def test_social_score_uses_zero_floor_for_missing_profile(self) -> None:
        payload = SimpleNamespace(requirements={})

        result = compute_social_score(payload)

        self.assertEqual(result["overall_social_score"], 0.0)
        self.assertEqual(result["social_grade"], "Red 2")

