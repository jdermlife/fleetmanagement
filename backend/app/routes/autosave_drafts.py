from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.models.autosave_draft import AutosaveDraft
from app.schemas.autosave_draft_schema import (
    AutosaveDraftResponse,
    AutosaveDraftUpsert,
)


DRAFT_TTL = timedelta(days=30)

router = APIRouter(prefix="/drafts", tags=["Autosave Drafts"])


def _owned_draft_query(
    db: Session,
    *,
    owner_id: int,
    scope: str,
    entity_key: str,
):
    return db.query(AutosaveDraft).filter(
        AutosaveDraft.owner_id == owner_id,
        AutosaveDraft.scope == scope,
        AutosaveDraft.entity_key == entity_key,
    )


def _is_expired(expires_at: datetime, now: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now


def _revision_conflict(expected_revision: int, current_revision: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "message": "Draft revision conflict",
            "expected_revision": expected_revision,
            "current_revision": current_revision,
        },
    )


@router.get(
    "/{scope}/{entity_key}",
    response_model=AutosaveDraftResponse,
)
def get_autosave_draft(
    scope: str = Path(min_length=1, max_length=128),
    entity_key: str = Path(min_length=1, max_length=255),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    draft = _owned_draft_query(
        db,
        owner_id=user.id,
        scope=scope,
        entity_key=entity_key,
    ).first()

    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    if _is_expired(draft.expires_at, datetime.now(timezone.utc)):
        db.delete(draft)
        db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    return draft


@router.put(
    "/{scope}/{entity_key}",
    response_model=AutosaveDraftResponse,
)
def put_autosave_draft(
    payload: AutosaveDraftUpsert,
    scope: str = Path(min_length=1, max_length=128),
    entity_key: str = Path(min_length=1, max_length=255),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    now = datetime.now(timezone.utc)
    query = _owned_draft_query(
        db,
        owner_id=user.id,
        scope=scope,
        entity_key=entity_key,
    )
    draft = query.first()

    if draft is not None and _is_expired(draft.expires_at, now):
        db.delete(draft)
        db.flush()
        draft = None

    if draft is None:
        if payload.expected_revision != 0:
            db.rollback()
            raise _revision_conflict(payload.expected_revision, 0)

        draft = AutosaveDraft(
            owner_id=user.id,
            scope=scope,
            entity_key=entity_key,
            payload=payload.payload,
            revision=1,
            expires_at=now + DRAFT_TTL,
            created_at=now,
            updated_at=now,
        )
        db.add(draft)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            current = query.first()
            current_revision = current.revision if current is not None else 0
            raise _revision_conflict(
                payload.expected_revision,
                current_revision,
            ) from exc
        db.refresh(draft)
        return draft

    if payload.expected_revision != draft.revision:
        raise _revision_conflict(payload.expected_revision, draft.revision)

    next_revision = draft.revision + 1
    result = db.execute(
        update(AutosaveDraft)
        .where(
            AutosaveDraft.id == draft.id,
            AutosaveDraft.owner_id == user.id,
            AutosaveDraft.revision == payload.expected_revision,
        )
        .values(
            payload=payload.payload,
            revision=next_revision,
            expires_at=now + DRAFT_TTL,
            updated_at=now,
        )
    )

    if result.rowcount != 1:
        db.rollback()
        current = query.first()
        current_revision = current.revision if current is not None else 0
        raise _revision_conflict(payload.expected_revision, current_revision)

    db.commit()
    updated_draft = query.first()
    if updated_draft is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft changed while it was being saved",
        )
    return updated_draft


@router.delete(
    "/{scope}/{entity_key}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_autosave_draft(
    scope: str = Path(min_length=1, max_length=128),
    entity_key: str = Path(min_length=1, max_length=255),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
) -> Response:
    draft = _owned_draft_query(
        db,
        owner_id=user.id,
        scope=scope,
        entity_key=entity_key,
    ).first()
    if draft is not None:
        db.delete(draft)
        db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
