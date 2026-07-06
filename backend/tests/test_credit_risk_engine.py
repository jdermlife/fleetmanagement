from __future__ import annotations

import unittest
from datetime import date
from types import SimpleNamespace

import tests._warning_filters  # noqa: F401

from app.services.credit_risk_engine import compute_credit_risk_package


class CreditRiskEngineTests(unittest.TestCase):
    def test_credit_risk_package_contains_expected_sections(self) -> None:
        payload = SimpleNamespace(
            requirements={
                "bankingRelationships": {
                    "memberSince": "2020-01-15",
                    "accountNumber": "A123",
                    "creditCardNumber": "CC123",
                    "loanLender": "Lender A",
                    "currentBalance": "1234.56",
                    "loanCurrentBalance": "2500",
                },
                "enhancedDueDiligence": {
                    "numberOfActiveLoans": "2",
                },
            },
        )

        result = compute_credit_risk_package(payload)

        self.assertEqual(set(result.keys()), {"credit_scores", "relationship_scores", "credit_bureau_reports", "collateral_scores"})
        self.assertEqual(result["credit_scores"]["total_credit_score"], 17.0)
        self.assertEqual(result["credit_scores"]["bureau_score"], 393.5)
        self.assertEqual(result["relationship_scores"]["customer_since"], date(2020, 1, 15))
        self.assertEqual(result["relationship_scores"]["number_of_accounts"], 3)
        self.assertEqual(result["relationship_scores"]["deposit_balance"], 1234.56)
        self.assertEqual(result["relationship_scores"]["prior_loans"], 2)
        self.assertEqual(result["credit_bureau_reports"]["bureau_score"], 393.5)
        self.assertEqual(result["credit_bureau_reports"]["active_loans"], 2)
        self.assertEqual(result["credit_bureau_reports"]["outstanding_balance"], 2500.0)
        self.assertEqual(result["collateral_scores"]["overall_collateral_score"], 81.0)

    def test_credit_risk_package_applies_safe_defaults(self) -> None:
        payload = SimpleNamespace(requirements={"bankingRelationships": {}, "enhancedDueDiligence": {}})

        result = compute_credit_risk_package(payload)

        self.assertIsNone(result["relationship_scores"]["customer_since"])
        self.assertEqual(result["relationship_scores"]["number_of_accounts"], 1)
        self.assertEqual(result["relationship_scores"]["deposit_balance"], 0.0)
        self.assertEqual(result["relationship_scores"]["prior_loans"], 0)
        self.assertEqual(result["credit_bureau_reports"]["total_loans"], 0)
        self.assertEqual(result["credit_bureau_reports"]["outstanding_balance"], 0.0)

    def test_credit_risk_package_uses_structured_auto_loan_collateral_inputs(self) -> None:
        payload = SimpleNamespace(
            product_type="Auto Loan",
            loan_amount=1200000.0,
            appraised_value=1800000.0,
            requirements={
                "bankingRelationships": {
                    "memberSince": "2020-01-15",
                    "accountNumber": "A123",
                    "creditCardNumber": "CC123",
                    "loanLender": "Lender A",
                    "currentBalance": "1234.56",
                    "loanCurrentBalance": "2500",
                },
                "enhancedDueDiligence": {
                    "numberOfActiveLoans": "2",
                },
                "collateralAssetDetails": {
                    "vehicleMarketabilityCategory": "Brand new, high-demand brands (e.g., Toyota, Honda, Mitsubishi, Ford)",
                    "vehicleConditionCategory": "Brand New",
                    "vehicleTypeCategory": "Passenger vehicle for personal use",
                    "insuranceProviderCompany": "Insurer",
                    "policyNumber": "POL-1",
                },
                "productInformation": {},
            },
        )

        result = compute_credit_risk_package(payload)

        self.assertGreater(result["collateral_scores"]["marketability_score"], 95.0)
        self.assertGreater(result["collateral_scores"]["asset_quality_score"], 95.0)
        self.assertEqual(result["collateral_scores"]["insurance_score"], 100.0)

    def test_credit_risk_package_uses_structured_home_loan_collateral_inputs(self) -> None:
        payload = SimpleNamespace(
            product_type="Home Loan",
            loan_amount=1200000.0,
            appraised_value=3500000.0,
            requirements={
                "bankingRelationships": {
                    "memberSince": "2020-01-15",
                    "accountNumber": "A123",
                    "creditCardNumber": "CC123",
                    "loanLender": "Lender A",
                    "currentBalance": "1234.56",
                    "loanCurrentBalance": "2500",
                },
                "enhancedDueDiligence": {
                    "numberOfActiveLoans": "2",
                },
                "collateralInformation": {
                    "propertyMarketabilityCategory": "Subdivision / Condominium (Class A,B,C)",
                    "houseUnitModelCategory": "Single detached",
                    "collateralOccupancyType": "Residential property used by borrower as primary residence",
                },
                "productInformation": {
                    "homeCollateralType": "Single detached",
                },
            },
        )

        result = compute_credit_risk_package(payload)

        self.assertGreater(result["collateral_scores"]["marketability_score"], 95.0)
        self.assertGreater(result["collateral_scores"]["asset_quality_score"], 95.0)
        self.assertGreater(result["collateral_scores"]["overall_collateral_score"], 85.0)

    def test_credit_risk_package_uses_structured_motorcycle_collateral_inputs(self) -> None:
        payload = SimpleNamespace(
            product_type="Motorcycle Loan",
            loan_amount=180000.0,
            appraised_value=300000.0,
            requirements={
                "bankingRelationships": {
                    "memberSince": "2020-01-15",
                    "accountNumber": "A123",
                    "creditCardNumber": "CC123",
                    "loanLender": "Lender A",
                    "currentBalance": "1234.56",
                    "loanCurrentBalance": "2500",
                },
                "enhancedDueDiligence": {
                    "numberOfActiveLoans": "2",
                },
                "collateralAssetDetails": {
                    "brand": "Honda",
                    "year": "2026",
                    "appraisedValue": 300000.0,
                    "vehicleMarketabilityCategory": "Honda, Yamaha, Suzuki, Kawasaki",
                    "motorcycleIntendedUse": "Personal use",
                    "insuranceProviderCompany": "Insurer",
                    "policyNumber": "POL-1",
                },
                "productInformation": {},
            },
        )

        result = compute_credit_risk_package(payload)

        self.assertGreater(result["collateral_scores"]["marketability_score"], 95.0)
        self.assertGreater(result["collateral_scores"]["asset_quality_score"], 95.0)
        self.assertEqual(result["collateral_scores"]["insurance_score"], 100.0)
