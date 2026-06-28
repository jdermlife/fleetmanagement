from __future__ import annotations

from typing import Any

from app.services.ai_orchestrator import compute_quant_score_package as orchestrate_quant_scores


def compute_quant_score_package(payload: Any) -> dict[str, Any]:
    return orchestrate_quant_scores(payload)
