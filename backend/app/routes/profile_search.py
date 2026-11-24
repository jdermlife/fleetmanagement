from urllib.parse import quote_plus

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.fastapi_auth import require_roles


router = APIRouter(
    prefix="/admin/profile-search",
    tags=["admin-profile-search"],
    dependencies=[Depends(require_roles("admin"))],
)


class ProfileSearchRequest(BaseModel):
    account_name: str = Field(min_length=2, max_length=120)

    @field_validator("account_name")
    @classmethod
    def normalize_account_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("Enter at least two characters")
        return normalized


class ProfileSearchLink(BaseModel):
    id: str
    platform: str
    category: str
    description: str
    url: str


class ProfileSearchResponse(BaseModel):
    account_name: str
    links: list[ProfileSearchLink]


def generate_profile_search_links(account_name: str) -> list[ProfileSearchLink]:
    encoded_name = quote_plus(account_name)
    quoted_name = quote_plus(f'"{account_name}"')

    return [
        ProfileSearchLink(
            id="google",
            platform="Google",
            category="Web",
            description="Search the public web for this exact name.",
            url=f"https://www.google.com/search?q={quoted_name}",
        ),
        ProfileSearchLink(
            id="facebook",
            platform="Facebook",
            category="Social",
            description="Search public Facebook profiles and pages.",
            url=f"https://www.facebook.com/search/top/?q={encoded_name}",
        ),
        ProfileSearchLink(
            id="linkedin",
            platform="LinkedIn",
            category="Professional",
            description="Search LinkedIn people, posts, companies, and groups.",
            url=f"https://www.linkedin.com/search/results/all/?keywords={encoded_name}",
        ),
        ProfileSearchLink(
            id="instagram",
            platform="Instagram",
            category="Social",
            description="Search public Instagram profiles indexed by Google.",
            url=f"https://www.google.com/search?q={quoted_name}+site%3Ainstagram.com",
        ),
        ProfileSearchLink(
            id="youtube",
            platform="YouTube",
            category="Video",
            description="Search public YouTube channels and videos.",
            url=f"https://www.youtube.com/results?search_query={encoded_name}",
        ),
        ProfileSearchLink(
            id="contact",
            platform="Google",
            category="Contact",
            description="Look for publicly listed contact or telephone information.",
            url=f"https://www.google.com/search?q={quoted_name}+contact+telephone",
        ),
        ProfileSearchLink(
            id="employment",
            platform="Google",
            category="Employment",
            description="Look for public employment and employer references.",
            url=f"https://www.google.com/search?q={quoted_name}+employment+employer",
        ),
        ProfileSearchLink(
            id="residence",
            platform="Google",
            category="Location",
            description="Look for public city or residence references.",
            url=f"https://www.google.com/search?q={quoted_name}+city+residence",
        ),
        ProfileSearchLink(
            id="news",
            platform="Google",
            category="News",
            description="Look for public news and other web references.",
            url=f"https://www.google.com/search?q={quoted_name}+news",
        ),
    ]


@router.post("", response_model=ProfileSearchResponse)
def create_profile_search(payload: ProfileSearchRequest) -> ProfileSearchResponse:
    return ProfileSearchResponse(
        account_name=payload.account_name,
        links=generate_profile_search_links(payload.account_name),
    )
