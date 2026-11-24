from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.routes.profile_search import generate_profile_search_links, router


def create_client(role: str) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[require_authenticated_user] = lambda: CurrentUser(
        id=1,
        username="test.user",
        role=role,
    )
    return TestClient(app)


def test_generate_profile_search_links_includes_requested_sources():
    links = generate_profile_search_links("Jane Doe")

    assert [link.platform for link in links[:5]] == [
        "Google",
        "Facebook",
        "LinkedIn",
        "Instagram",
        "YouTube",
    ]
    assert all("Jane" in link.url for link in links)
    assert {link.category for link in links} >= {
        "Contact",
        "Employment",
        "Location",
    }


def test_profile_search_is_admin_only():
    with create_client("subscriber") as client:
        response = client.post(
            "/api/admin/profile-search",
            json={"account_name": "Jane Doe"},
        )

    assert response.status_code == 403


def test_profile_search_normalizes_name_and_returns_links_for_admin():
    with create_client("Admin") as client:
        response = client.post(
            "/api/admin/profile-search",
            json={"account_name": "  Jane   Doe  "},
        )

    assert response.status_code == 200
    assert response.json()["account_name"] == "Jane Doe"
    assert len(response.json()["links"]) == 9
