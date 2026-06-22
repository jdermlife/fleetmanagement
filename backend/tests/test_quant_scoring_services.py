from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.overall_scoring_engine import compute_quant_score_package


class QuantScoringServiceTests(unittest.TestCase):
    def test_quant_score_summary_matches_expected_values(self) -> None:
        payload = SimpleNamespace(
            gov_id="",
            email="",
            phone="",
            loan_amount=0.0,
            interest_rate=0.0,
            term_months=12,
            requirements={
                "optionalPsychometricQuestionnaire": {},
                "bankingRelationships": {},
                "enhancedDueDiligence": {},
            },
        )

        result = compute_quant_score_package(payload)

        self.assertEqual(
            result["quant_scores"],
            {
                "creditScore": 825,
                "fraudScore": 76,
                "socialScore": 72,
                "psychometricScore": 81,
                "relationshipScore": 88,
                "profitabilityScore": 79,
                "overallScore": 82,
                "finalGrade": "A-",
                "decision": "APPROVE",
            },
        )
        self.assertEqual(result["overall_scores"]["final_decision"], "APPROVE")
        self.assertEqual(result["relationship_scores"]["relationship_score"], 88.0)