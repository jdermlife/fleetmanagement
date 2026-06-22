"""Document management API routes."""

from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.fastapi_auth import get_current_user, require_roles, CurrentUser
from app.models.document import DocumentType, DocumentStatus, EntityType
from app.schemas.document_schema import (
    DocumentUploadRequest,
    DocumentResponse,
    DocumentListResponse,
    DocumentHistoryResponse,
    DocumentVersionResponse,
    DocumentExpiryResponse,
    DocumentSignRequest,
    DocumentSignResponse,
    DocumentArchiveRequest,
    DocumentRestoreRequest,
    BulkDocumentExpiryResponse,
    DocumentSearchResponse,
    DocumentSignatureResponse,
)
from app.services.document_service import DocumentRepository, DocumentStorageService
from app.database import SessionLocal
from app.models.notification import NotificationPriority
from app.services.notification_service import queue_event_notifications

# Initialize services
storage_service = DocumentStorageService()
document_repo = DocumentRepository(storage_service)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    dependencies=[Depends(require_roles("admin", "loan_officer", "credit_analyst", "credit_manager", "approver", "borrower", "driver", "leasor", "leasee", "operations"))],
)


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    entity_type: EntityType = Query(...),
    entity_id: int = Query(...),
    document_type: DocumentType = Query(...),
    expiry_date: Optional[datetime] = Query(None),
    tags: Optional[str] = Query(None),  # Comma-separated
    upload_reason: Optional[str] = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentResponse:
    """
    Upload a new document.
    
    - **entity_type**: loan, borrower, vehicle, driver, leasor, leasee
    - **entity_id**: ID of the entity
    - **document_type**: payslip, bank_statement, vehicle_or_cr, insurance, contract, id_document, proof_of_address, other
    - **expiry_date**: Optional expiry date (ISO format)
    - **tags**: Optional comma-separated tags
    - **upload_reason**: Why uploading (e.g., "Updated payslip for June")
    """
    
    # Read file
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")
    
    # Parse tags
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    
    # Get MIME type
    mime_type = file.content_type or "application/octet-stream"
    
    try:
        # Create document
        doc = document_repo.create_document(
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            document_type=document_type,
            filename=file.filename or "document",
            file_content=content,
            expiry_date=expiry_date,
            tags=tag_list,
            upload_reason=upload_reason,
            uploaded_by=current_user.username,
            mime_type=mime_type,
        )
        
        return DocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentResponse:
    """Get document details with current version."""
    
    doc = document_repo.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentResponse.model_validate(doc)


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    version_number: Optional[int] = Query(None, description="Specific version (latest if not specified)"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Download document file."""
    
    doc = document_repo.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get version
    if version_number:
        version = document_repo.get_document_by_version(db, document_id, version_number)
        if not version:
            raise HTTPException(status_code=404, detail="Document version not found")
    else:
        # Get current version
        if not doc.current_version_id:
            raise HTTPException(status_code=400, detail="Document has no stored version")
        version = db.query(DocumentVersion).filter(
            DocumentVersion.id == doc.current_version_id
        ).first()
        if not version:
            raise HTTPException(status_code=404, detail="Current version not found")
    
    # Retrieve file
    try:
        file_content = storage_service.retrieve_file(version.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found in storage")
    
    return {
        "filename": doc.original_filename,
        "content": file_content,
        "mime_type": version.mime_type or "application/octet-stream",
        "version": version.version_number,
    }


@router.get("/{document_id}/versions", response_model=DocumentHistoryResponse)
async def get_document_history(
    document_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentHistoryResponse:
    """Get version history for document."""
    
    doc = document_repo.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    versions = document_repo.get_document_versions(db, document_id, limit)
    
    return DocumentHistoryResponse(
        document_id=document_id,
        total_versions=len(versions),
        versions=[DocumentVersionResponse.model_validate(v) for v in versions],
    )


@router.post("/{document_id}/sign", response_model=DocumentSignResponse)
async def sign_document(
    document_id: int,
    request: DocumentSignRequest,
    version_number: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentSignResponse:
    """Add digital signature to document."""
    
    doc = document_repo.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get version
    if version_number:
        version = document_repo.get_document_by_version(db, document_id, version_number)
    else:
        from app.models.document import DocumentVersion
        version = db.query(DocumentVersion).filter(
            DocumentVersion.id == doc.current_version_id
        ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Document version not found")
    
    try:
        signature = document_repo.add_signature(
            db=db,
            document_id=document_id,
            version_id=version.id,
            signature_type=request.signature_type,
            signature_data=request.signature_data,
            signed_by=current_user.username,
            certificate_id=request.certificate_id,
        )
        
        return DocumentSignResponse(
            success=True,
            message="Document signed successfully",
            signature_id=signature.id,
            signed_at=signature.signed_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{document_id}/signatures", response_model=List[DocumentSignatureResponse])
async def get_document_signatures(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> List[DocumentSignatureResponse]:
    """Get all signatures for a document."""
    
    from app.models.document import DocumentSignature
    
    doc = document_repo.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    signatures = db.query(DocumentSignature).filter(
        DocumentSignature.document_id == document_id
    ).order_by(DocumentSignature.signed_at.desc()).all()
    
    return [DocumentSignatureResponse.model_validate(s) for s in signatures]


@router.get("/entity/{entity_type}/{entity_id}", response_model=List[DocumentListResponse])
async def get_entity_documents(
    entity_type: EntityType,
    entity_id: int,
    document_type: Optional[DocumentType] = Query(None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> List[DocumentListResponse]:
    """Get all documents for an entity."""
    
    docs = document_repo.get_documents_for_entity(
        db,
        entity_type,
        entity_id,
        document_type,
    )
    
    results = []
    for doc in docs:
        days_until_expiry = None
        is_expiring = False
        
        if doc.expiry_date:
            days_until_expiry = (doc.expiry_date - datetime.utcnow()).days
            is_expiring = 0 <= days_until_expiry <= 30
        
        from app.models.document import DocumentVersion
        latest_version = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == doc.id
        ).order_by(DocumentVersion.created_at.desc()).first()
        
        results.append(DocumentListResponse(
            id=doc.id,
            entity_type=doc.entity_type,
            entity_id=doc.entity_id,
            document_type=doc.document_type,
            original_filename=doc.original_filename,
            status=doc.status,
            expiry_date=doc.expiry_date,
            is_active=doc.is_active,
            version_count=len(doc.versions),
            latest_upload_at=latest_version.uploaded_at if latest_version else doc.created_at,
            is_expiring_soon=is_expiring,
            created_by=doc.created_by,
        ))
    
    return results


@router.get("/expiry/upcoming", response_model=List[DocumentExpiryResponse])
async def get_expiring_documents(
    days_threshold: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("admin", "credit_manager", "operations", "auditor")),
) -> List[DocumentExpiryResponse]:
    """Get documents expiring within threshold days."""
    
    docs = document_repo.get_expiring_documents(db, days_threshold)
    
    results = []
    for doc in docs:
        days_until_expiry = (doc.expiry_date - datetime.utcnow()).days
        
        results.append(DocumentExpiryResponse(
            id=doc.id,
            document_type=doc.document_type,
            original_filename=doc.original_filename,
            expiry_date=doc.expiry_date,
            days_until_expiry=days_until_expiry,
            is_expired=False,
            entity_type=doc.entity_type,
            entity_id=doc.entity_id,
        ))
    
    return results


@router.get("/expiry/bulk-check", response_model=BulkDocumentExpiryResponse)
async def bulk_expiry_check(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("admin", "credit_manager", "operations", "auditor")),
) -> BulkDocumentExpiryResponse:
    """Get comprehensive expiry status for all documents."""
    
    from app.models.document import Document
    
    # Update expired statuses
    document_repo.update_expiry_statuses(db)
    
    # Get counts
    all_docs = db.query(Document).filter(Document.is_active == True).all()
    active_docs = [d for d in all_docs if d.status == DocumentStatus.ACTIVE]
    expired_docs = [d for d in all_docs if d.status == DocumentStatus.EXPIRED]
    
    expiring_30 = document_repo.get_expiring_documents(db, 30)
    expiring_7 = document_repo.get_expiring_documents(db, 7)

    # Emit summary notification for operations and risk roles.
    if expiring_7:
        session_db = SessionLocal()
        try:
            recipients = []
            for role in ["admin", "operations", "credit_manager", "auditor"]:
                rows = session_db.execute(
                    "SELECT id, email FROM users WHERE lower(role) = :role AND is_active = true",
                    {"role": role},
                ).fetchall()
                recipients.extend(
                    {
                        "user_id": row[0],
                        "email": row[1],
                        "phone": None,
                        "webhook_url": None,
                    }
                    for row in rows
                )

            if recipients:
                queue_event_notifications(
                    session_db,
                    event_type="document.expiry.warning",
                    recipients=recipients,
                    context={
                        "expiring_within_7_days": len(expiring_7),
                        "expiring_within_30_days": len(expiring_30),
                        "checked_by": current_user.username if current_user else "system",
                    },
                    fallback_title="Document expiry warning",
                    fallback_message=(
                        f"{len(expiring_7)} documents expire within 7 days and "
                        f"{len(expiring_30)} within 30 days."
                    ),
                    priority=NotificationPriority.CRITICAL,
                    source_table="documents",
                    source_record_id="bulk-expiry-check",
                    created_by=current_user.username if current_user else None,
                )
        finally:
            session_db.close()
    
    # Build response
    documents = []
    for doc in expiring_30:
        days_until_expiry = (doc.expiry_date - datetime.utcnow()).days
        
        documents.append(DocumentExpiryResponse(
            id=doc.id,
            document_type=doc.document_type,
            original_filename=doc.original_filename,
            expiry_date=doc.expiry_date,
            days_until_expiry=days_until_expiry,
            is_expired=False,
            entity_type=doc.entity_type,
            entity_id=doc.entity_id,
        ))
    
    return BulkDocumentExpiryResponse(
        total_documents=len(all_docs),
        active_documents=len(active_docs),
        expired_documents=len(expired_docs),
        expiring_within_30_days=len(expiring_30),
        expiring_within_7_days=len(expiring_7),
        documents=documents,
    )


@router.post("/{document_id}/archive", response_model=DocumentResponse)
async def archive_document(
    document_id: int,
    request: DocumentArchiveRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("admin", "credit_manager", "operations")),
) -> DocumentResponse:
    """Archive a document."""
    
    try:
        doc = document_repo.archive_document(db, document_id)
        return DocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document(
    document_id: int,
    request: DocumentRestoreRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("admin", "credit_manager", "operations")),
) -> DocumentResponse:
    """Restore archived document."""
    
    try:
        doc = document_repo.restore_document(db, document_id)
        return DocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{document_id}/cleanup-versions")
async def cleanup_old_versions(
    document_id: int,
    keep_count: int = Query(3, ge=1),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("admin", "operations")),
):
    """Delete old versions, keeping only recent ones."""
    
    try:
        deleted_count = document_repo.delete_old_versions(db, document_id, keep_count)
        return {
            "success": True,
            "message": f"Deleted {deleted_count} old versions",
            "deleted_count": deleted_count,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/search/{query}", response_model=List[DocumentSearchResponse])
async def search_documents(
    query: str,
    entity_type: Optional[EntityType] = Query(None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> List[DocumentSearchResponse]:
    """Search documents by filename or tag."""
    
    if len(query) < 3:
        raise HTTPException(status_code=400, detail="Search query must be at least 3 characters")
    
    docs = document_repo.search_documents(db, query, entity_type)
    
    results = []
    for doc in docs:
        # Determine match reason
        match_reason = "filename match"
        if query.lower() in doc.original_filename.lower():
            match_reason = "filename match"
        elif any(query.lower() in tag.tag.lower() for tag in doc.tags):
            match_reason = "tag match"
        
        results.append(DocumentSearchResponse(
            id=doc.id,
            entity_type=doc.entity_type,
            entity_id=doc.entity_id,
            document_type=doc.document_type,
            original_filename=doc.original_filename,
            status=doc.status,
            created_at=doc.created_at,
            match_reason=match_reason,
        ))
    
    return results


# Import at end to avoid circular imports
from app.models.document import DocumentVersion
