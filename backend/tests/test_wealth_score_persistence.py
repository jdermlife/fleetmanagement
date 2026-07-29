from datetime import datetime, timezone
from types import SimpleNamespace

from app.routes import loan_routes
from app.schemas.loan_schema import WealthScoreUpdatePayload


def test_update_stored_wealth_score_reuses_overall_score_and_preserves_lending_fields(
    monkeypatch,
):
    application_no = "APP-WEALTH-1"
    overall_score = SimpleNamespace(
        id=7,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        final_grade="A",
        final_rating="Low Risk",
    )
    record = SimpleNamespace(
        id=3,
        application_no=application_no,
        overall_scores=[overall_score],
        updated_by=None,
    )

    class FakeSession:
        commits = 0
        refreshes = 0

        def commit(self):
            self.commits += 1

        def refresh(self, refreshed_record):
            assert refreshed_record is record
            self.refreshes += 1

        def rollback(self):
            raise AssertionError("Wealth score update should not roll back")

        def close(self):
            pass

    session = FakeSession()
    monkeypatch.setattr(loan_routes, "SessionLocal", lambda: session)
    monkeypatch.setattr(
        loan_routes,
        "get_loan_application_or_404",
        lambda _db, requested_no: record if requested_no == application_no else None,
    )
    monkeypatch.setattr(loan_routes, "enforce_loan_application_access", lambda *_args: None)
    monkeypatch.setattr(loan_routes, "invalidate_dashboard_statistics_cache", lambda: None)

    user = SimpleNamespace(id=42, username="tester", role="Subscriber")
    first_payload = WealthScoreUpdatePayload(
        wealth_building_score=715.25,
        wealth_grade="B+",
        wealth_rating="Strong",
        wealth_component_scores={"netWorthStrength": 78.5, "liquidityBuffer": 64.0},
        wealth_certification_status="GENERATED_PENDING",
    )
    second_payload = first_payload.model_copy(
        update={
            "wealth_building_score": 742.5,
            "wealth_grade": "A-",
            "wealth_rating": "Very Strong",
            "wealth_certification_status": "GENERATED_COMPLETE",
        }
    )

    loan_routes.update_stored_wealth_score(application_no, first_payload, user)
    result = loan_routes.update_stored_wealth_score(application_no, second_payload, user)

    assert len(record.overall_scores) == 1
    assert overall_score.wealth_building_score == 742.5
    assert overall_score.wealth_grade == "A-"
    assert overall_score.wealth_rating == "Very Strong"
    assert overall_score.wealth_component_scores == {
        "netWorthStrength": 78.5,
        "liquidityBuffer": 64.0,
    }
    assert overall_score.wealth_certification_status == "GENERATED_COMPLETE"
    assert overall_score.wealth_calculated_at.tzinfo is not None
    assert overall_score.final_grade == "A"
    assert overall_score.final_rating == "Low Risk"
    assert record.updated_by == 42
    assert session.commits == 2
    assert session.refreshes == 2
    assert result["application_no"] == application_no
    assert result["wealth_score"]["wealth_building_score"] == 742.5