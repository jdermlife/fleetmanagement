from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.ai_orchestrator import AIOrchestrator
from app.services.overall_scoring_engine import compute_quant_score_package


class StubEngine:
    def __init__(self, name, result, calls):
        self.name = name
        self.result = result
        self.calls = calls

    def evaluate(self, *args):
        self.calls.append((self.name, args))
        return self.result


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

    def test_ai_orchestrator_calls_engines_in_expected_order(self) -> None:
        payload = SimpleNamespace(loan_amount=450000.0)
        calls = []
        credit = {"total_credit_score": 825.0}
        fraud = {"overall_fraud_score": 76.0}
        behavior = {"overall_psychometric_score": 81.0}
        social = {"overall_social_score": 72.0}
        risk = {
            "relationship_scores": {"relationship_score": 88.0},
            "credit_bureau_reports": {"bureau_score": 825.0},
            "collateral_scores": {"overall_collateral_score": 81.0},
            "overall_credit_risk_score": 82.25,
        }
        profit = {"profitability_score": 79.0}
        decision = {
            "final_score": 82.0,
            "final_grade": "A-",
            "decision": "APPROVE",
        }
        orchestrator = AIOrchestrator(
            credit_engine=StubEngine("credit", credit, calls),
            fraud_engine=StubEngine("fraud", fraud, calls),
            psychometric_engine=StubEngine("behavior", behavior, calls),
            social_engine=StubEngine("social", social, calls),
            credit_risk_engine=StubEngine("risk", risk, calls),
            profitability_engine=StubEngine("profit", profit, calls),
            decision_engine=StubEngine("decision", decision, calls),
        )

        result = orchestrator.evaluate(payload)

        self.assertEqual(
            [name for name, _ in calls],
            ["credit", "fraud", "behavior", "social", "risk", "profit", "decision"],
        )
        self.assertIs(calls[4][1][1], credit)
        self.assertIs(calls[4][1][2], fraud)
        self.assertIs(calls[6][1][0], credit)
        self.assertIs(calls[6][1][1], fraud)
        self.assertIs(calls[6][1][2], behavior)
        self.assertIs(calls[6][1][3], social)
        self.assertIs(calls[6][1][4], risk)
        self.assertIs(calls[6][1][5], profit)
        self.assertEqual(result["quant_scores"]["overallScore"], 82)
        self.assertEqual(result["ai_recommendations"]["ai_model"], "ai-orchestrator-v1")
