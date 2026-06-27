from __future__ import annotations

import unittest
from datetime import date
from types import SimpleNamespace

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
        self.assertEqual(result["credit_scores"]["total_credit_score"], 825.0)
        self.assertEqual(result["relationship_scores"]["customer_since"], date(2020, 1, 15))
        self.assertEqual(result["relationship_scores"]["number_of_accounts"], 3)
        self.assertEqual(result["relationship_scores"]["deposit_balance"], 1234.56)
        self.assertEqual(result["relationship_scores"]["prior_loans"], 2)
        self.assertEqual(result["credit_bureau_reports"]["bureau_score"], 825.0)
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
