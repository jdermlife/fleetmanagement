from app.cors import (
    DEFAULT_FRONTEND_ORIGIN_REGEX,
    get_allowed_frontend_origins,
    is_allowed_frontend_origin,
    parse_frontend_origins,
)


def test_parse_frontend_origins_discards_empty_entries():
    assert parse_frontend_origins(" https://one.example , ,https://two.example/ ") == [
        "https://one.example",
        "https://two.example/",
    ]


def test_allowed_frontend_origins_include_defaults_and_configured_values():
    origins = get_allowed_frontend_origins([
        "https://fleetmanagement-api.example.com",
        "https://fleetmanagement.vercel.app",
    ])

    assert "http://localhost:5173" in origins
    assert "https://fleetmanagement.vercel.app" in origins
    assert "https://fleetmanagement-api.example.com" in origins
    assert origins.count("https://fleetmanagement.vercel.app") == 1


def test_vercel_preview_origins_are_allowed_by_default_regex():
    preview_origins = [
        "https://fleetmanagement.vercel.app",
        "https://fleetmanagement-flame.vercel.app",
        "https://fleetmanagement-n8u4pr3bu-jdionedas-projects.vercel.app",
        "https://fleetmanagement-ib2xuqmve-jdionedas-projects.vercel.app",
    ]

    for origin in preview_origins:
        assert is_allowed_frontend_origin(origin, allowed_origins=[], origin_regex=DEFAULT_FRONTEND_ORIGIN_REGEX)


def test_non_matching_vercel_origin_is_rejected():
    assert not is_allowed_frontend_origin(
        "https://different-project.vercel.app",
        allowed_origins=[],
        origin_regex=DEFAULT_FRONTEND_ORIGIN_REGEX,
    )
