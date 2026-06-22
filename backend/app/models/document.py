"""Document and document version models for enterprise repository."""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Float,
    Boolean,
    Enum as SQLEnum,
    func,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from enum import Enum
from app.database import Base


class DocumentType(str, Enum):
    """Supported document types."""
    PAYSLIP = "payslip"
    BANK_STATEMENT = "bank_statement"
    VEHICLE_OR_CR = "vehicle_or_cr"  # Ownership/Registration & Certificate of Registration
    INSURANCE = "insurance"
    CONTRACT = "contract"
    ID_DOCUMENT = "id_document"
    PROOF_OF_ADDRESS = "proof_of_address"
    OTHER = "other"


class DocumentStatus(str, Enum):
    """Document lifecycle status."""
    ACTIVE = "active"
    EXPIRED = "expired"
    ARCHIVED = "archived"
    PENDING_SIGNATURE = "pending_signature"
    SIGNED = "signed"


class EntityType(str, Enum):
    """Entity types that can have documents."""
    LOAN = "loan"
    BORROWER = "borrower"
    VEHICLE = "vehicle"
    DRIVER = "driver"
    LEASOR = "leasor"
    LEASEE = "leasee"


class Document(Base):
    """Main document record with metadata."""
    
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    
    # Document classification
    entity_type = Column(SQLEnum(EntityType), nullable=False)  # What entity owns this document
    entity_id = Column(Integer, nullable=False)  # ID of that entity
    document_type = Column(SQLEnum(DocumentType), nullable=False)  # Type of document
    
    # File metadata
    original_filename = Column(String(255), nullable=False)
    current_version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=True)
    
    # Lifecycle
    expiry_date = Column(DateTime(timezone=True), nullable=True)  # When document expires
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.ACTIVE)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(255), nullable=True)  # User who uploaded
    
    # Relationships
    versions = relationship(
        "DocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="DocumentVersion.document_id"
    )
    tags = relationship(
        "DocumentTag",
        back_populates="document",
        cascade="all, delete-orphan"
    )
    signatures = relationship(
        "DocumentSignature",
        back_populates="document",
        cascade="all, delete-orphan"
    )
    
    # Indexes for fast queries
    __table_args__ = (
        Index("idx_document_entity", "entity_type", "entity_id"),
        Index("idx_document_type", "document_type"),
        Index("idx_document_status", "status"),
        Index("idx_document_expiry", "expiry_date"),
        UniqueConstraint("entity_type", "entity_id", "document_type", name="uq_entity_document_type"),
    )


class DocumentVersion(Base):
    """Version history for documents (immutable records)."""
    
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Version tracking
    version_number = Column(Integer, nullable=False)  # 1, 2, 3...
    
    # File information
    file_path = Column(String(500), nullable=False)  # Relative path: documents/{entity}/{id}/{type}/{version}/
    file_hash = Column(String(64), nullable=False)  # SHA256 hash for integrity verification
    file_size = Column(Float, nullable=False)  # Size in bytes
    mime_type = Column(String(100), nullable=True)
    
    # Upload metadata
    uploaded_by = Column(String(255), nullable=False)  # User who uploaded
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    upload_reason = Column(Text, nullable=True)  # Why new version (e.g., "Updated payslip for June")
    
    # Digital signature (if signed)
    is_signed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="versions", foreign_keys=[document_id])
    
    # Indexes
    __table_args__ = (
        Index("idx_version_document", "document_id", "version_number"),
        Index("idx_version_hash", "file_hash"),
    )


class DocumentTag(Base):
    """Tags for organizing and categorizing documents."""
    
    __tablename__ = "document_tags"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    tag = Column(String(100), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="tags", foreign_keys=[document_id])
    
    # Indexes
    __table_args__ = (
        Index("idx_tag_document", "document_id"),
        Index("idx_tag_name", "tag"),
    )


class DocumentSignature(Base):
    """Digital signature records for document authentication."""
    
    __tablename__ = "document_signatures"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=False)
    
    # Signature data
    signature_type = Column(String(50), nullable=False)  # "digital", "handwritten", "seal", etc.
    signature_data = Column(Text, nullable=False)  # Base64 encoded signature or hash
    signature_hash = Column(String(64), nullable=True)  # SHA256 of signature for verification
    
    # Who signed
    signed_by = Column(String(255), nullable=False)  # Username/email
    signed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Verification
    is_valid = Column(Boolean, default=True)
    invalidated_at = Column(DateTime(timezone=True), nullable=True)
    invalidation_reason = Column(String(500), nullable=True)
    
    # Metadata
    certificate_id = Column(String(500), nullable=True)  # For PKI signatures
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="signatures", foreign_keys=[document_id])
    
    # Indexes
    __table_args__ = (
        Index("idx_signature_document", "document_id"),
        Index("idx_signature_version", "version_id"),
        Index("idx_signature_validity", "is_valid", "signed_at"),
    )
