from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from app.database import SessionLocal
from app.fastapi_auth import CurrentUser, get_current_user, require_roles
from app.models.notification import (
    Notification,
    NotificationDeadLetter,
    NotificationPreference,
    NotificationTemplate,
)
from app.schemas.notification_schema import (
    NotificationDeadLetterResponse,
    NotificationDispatchResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationReadResponse,
    NotificationResponse,
    NotificationSendRequest,
    NotificationTemplateCreate,
    NotificationTemplateResponse,
    NotificationTemplateUpdate,
    NotificationUnreadCountResponse,
)
from app.services.notification_service import (
    dispatch_queued_notifications,
    get_user_notifications,
    list_dead_letters,
    mark_all_notifications_read,
    mark_notification_read,
    queue_event_notifications,
    requeue_dead_letter,
    unread_count,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _dispatch_notifications_job(limit: int) -> None:
    db = SessionLocal()
    try:
        dispatch_queued_notifications(db, limit=limit)
    finally:
        db.close()


@router.post(
    "/templates",
    response_model=NotificationTemplateResponse,
    dependencies=[Depends(require_roles("admin", "operations", "credit_manager"))],
)
def create_template(payload: NotificationTemplateCreate, user: CurrentUser | None = Depends(get_current_user)):
    db = SessionLocal()
    try:
        template = NotificationTemplate(
            name=payload.name,
            event_type=payload.event_type,
            channel=payload.channel,
            subject_template=payload.subject_template,
            body_template=payload.body_template,
            is_active=payload.is_active,
            created_by=user.username if user else None,
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return NotificationTemplateResponse.model_validate(template)
    finally:
        db.close()


@router.get(
    "/templates",
    response_model=list[NotificationTemplateResponse],
    dependencies=[Depends(require_roles("admin", "operations", "credit_manager", "auditor"))],
)
def list_templates(event_type: str | None = Query(None)):
    db = SessionLocal()
    try:
        query = db.query(NotificationTemplate)
        if event_type:
            query = query.filter(NotificationTemplate.event_type == event_type)
        templates = query.order_by(NotificationTemplate.id.desc()).all()
        return [NotificationTemplateResponse.model_validate(row) for row in templates]
    finally:
        db.close()


@router.patch(
    "/templates/{template_id}",
    response_model=NotificationTemplateResponse,
    dependencies=[Depends(require_roles("admin", "operations", "credit_manager"))],
)
def update_template(template_id: int, payload: NotificationTemplateUpdate):
    db = SessionLocal()
    try:
        template = db.query(NotificationTemplate).filter(NotificationTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        if payload.subject_template is not None:
            template.subject_template = payload.subject_template
        if payload.body_template is not None:
            template.body_template = payload.body_template
        if payload.is_active is not None:
            template.is_active = payload.is_active

        db.commit()
        db.refresh(template)
        return NotificationTemplateResponse.model_validate(template)
    finally:
        db.close()


@router.put("/preferences/{event_type}", response_model=NotificationPreferenceResponse)
def upsert_preference(
    event_type: str,
    payload: NotificationPreferenceUpdate,
    user: CurrentUser | None = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = SessionLocal()
    try:
        pref = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user.id,
            NotificationPreference.event_type == event_type,
        ).first()

        if not pref:
            pref = NotificationPreference(user_id=user.id, event_type=event_type)
            db.add(pref)

        pref.in_app_enabled = payload.in_app_enabled
        pref.email_enabled = payload.email_enabled
        pref.sms_enabled = payload.sms_enabled
        pref.webhook_enabled = payload.webhook_enabled
        pref.webhook_url = payload.webhook_url
        pref.quiet_hours_start = payload.quiet_hours_start
        pref.quiet_hours_end = payload.quiet_hours_end

        db.commit()
        db.refresh(pref)
        return NotificationPreferenceResponse.model_validate(pref)
    finally:
        db.close()


@router.get("/preferences", response_model=list[NotificationPreferenceResponse])
def list_preferences(user: CurrentUser | None = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = SessionLocal()
    try:
        rows = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user.id
        ).order_by(NotificationPreference.event_type.asc()).all()
        return [NotificationPreferenceResponse.model_validate(row) for row in rows]
    finally:
        db.close()


@router.post(
    "/send",
    response_model=list[NotificationResponse],
    dependencies=[Depends(require_roles("admin", "operations", "credit_manager", "approver"))],
)
def send_notifications(payload: NotificationSendRequest, user: CurrentUser | None = Depends(get_current_user)):
    db = SessionLocal()
    try:
        recipients = [
            {
                "user_id": recipient.user_id,
                "email": recipient.email,
                "phone": recipient.phone,
                "webhook_url": recipient.webhook_url,
            }
            for recipient in payload.recipients
        ]

        notifications = queue_event_notifications(
            db,
            event_type=payload.event_type,
            recipients=recipients,
            context={
                "title": payload.title,
                "message": payload.message,
                **(payload.payload or {}),
            },
            fallback_title=payload.title,
            fallback_message=payload.message,
            priority=payload.priority,
            source_table=payload.source_table,
            source_record_id=payload.source_record_id,
            created_by=user.username if user else None,
        )

        return [NotificationResponse.model_validate(notification) for notification in notifications]
    finally:
        db.close()


@router.post(
    "/dispatch",
    response_model=NotificationDispatchResponse,
    dependencies=[Depends(require_roles("admin", "operations", "credit_manager"))],
)
def dispatch_notifications(
    background_tasks: BackgroundTasks,
    limit: int = Query(100, ge=1, le=1000),
):
    background_tasks.add_task(_dispatch_notifications_job, limit)
    return NotificationDispatchResponse(
        processed=0,
        sent=0,
        failed=0,
    )


@router.get("/me", response_model=list[NotificationResponse])
def my_notifications(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: CurrentUser | None = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = SessionLocal()
    try:
        rows = get_user_notifications(db, user.id, limit=limit, offset=offset)
        return [NotificationResponse.model_validate(row) for row in rows]
    finally:
        db.close()


@router.post("/me/{notification_id}/read", response_model=NotificationReadResponse)
def mark_one_read(notification_id: int, user: CurrentUser | None = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = SessionLocal()
    try:
        row = mark_notification_read(db, notification_id, user.id)
        if not row:
            raise HTTPException(status_code=404, detail="Notification not found")

        return NotificationReadResponse(success=True, notification_id=row.id, read_at=row.read_at)
    finally:
        db.close()


@router.post("/me/read-all")
def mark_all_read(user: CurrentUser | None = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = SessionLocal()
    try:
        updated = mark_all_notifications_read(db, user.id)
        return {"success": True, "updated": updated}
    finally:
        db.close()


@router.get("/me/unread-count", response_model=NotificationUnreadCountResponse)
def my_unread_count(user: CurrentUser | None = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = SessionLocal()
    try:
        count = unread_count(db, user.id)
        return NotificationUnreadCountResponse(user_id=user.id, unread_count=count)
    finally:
        db.close()


@router.get(
    "/dead-letters",
    response_model=list[NotificationDeadLetterResponse],
    dependencies=[Depends(require_roles("admin", "operations", "auditor"))],
)
def get_dead_letters(limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0)):
    db = SessionLocal()
    try:
        rows = list_dead_letters(db, limit=limit, offset=offset)
        return [NotificationDeadLetterResponse.model_validate(row) for row in rows]
    finally:
        db.close()


@router.post(
    "/dead-letters/{dead_letter_id}/requeue",
    response_model=NotificationResponse,
    dependencies=[Depends(require_roles("admin", "operations"))],
)
def requeue_notification(dead_letter_id: int):
    db = SessionLocal()
    try:
        notification = requeue_dead_letter(db, dead_letter_id)
        if not notification:
            raise HTTPException(status_code=404, detail="Dead-letter notification not found")
        return NotificationResponse.model_validate(notification)
    finally:
        db.close()
