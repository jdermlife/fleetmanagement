from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.psychometric_engine import compute_psychometric_score


class PsychometricEngineTests(unittest.TestCase):
    def test_psychometric_engine_scores_new_50_question_assessment(self) -> None:
        answers = {f"q{index:02d}": "Strongly Agree" for index in range(1, 51)}
        payload = SimpleNamespace(requirements={"psychometricAssessment": answers})

        result = compute_psychometric_score(payload)

        self.assertEqual(result["discipline_score"], 100.0)
        self.assertEqual(result["planning_score"], 100.0)
        self.assertEqual(result["responsibility_score"], 100.0)
        self.assertEqual(result["honesty_score"], 100.0)
        self.assertEqual(result["resilience_score"], 100.0)
        self.assertEqual(result["overall_psychometric_score"], 100.0)
        self.assertEqual(result["questionnaire_answers"], answers)

    def test_psychometric_engine_keeps_legacy_questionnaire_support(self) -> None:
        legacy_answers = {f"question{index:02d}": "Strongly Agree" for index in range(1, 21)}
        payload = SimpleNamespace(requirements={"optionalPsychometricQuestionnaire": legacy_answers})

        result = compute_psychometric_score(payload)

        self.assertEqual(result["discipline_score"], 100.0)
        self.assertEqual(result["planning_score"], 100.0)
        self.assertEqual(result["overall_psychometric_score"], 100.0)

