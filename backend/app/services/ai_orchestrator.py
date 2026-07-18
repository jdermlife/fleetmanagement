from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.services import (
    credit_risk_engine,
    credit_scoring_engine,
    decision_engine,
    fraud_scoring_engine,
    profitability_engine,
    psychometric_engine,
    social_scoring_engine,
)


class ApplicationEngine(Protocol):
    def evaluate(self, application: Any, *args: Any) -> dict[str, Any]:
        ...


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _build_ai_explanation(
    credit: dict[str, Any],
    fraud: dict[str, Any],
    behavior: dict[str, Any],
    social: dict[str, Any],
    risk: dict[str, Any],
    profit: dict[str, Any],
    decision: dict[str, Any],
) -> str:
    return (
        "AI orchestrator combined credit "
        f"({ _to_int(credit.get('total_credit_score')) }), fraud "
        f"({ _to_int(fraud.get('overall_fraud_score')) }), psychometric "
        f"({ _to_int(behavior.get('overall_psychometric_score')) }), social "
        f"({ _to_int(social.get('overall_social_score')) }), credit risk "
        f"({ _to_int(risk.get('overall_credit_risk_score')) }), and profitability "
        f"({ _to_int(profit.get('profitability_score')) }) into a "
        f"{decision['decision']} recommendation."
    )


@dataclass(slots=True)
class AIOrchestrator:
    credit_engine: ApplicationEngine = credit_scoring_engine
    fraud_engine: ApplicationEngine = fraud_scoring_engine
    psychometric_engine: ApplicationEngine = psychometric_engine
    social_engine: ApplicationEngine = social_scoring_engine
    credit_risk_engine: ApplicationEngine = credit_risk_engine
    profitability_engine: ApplicationEngine = profitability_engine
    decision_engine: ApplicationEngine = decision_engine
    model_name: str = "ai-orchestrator-v1"

    def evaluate(self, application: Any) -> dict[str, Any]:
        credit = self.credit_engine.evaluate(application)
        fraud = self.fraud_engine.evaluate(application)
        behavior = self.psychometric_engine.evaluate(application)
        social = self.social_engine.evaluate(application)
        risk = self.credit_risk_engine.evaluate(application, credit, fraud)
        profit = self.profitability_engine.evaluate(application)
        decision = self.decision_engine.evaluate(
            credit,
            fraud,
            behavior,
            social,
            risk,
            profit,
        )

        overall_scores = {
            "credit_score": _to_float(credit.get("total_credit_score")),
            "fraud_score": _to_float(fraud.get("overall_fraud_score")),
            "social_score": _to_float(social.get("overall_social_score")),
            "psychometric_score": _to_float(behavior.get("overall_psychometric_score")),
            "collateral_score": _to_float(
                risk.get("collateral_scores", {}).get("overall_collateral_score")
            ),
            "profitability_score": _to_float(profit.get("profitability_score")),
            "relationship_score": _to_float(
                risk.get("relationship_scores", {}).get("relationship_score")
            ),
            "final_score": _to_float(decision.get("final_score")),
            "composite_score": _to_float(decision.get("composite_score")),
            "final_grade": str(decision.get("final_grade", "")),
            "final_rating": str(decision.get("final_rating", "")),
            "final_decision": str(decision.get("decision", "")),
        }

        ai_recommendations = {
            "recommendation": overall_scores["final_decision"],
            "confidence_score": overall_scores["final_score"],
            "explanation": _build_ai_explanation(
                credit,
                fraud,
                behavior,
                social,
                risk,
                profit,
                decision,
            ),
            "suggested_amount": _to_float(getattr(application, "loan_amount", 0.0), 0.0),
            "ai_model": self.model_name,
        }

        quant_scores = {
            "creditScore": _to_int(overall_scores["credit_score"]),
            "fraudScore": _to_int(overall_scores["fraud_score"]),
            "socialScore": _to_int(overall_scores["social_score"]),
            "psychometricScore": _to_int(overall_scores["psychometric_score"]),
            "relationshipScore": _to_int(overall_scores["relationship_score"]),
            "profitabilityScore": _to_int(overall_scores["profitability_score"]),
            "overallScore": _to_int(overall_scores["final_score"]),
            "compositeScore": _to_int(overall_scores["composite_score"]),
            "finalGrade": overall_scores["final_grade"],
            "finalRating": overall_scores["final_rating"],
            "decision": overall_scores["final_decision"],
        }

        return {
            "credit_scores": credit,
            "fraud_scores": fraud,
            "social_scores": social,
            "psychometric_scores": behavior,
            "credit_bureau_reports": risk["credit_bureau_reports"],
            "collateral_scores": risk["collateral_scores"],
            "profitability_scores": profit,
            "relationship_scores": risk["relationship_scores"],
            "credit_risk": risk,
            "decision": decision,
            "ai_recommendations": ai_recommendations,
            "overall_scores": overall_scores,
            "quant_scores": quant_scores,
        }


def compute_quant_score_package(application: Any) -> dict[str, Any]:
    return AIOrchestrator().evaluate(application)
