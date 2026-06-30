from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.credit_scoring_engine import compute_credit_score


def build_payload(product_type: str, **overrides):
    payload = {
        "product_type": product_type,
        "monthly_income": 90000.0,
        "other_income": 5000.0,
        "debt_obligations": 8000.0,
        "loan_amount": 1200000.0,
        "interest_rate": 9.0,
        "term_months": 60,
        "appraised_value": 1800000.0,
        "requirements": {
            "applicantPersonal": {
                "maritalStatus": "Single",
                "numberOfDependents": 0,
            },
            "bankingRelationships": {
                "currentBalance": 150000,
                "accountNumber": "001",
                "creditCardNumber": "CC-1",
                "creditLimit": 200000,
                "outstandingBalance": 40000,
                "memberSince": "2020-01-01",
                "loanLender": "Bank A",
            },
            "supportingDocuments": {
                "utilityBill": True,
                "bankStatements": True,
            },
            "enhancedDueDiligence": {
                "numberOfActiveLoans": 1,
            },
            "employmentInformation": {
                "employmentStatus": "Locally Employed",
                "totalYearsWorking": "5",
                "dateHired": "2020-01-01",
                "monthlyLivingExpenses": 25000,
                "otherSourcesOfIncome": 10000,
                "investmentIncome": 5000,
                "businessIncome": 0,
                "pensionIncome": 0,
            },
            "addressInformation": {
                "lengthOfStay": "5 years",
            },
            "collateralInformation": {
                "propertyAddress": "Subdivision residential property",
                "propertyAppraisedValue": 3500000,
            },
            "otherInformation": {
                "homeOwnership": "Owned",
            },
            "productInformation": {
                "homeCollateralType": "Single detached",
                "autoSellingPrice": 1800000,
                "autoVehicleClassification": "Passenger vehicle",
                "autoYearModel": "2026",
            },
            "collateralAssetDetails": {
                "brand": "Toyota",
                "year": "2026",
                "assetType": "Passenger vehicle",
                "appraisedValue": 1800000,
            },
        },
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


class CreditScoringEngineTests(unittest.TestCase):
    def test_home_loan_uses_home_collateral_scorecard(self) -> None:
        result = compute_credit_score(build_payload("Home Loan"))

        self.assertEqual(result["capital_score"], 0.0)
        self.assertEqual(result["capacity_score"], 34.0)
        self.assertEqual(result["character_score"], 15.0)
        self.assertEqual(result["collateral_score"], 15.0)
        self.assertEqual(result["conditions_score"], 14.0)
        self.assertEqual(result["total_credit_score"], 78.0)
        self.assertEqual(result["credit_grade"], "Gold 2")
        self.assertEqual(result["model_version"], "product-scorecard-v1:Home Loan")

    def test_home_loan_prefers_structured_model_criteria_fields(self) -> None:
        payload = build_payload("Home Loan", appraised_value=3500000.0)
        payload.requirements["bankingRelationships"].update(
            {
                "creditPaymentHistory": "Excellent handling (no past due)",
                "accountHandling": "Excellent handling (no returned checks)",
                "utilityCreditBureauStatus": "Very satisfactory to satisfactory",
                "averageDailyBalance": 120000,
            }
        )
        payload.requirements["employmentInformation"].update(
            {
                "employmentLocation": "Locally Employed",
                "employerBusinessYears": 11,
            }
        )
        payload.requirements["enhancedDueDiligence"].update(
            {
                "lifestyleIndicator": "Respectable lifestyle (no gambling, drinking, etc.)",
            }
        )
        payload.requirements["collateralInformation"].update(
            {
                "propertyMarketabilityCategory": "Subdivision / Condominium (Class A,B,C)",
                "houseUnitModelCategory": "Single detached",
                "collateralOccupancyType": "Residential property used by borrower as primary residence",
            }
        )
        payload.requirements["productInformation"].update(
            {
                "homeCollateralType": "Single detached",
            }
        )

        result = compute_credit_score(payload)

        self.assertEqual(result["capacity_score"], 34.0)
        self.assertEqual(result["character_score"], 15.0)
        self.assertEqual(result["collateral_score"], 15.0)
        self.assertEqual(result["conditions_score"], 15.0)
        self.assertEqual(result["total_credit_score"], 79.0)
        self.assertEqual(result["credit_grade"], "Gold 2")

    def test_auto_loan_uses_vehicle_scorecard(self) -> None:
        result = compute_credit_score(build_payload("Auto Loan"))

        self.assertEqual(result["capital_score"], 0.0)
        self.assertEqual(result["capacity_score"], 34.0)
        self.assertEqual(result["character_score"], 15.0)
        self.assertEqual(result["collateral_score"], 14.0)
        self.assertEqual(result["conditions_score"], 14.0)
        self.assertEqual(result["total_credit_score"], 77.0)
        self.assertEqual(result["credit_grade"], "Gold 2")
        self.assertEqual(result["model_version"], "product-scorecard-v1:Auto Loan")

    def test_auto_loan_prefers_structured_model_criteria_fields(self) -> None:
        payload = build_payload("Auto Loan")
        payload.requirements["bankingRelationships"].update(
            {
                "creditPaymentHistory": "Excellent handling (no past due)",
                "accountHandling": "Excellent handling (no returned checks)",
                "utilityCreditBureauStatus": "Very satisfactory to satisfactory",
                "averageDailyBalance": 120000,
            }
        )
        payload.requirements["employmentInformation"].update(
            {
                "employmentLocation": "Locally Employed",
                "employerBusinessYears": 11,
            }
        )
        payload.requirements["enhancedDueDiligence"].update(
            {
                "lifestyleIndicator": "Respectable lifestyle (no gambling, drinking, etc.)",
            }
        )
        payload.requirements["collateralAssetDetails"].update(
            {
                "vehicleMarketabilityCategory": "Brand new, high-demand brands (e.g., Toyota, Honda, Mitsubishi, Ford)",
                "vehicleConditionCategory": "Brand New",
                "vehicleTypeCategory": "Passenger vehicle for personal use",
            }
        )

        result = compute_credit_score(payload)

        self.assertEqual(result["capacity_score"], 34.0)
        self.assertEqual(result["character_score"], 15.0)
        self.assertEqual(result["collateral_score"], 14.0)
        self.assertEqual(result["conditions_score"], 15.0)
        self.assertEqual(result["total_credit_score"], 78.0)
        self.assertEqual(result["credit_grade"], "Gold 2")

    def test_credit_card_uses_relationship_limit_scorecard(self) -> None:
        result = compute_credit_score(
            build_payload("Credit Card", loan_amount=120000.0, appraised_value=0.0)
        )

        self.assertEqual(result["capital_score"], 23.0)
        self.assertEqual(result["collateral_score"], 0.0)
        self.assertEqual(result["total_credit_score"], 91.0)
        self.assertEqual(result["credit_grade"], "Platinum 2")
        self.assertEqual(result["model_version"], "product-scorecard-v1:Credit Card")

    def test_credit_card_prefers_structured_model_criteria_fields(self) -> None:
        payload = build_payload(
            "Credit Card",
            loan_amount=120000.0,
            appraised_value=0.0,
        )
        payload.requirements["bankingRelationships"].update(
            {
                "creditCardRelationshipStatus": "Existing cardholder for more than 5 years with excellent payment history",
                "bankingRelationshipTier": "Premium/Preferred banking customer with multiple products",
                "creditPaymentHistory": "Excellent handling (no past due)",
                "accountHandling": "Excellent handling (no returned checks)",
                "utilityCreditBureauStatus": "Very satisfactory to satisfactory",
                "averageDailyBalance": 120000,
            }
        )
        payload.requirements["employmentInformation"].update(
            {
                "employmentLocation": "Locally Employed",
                "employerBusinessYears": 11,
            }
        )
        payload.requirements["enhancedDueDiligence"].update(
            {
                "lifestyleIndicator": "Respectable lifestyle (no gambling, drinking, etc.)",
            }
        )

        result = compute_credit_score(payload)

        self.assertEqual(result["capital_score"], 23.0)
        self.assertEqual(result["character_score"], 25.0)
        self.assertEqual(result["conditions_score"], 25.0)
        self.assertEqual(result["total_credit_score"], 93.0)
        self.assertEqual(result["credit_grade"], "Platinum 2")

    def test_credit_card_requested_limit_above_policy_max_scores_zero_for_limit_factor(self) -> None:
        payload = build_payload(
            "Credit Card",
            loan_amount=250000.0,
            appraised_value=0.0,
        )
        payload.requirements["productInformation"].update(
            {
                "policyMaximumCreditLimit": 200000.0,
            }
        )

        result = compute_credit_score(payload)

        self.assertEqual(result["capital_score"], 20.0)

    def test_personal_loan_uses_liquidity_and_secondary_income_scorecard(self) -> None:
        result = compute_credit_score(
            build_payload("Personal Loan", monthly_income=70000.0, other_income=15000.0, loan_amount=300000.0, appraised_value=0.0)
        )

        self.assertEqual(result["capacity_score"], 19.0)
        self.assertEqual(result["character_score"], 25.0)
        self.assertEqual(result["capital_score"], 19.0)
        self.assertEqual(result["collateral_score"], 0.0)
        self.assertEqual(result["conditions_score"], 23.0)
        self.assertEqual(result["total_credit_score"], 86.0)
        self.assertEqual(result["credit_grade"], "Gold 1")
        self.assertEqual(result["model_version"], "product-scorecard-v1:Personal Loan")

    def test_personal_loan_prefers_structured_model_criteria_fields(self) -> None:
        payload = build_payload(
            "Personal Loan",
            monthly_income=70000.0,
            other_income=15000.0,
            loan_amount=300000.0,
            appraised_value=0.0,
        )
        payload.requirements["bankingRelationships"].update(
            {
                "averageSavingsBalance": 600000,
                "averageDailyBalance": 120000,
                "depositRegularity": "Regular deposits",
                "creditPaymentHistory": "Excellent handling (no past due)",
                "accountHandling": "Excellent handling (no returned checks)",
                "utilityCreditBureauStatus": "Very satisfactory to satisfactory",
            }
        )
        payload.requirements["employmentInformation"].update(
            {
                "employmentLocation": "Locally Employed",
                "employerBusinessYears": 11,
            }
        )
        payload.requirements["enhancedDueDiligence"].update(
            {
                "lifestyleIndicator": "Respectable lifestyle (no gambling, drinking, etc.)",
                "secondaryIncomeProfile": "Multiple stable income sources",
            }
        )

        result = compute_credit_score(payload)

        self.assertEqual(result["capacity_score"], 19.0)
        self.assertEqual(result["character_score"], 25.0)
        self.assertEqual(result["capital_score"], 23.0)
        self.assertEqual(result["conditions_score"], 25.0)
        self.assertEqual(result["total_credit_score"], 92.0)
        self.assertEqual(result["credit_grade"], "Platinum 2")
