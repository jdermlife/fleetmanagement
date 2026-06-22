"""Document management service - handles storage, versioning, and signatures."""

import hashlib
import os
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from pathlib import Path
import shutil

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.document import (
    Document,
    DocumentVersion,
    DocumentTag,
    DocumentSignature,
    DocumentType,
    DocumentStatus,
    EntityType,
)
from app.schemas.document_schema import (
    DocumentUploadRequest,
    DocumentSignRequest,
)


class DocumentStorageService:
    """Handles file storage, retrieval, and versioning."""
    
    def __init__(self, base_storage_path: str = "./documents"):
        """Initialize storage service."""
        self.base_path = Path(base_storage_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def get_document_path(
        self,
        entity_type: EntityType,
        entity_id: int,
        document_type: DocumentType,
        version_number: int
    ) -> Path:
        """Get storage path for a document version."""
        path = (
            self.base_path /
            entity_type.value /
            str(entity_id) /
            document_type.value /
            f"v{version_number}"
        )
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def calculate_file_hash(self, file_content: bytes) -> str:
        """Calculate SHA256 hash of file."""
        return hashlib.sha256(file_content).hexdigest()
    
    def store_file(
        self,
        file_content: bytes,
        entity_type: EntityType,
        entity_id: int,
        document_type: DocumentType,
        version_number: int,
        filename: str
    ) -> Tuple[str, str, float]:
        """Store file and return path, hash, and size."""
        path = self.get_document_path(entity_type, entity_id, document_type, version_number)
        file_path = path / filename
        
        # Write file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Calculate hash
        file_hash = self.calculate_file_hash(file_content)
        file_size = len(file_content)
        
        # Return relative path
        relative_path = str(file_path.relative_to(self.base_path))
        
        return relative_path, file_hash, file_size
    
    def retrieve_file(self, file_path: str) -> bytes:
        """Retrieve file content by path."""
        full_path = self.base_path / file_path
        
        if not full_path.exists():
            raise FileNotFoundError(f"Document file not found: {file_path}")
        
        with open(full_path, "rb") as f:
            return f.read()
    
    def delete_file(self, file_path: str) -> bool:
        """Delete a stored file."""
        full_path = self.base_path / file_path
        
        if full_path.exists():
            full_path.unlink()
            return True
        
        return False
    
    def delete_version_directory(
        self,
        entity_type: EntityType,
        entity_id: int,
        document_type: DocumentType,
        version_number: int
    ) -> bool:
        """Delete entire version directory."""
        path = self.get_document_path(entity_type, entity_id, document_type, version_number)
        
        if path.exists():
            shutil.rmtree(path)
            return True
        
        return False


class DocumentRepository:
    """Handles database operations for documents."""
    
    def __init__(self, storage_service: Optional[DocumentStorageService] = None):
        """Initialize repository."""
        self.storage = storage_service or DocumentStorageService()
    
    def create_document(
        self,
        db: Session,
        entity_type: EntityType,
        entity_id: int,
        document_type: DocumentType,
        filename: str,
        file_content: bytes,
        expiry_date: Optional[datetime],
        tags: Optional[List[str]],
        upload_reason: Optional[str],
        uploaded_by: str,
        mime_type: Optional[str] = None,
    ) -> Document:
        """Create new document with initial version."""
        
        # Check if document already exists for this entity/type combo
        existing = db.query(Document).filter(
            and_(
                Document.entity_type == entity_type,
                Document.entity_id == entity_id,
                Document.document_type == document_type,
            )
        ).first()
        
        if existing:
            # Create new version instead
            return self.create_version(
                db,
                existing.id,
                file_content,
                filename,
                upload_reason,
                uploaded_by,
                mime_type,
            )
        
        # Create new document
        document = Document(
            entity_type=entity_type,
            entity_id=entity_id,
            document_type=document_type,
            original_filename=filename,
            expiry_date=expiry_date,
            status=DocumentStatus.ACTIVE,
            created_by=uploaded_by,
        )
        
        db.add(document)
        db.flush()  # Get document ID
        
        # Create first version
        version = self.create_version(
            db,
            document.id,
            file_content,
            filename,
            upload_reason,
            uploaded_by,
            mime_type,
        )
        
        # Set current version
        document.current_version_id = version.id
        
        # Add tags
        if tags:
            for tag in tags:
                tag_obj = DocumentTag(document_id=document.id, tag=tag)
                db.add(tag_obj)
        
        db.commit()
        return db.refresh(document) or document
    
    def create_version(
        self,
        db: Session,
        document_id: int,
        file_content: bytes,
        filename: str,
        upload_reason: Optional[str],
        uploaded_by: str,
        mime_type: Optional[str] = None,
    ) -> DocumentVersion:
        """Create new version of existing document."""
        
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Get next version number
        last_version = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == document_id
        ).order_by(DocumentVersion.version_number.desc()).first()
        
        version_number = (last_version.version_number + 1) if last_version else 1
        
        # Store file
        file_path, file_hash, file_size = self.storage.store_file(
            file_content,
            document.entity_type,
            document.entity_id,
            document.document_type,
            version_number,
            filename,
        )
        
        # Create version record
        version = DocumentVersion(
            document_id=document_id,
            version_number=version_number,
            file_path=file_path,
            file_hash=file_hash,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by=uploaded_by,
            upload_reason=upload_reason,
            is_signed=False,
        )
        
        db.add(version)
        db.commit()
        db.refresh(version)
        
        # Update document's current version
        document.current_version_id = version.id
        document.updated_at = datetime.utcnow()
        db.commit()
        
        return version
    
    def get_document(self, db: Session, document_id: int) -> Optional[Document]:
        """Get document by ID."""
        return db.query(Document).filter(Document.id == document_id).first()
    
    def get_documents_for_entity(
        self,
        db: Session,
        entity_type: EntityType,
        entity_id: int,
        document_type: Optional[DocumentType] = None,
    ) -> List[Document]:
        """Get all documents for an entity."""
        query = db.query(Document).filter(
            and_(
                Document.entity_type == entity_type,
                Document.entity_id == entity_id,
                Document.is_active == True,
            )
        )
        
        if document_type:
            query = query.filter(Document.document_type == document_type)
        
        return query.order_by(Document.created_at.desc()).all()
    
    def get_expiring_documents(
        self,
        db: Session,
        days_threshold: int = 30,
    ) -> List[Document]:
        """Get documents expiring within threshold days."""
        now = datetime.utcnow()
        expiry_date = now + timedelta(days=days_threshold)
        
        return db.query(Document).filter(
            and_(
                Document.expiry_date.isnot(None),
                Document.expiry_date <= expiry_date,
                Document.expiry_date > now,
                Document.is_active == True,
                Document.status == DocumentStatus.ACTIVE,
            )
        ).order_by(Document.expiry_date.asc()).all()
    
    def get_expired_documents(self, db: Session) -> List[Document]:
        """Get expired documents."""
        now = datetime.utcnow()
        
        return db.query(Document).filter(
            and_(
                Document.expiry_date.isnot(None),
                Document.expiry_date <= now,
                Document.is_active == True,
                Document.status != DocumentStatus.EXPIRED,
            )
        ).all()
    
    def get_document_versions(
        self,
        db: Session,
        document_id: int,
        limit: int = 10,
    ) -> List[DocumentVersion]:
        """Get version history for a document."""
        return db.query(DocumentVersion).filter(
            DocumentVersion.document_id == document_id
        ).order_by(DocumentVersion.version_number.desc()).limit(limit).all()
    
    def get_document_by_version(
        self,
        db: Session,
        document_id: int,
        version_number: int,
    ) -> Optional[DocumentVersion]:
        """Get specific document version."""
        return db.query(DocumentVersion).filter(
            and_(
                DocumentVersion.document_id == document_id,
                DocumentVersion.version_number == version_number,
            )
        ).first()
    
    def add_signature(
        self,
        db: Session,
        document_id: int,
        version_id: int,
        signature_type: str,
        signature_data: str,
        signed_by: str,
        certificate_id: Optional[str] = None,
    ) -> DocumentSignature:
        """Add digital signature to document."""
        
        document = self.get_document(db, document_id)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        version = db.query(DocumentVersion).filter(
            DocumentVersion.id == version_id
        ).first()
        if not version:
            raise ValueError(f"Document version {version_id} not found")
        
        # Calculate signature hash
        signature_hash = hashlib.sha256(signature_data.encode()).hexdigest()
        
        # Create signature record
        signature = DocumentSignature(
            document_id=document_id,
            version_id=version_id,
            signature_type=signature_type,
            signature_data=signature_data,
            signature_hash=signature_hash,
            signed_by=signed_by,
            certificate_id=certificate_id,
            is_valid=True,
        )
        
        db.add(signature)
        
        # Mark version as signed
        version.is_signed = True
        
        # Update document status if all versions signed
        document.status = DocumentStatus.SIGNED
        
        db.commit()
        db.refresh(signature)
        
        return signature
    
    def invalidate_signature(
        self,
        db: Session,
        signature_id: int,
        reason: str,
    ) -> DocumentSignature:
        """Invalidate a digital signature."""
        
        signature = db.query(DocumentSignature).filter(
            DocumentSignature.id == signature_id
        ).first()
        
        if not signature:
            raise ValueError(f"Signature {signature_id} not found")
        
        signature.is_valid = False
        signature.invalidated_at = datetime.utcnow()
        signature.invalidation_reason = reason
        
        db.commit()
        db.refresh(signature)
        
        return signature
    
    def add_tag(
        self,
        db: Session,
        document_id: int,
        tag: str,
    ) -> DocumentTag:
        """Add tag to document."""
        
        # Check if tag already exists
        existing = db.query(DocumentTag).filter(
            and_(
                DocumentTag.document_id == document_id,
                DocumentTag.tag == tag,
            )
        ).first()
        
        if existing:
            return existing
        
        tag_obj = DocumentTag(document_id=document_id, tag=tag)
        db.add(tag_obj)
        db.commit()
        db.refresh(tag_obj)
        
        return tag_obj
    
    def remove_tag(
        self,
        db: Session,
        document_id: int,
        tag: str,
    ) -> bool:
        """Remove tag from document."""
        
        tag_obj = db.query(DocumentTag).filter(
            and_(
                DocumentTag.document_id == document_id,
                DocumentTag.tag == tag,
            )
        ).first()
        
        if tag_obj:
            db.delete(tag_obj)
            db.commit()
            return True
        
        return False
    
    def archive_document(
        self,
        db: Session,
        document_id: int,
    ) -> Document:
        """Archive a document."""
        
        document = self.get_document(db, document_id)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        document.status = DocumentStatus.ARCHIVED
        document.is_active = False
        db.commit()
        db.refresh(document)
        
        return document
    
    def restore_document(
        self,
        db: Session,
        document_id: int,
    ) -> Document:
        """Restore archived document."""
        
        document = self.get_document(db, document_id)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        document.status = DocumentStatus.ACTIVE
        document.is_active = True
        db.commit()
        db.refresh(document)
        
        return document
    
    def delete_old_versions(
        self,
        db: Session,
        document_id: int,
        keep_count: int = 3,
    ) -> int:
        """Delete old versions, keeping only recent ones."""
        
        versions = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == document_id
        ).order_by(DocumentVersion.version_number.desc()).all()
        
        if len(versions) <= keep_count:
            return 0
        
        deleted_count = 0
        document = self.get_document(db, document_id)
        
        for version in versions[keep_count:]:
            # Delete file from storage
            self.storage.delete_file(version.file_path)
            
            # Delete record
            db.delete(version)
            deleted_count += 1
        
        db.commit()
        return deleted_count
    
    def search_documents(
        self,
        db: Session,
        query: str,
        entity_type: Optional[EntityType] = None,
    ) -> List[Document]:
        """Search documents by filename or tag."""
        
        base_query = db.query(Document).filter(Document.is_active == True)
        
        if entity_type:
            base_query = base_query.filter(Document.entity_type == entity_type)
        
        # Search by filename
        results = base_query.filter(
            Document.original_filename.ilike(f"%{query}%")
        ).all()
        
        # Search by tag
        tag_results = db.query(Document).join(DocumentTag).filter(
            and_(
                Document.is_active == True,
                DocumentTag.tag.ilike(f"%{query}%"),
            )
        ).distinct().all()
        
        # Combine results
        all_results = list(set(results + tag_results))
        
        return sorted(all_results, key=lambda d: d.updated_at, reverse=True)
    
    def update_expiry_statuses(self, db: Session) -> int:
        """Update status of expired documents. Returns count of updated documents."""
        
        expired_docs = self.get_expired_documents(db)
        
        for doc in expired_docs:
            doc.status = DocumentStatus.EXPIRED
        
        db.commit()
        
        return len(expired_docs)
