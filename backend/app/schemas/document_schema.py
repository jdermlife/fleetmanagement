"""Pydantic schemas for document management API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


# Enums
class DocumentTypeEnum(str, Enum):
    """Document type choices."""
    PAYSLIP = "payslip"
    BANK_STATEMENT = "bank_statement"
    VEHICLE_OR_CR = "vehicle_or_cr"
    INSURANCE = "insurance"
    CONTRACT = "contract"
    ID_DOCUMENT = "id_document"
    PROOF_OF_ADDRESS = "proof_of_address"
    OTHER = "other"


class DocumentStatusEnum(str, Enum):
    """Document status choices."""
    ACTIVE = "active"
    EXPIRED = "expired"
    ARCHIVED = "archived"
    PENDING_SIGNATURE = "pending_signature"
    SIGNED = "signed"


class EntityTypeEnum(str, Enum):
    """Entity type choices."""
    LOAN = "loan"
    BORROWER = "borrower"
    VEHICLE = "vehicle"
    DRIVER = "driver"
    LEASOR = "leasor"
    LEASEE = "leasee"


# Document Version Schemas
class DocumentVersionResponse(BaseModel):
    """Response for a single document version."""
    
    id: int
    version_number: int
    file_hash: str
    file_size: float
    mime_type: Optional[str]
    uploaded_by: str
    uploaded_at: datetime
    upload_reason: Optional[str]
    is_signed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Document Signature Schemas
class DocumentSignatureResponse(BaseModel):
    """Response for document signature."""
    
    id: int
    signature_type: str
    signed_by: str
    signed_at: datetime
    is_valid: bool
    invalidated_at: Optional[datetime]
    invalidation_reason: Optional[str]
    certificate_id: Optional[str]
    
    class Config:
        from_attributes = True


class DocumentSignRequest(BaseModel):
    """Request to digitally sign a document."""
    
    signature_type: str = Field(..., description="Type: digital, handwritten, seal, etc.")
    signature_data: str = Field(..., description="Base64 encoded signature")
    certificate_id: Optional[str] = Field(None, description="PKI certificate ID if applicable")


class DocumentSignResponse(BaseModel):
    """Response after signing document."""
    
    success: bool
    message: str
    signature_id: int
    signed_at: datetime


# Document Tag Schemas
class DocumentTagResponse(BaseModel):
    """Response for a document tag."""
    
    id: int
    tag: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Main Document Schemas
class DocumentUploadRequest(BaseModel):
    """Request to upload a new document."""
    
    entity_type: EntityTypeEnum
    entity_id: int
    document_type: DocumentTypeEnum
    expiry_date: Optional[datetime] = Field(None, description="When document expires")
    tags: Optional[List[str]] = Field(None, description="Tags for categorization")
    upload_reason: Optional[str] = Field(None, description="Why uploading this version")


class DocumentResponse(BaseModel):
    """Response for a document (current version only)."""
    
    id: int
    entity_type: EntityTypeEnum
    entity_id: int
    document_type: DocumentTypeEnum
    original_filename: str
    status: DocumentStatusEnum
    expiry_date: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    current_version: Optional[DocumentVersionResponse]
    tags: List[DocumentTagResponse]
    signatures: List[DocumentSignatureResponse]
    
    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Response for listing documents."""
    
    id: int
    entity_type: EntityTypeEnum
    entity_id: int
    document_type: DocumentTypeEnum
    original_filename: str
    status: DocumentStatusEnum
    expiry_date: Optional[datetime]
    is_active: bool
    version_count: int
    latest_upload_at: datetime
    is_expiring_soon: bool = Field(description="True if expires within 30 days")
    created_by: Optional[str]
    
    class Config:
        from_attributes = True


class DocumentHistoryResponse(BaseModel):
    """Response for document history/versions."""
    
    document_id: int
    total_versions: int
    versions: List[DocumentVersionResponse]
    
    class Config:
        from_attributes = True


class DocumentExpiryResponse(BaseModel):
    """Response for expiry status."""
    
    id: int
    document_type: DocumentTypeEnum
    original_filename: str
    expiry_date: datetime
    days_until_expiry: int
    is_expired: bool
    entity_type: EntityTypeEnum
    entity_id: int
    
    class Config:
        from_attributes = True


class DocumentSearchResponse(BaseModel):
    """Response for document search results."""
    
    id: int
    entity_type: EntityTypeEnum
    entity_id: int
    document_type: DocumentTypeEnum
    original_filename: str
    status: DocumentStatusEnum
    created_at: datetime
    match_reason: str = Field(description="Why this matched search (e.g., 'tag match', 'filename match')")
    
    class Config:
        from_attributes = True


class BulkDocumentExpiryResponse(BaseModel):
    """Response for bulk expiry check."""
    
    total_documents: int
    active_documents: int
    expired_documents: int
    expiring_within_30_days: int
    expiring_within_7_days: int
    documents: List[DocumentExpiryResponse]


class DocumentArchiveRequest(BaseModel):
    """Request to archive a document."""
    
    reason: str = Field(..., description="Reason for archiving")


class DocumentRestoreRequest(BaseModel):
    """Request to restore archived document."""
    
    reason: str = Field(..., description="Reason for restoring")
