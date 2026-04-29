from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DriverScorecardInput:
    driver_name: str
    license_class: str
    years_driving: float
    employment_years: float
    incidents_last_3_years: int
    violations_last_3_years: int
    training_hours: float
    on_time_rate: float
    customer_rating: float
    fatigue_events: int


def compute_driver_scorecard(payload: DriverScorecardInput) -> dict[str, float | str]:
    safety_component = _safety_component(
        incidents=payload.incidents_last_3_years,
        violations=payload.violations_last_3_years,
        fatigue_events=payload.fatigue_events,
    )
    compliance_component = _compliance_component(
        license_class=payload.license_class,
        training_hours=payload.training_hours,
    )
    experience_component = _experience_component(payload.years_driving)
    service_component = _service_component(
        on_time_rate=payload.on_time_rate,
        customer_rating=payload.customer_rating,
    )
    stability_component = _stability_component(payload.employment_years)

    final_score = round(
        safety_component * 0.35
        + compliance_component * 0.20
        + experience_component * 0.15
        + service_component * 0.20
        + stability_component * 0.10,
        2,
    )

    risk_grade = _risk_grade(final_score)
    recommendation = _recommendation(final_score)
    summary = (
        f"{payload.driver_name} scored {final_score:.2f}/100 with grade {risk_grade}. "
        f"The recommended management action is {recommendation}."
    )

    return {
        "safetyComponent": round(safety_component, 2),
        "complianceComponent": round(compliance_component, 2),
        "experienceComponent": round(experience_component, 2),
        "serviceComponent": round(service_component, 2),
        "stabilityComponent": round(stability_component, 2),
        "finalScore": final_score,
        "riskGrade": risk_grade,
        "recommendation": recommendation,
        "summary": summary,
    }


def _safety_component(*, incidents: int, violations: int, fatigue_events: int) -> float:
    penalty = incidents * 18 + violations * 9 + fatigue_events * 10
    return max(20.0, 100.0 - penalty)


def _compliance_component(*, license_class: str, training_hours: float) -> float:
    license_bonus = {
        "Professional": 18,
        "Commercial": 14,
        "Standard": 8,
    }.get(license_class, 5)

    training_bonus = min(training_hours, 40) * 1.4
    return min(100.0, 35.0 + license_bonus + training_bonus)


def _experience_component(years_driving: float) -> float:
    if years_driving >= 10:
        return 95
    if years_driving >= 7:
        return 86
    if years_driving >= 4:
        return 76
    if years_driving >= 2:
        return 64
    return 48


def _service_component(*, on_time_rate: float, customer_rating: float) -> float:
    punctuality_score = max(0.0, min(on_time_rate, 100.0))
    rating_score = max(0.0, min(customer_rating, 5.0)) * 20
    return punctuality_score * 0.65 + rating_score * 0.35


def _stability_component(employment_years: float) -> float:
    if employment_years >= 6:
        return 94
    if employment_years >= 4:
        return 84
    if employment_years >= 2:
        return 72
    if employment_years >= 1:
        return 58
    return 42


def _risk_grade(final_score: float) -> str:
    if final_score >= 90:
        return "A"
    if final_score >= 80:
        return "B"
    if final_score >= 68:
        return "C"
    if final_score >= 55:
        return "D"
    return "E"


def _recommendation(final_score: float) -> str:
    if final_score >= 85:
        return "Priority Assignment"
    if final_score >= 72:
        return "Standard Assignment"
    if final_score >= 60:
        return "Coaching Required"
    return "Restricted Assignment"
