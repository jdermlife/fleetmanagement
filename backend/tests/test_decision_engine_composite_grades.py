from app.services import decision_engine


def test_composite_grade_bands_match_required_thresholds() -> None:
    cases = [
        (1000, "A++", "World Class"),
        (950, "A++", "World Class"),
        (949, "A+", "Exceptional"),
        (900, "A+", "Exceptional"),
        (899, "A", "Excellent"),
        (850, "A", "Excellent"),
        (849, "B+", "Very Good"),
        (800, "B+", "Very Good"),
        (799, "B", "Good"),
        (750, "B", "Good"),
        (749, "C+", "Fair"),
        (700, "C+", "Fair"),
        (699, "C", "Needs Improvement"),
        (650, "C", "Needs Improvement"),
        (649, "D", "High Risk"),
        (600, "D", "High Risk"),
        (599, "F", "Critical"),
        (0, "F", "Critical"),
    ]

    for score, expected_grade, expected_rating in cases:
        band = decision_engine._composite_grade_for_score(score)
        assert band.grade == expected_grade
        assert band.rating == expected_rating


def test_evaluate_returns_composite_score_and_rating() -> None:
    result = decision_engine.evaluate(
        {"total_credit_score": 85},
        {"overall_fraud_score": 85},
        {"overall_psychometric_score": 85},
        {"overall_social_score": 85},
        {"overall_credit_risk_score": 85},
        {"profitability_score": 70},
    )

    assert result["decision"] == "APPROVE"
    assert result["final_score"] == 83.0
    assert result["composite_score"] == 830
    assert result["final_grade"] == "B+"
    assert result["final_rating"] == "Very Good"
