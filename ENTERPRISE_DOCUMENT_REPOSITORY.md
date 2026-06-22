# Enterprise Document Repository - Complete Reference

**Status**: ✅ Production Ready  
**Date**: 2026-06-22  
**Feature**: Versioned document storage with expiry tracking and digital signatures

---

## Overview

The **Enterprise Document Repository** is a complete document management system integrated into the Fleet Management System. It handles:

- 📄 **Storage** of critical business documents (payslips, bank statements, vehicle registration, insurance, contracts, IDs)
- 📝 **Versioning** with complete history tracking
- ⏰ **Expiry Management** with automatic status updates
- ✍️ **Digital Signatures** for authenticity and compliance
- 🏷️ **Tagging** for easy organization and search
- 🔍 **Full-Text Search** across documents
- 📦 **Archive/Restore** functionality

---

## Database Architecture

### Three Core Tables

#### 1. `documents` — Main Document Records
```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  entity_type TEXT,              -- loan, borrower, vehicle, driver, etc.
  entity_id INTEGER,             -- ID of that entity
  document_type TEXT,            -- payslip, bank_statement, vehicle_or_cr, etc.
  original_filename VARCHAR(255),
  current_version_id INTEGER,
  expiry_date TIMESTAMPTZ,
  status TEXT,                   -- active, expired, archived, pending_signature, signed
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by VARCHAR(255)
);

CREATE INDEX idx_document_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_document_type ON documents(document_type);
CREATE INDEX idx_document_status ON documents(status);
CREATE INDEX idx_document_expiry ON documents(expiry_date);
```

**Key Fields**:
- `entity_type` — What entity owns this: loan, borrower, vehicle, driver, leasor, leasee
- `entity_id` — The ID of that entity
- `document_type` — Type of document: payslip, bank_statement, vehicle_or_cr, insurance, contract, id_document, proof_of_address, other
- `status` — Lifecycle: active, expired, archived, pending_signature, signed
- `current_version_id` — Points to latest version

#### 2. `document_versions` — Immutable Version History
```sql
CREATE TABLE document_versions (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  version_number INTEGER,        -- 1, 2, 3, ...
  file_path VARCHAR(500),        -- documents/entity/id/type/v1/filename.pdf
  file_hash VARCHAR(64),         -- SHA256 for integrity check
  file_size FLOAT,               -- Size in bytes
  mime_type VARCHAR(100),
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMPTZ,
  upload_reason TEXT,            -- Why this version (e.g., "Updated for June")
  is_signed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
);

CREATE INDEX idx_version_document ON document_versions(document_id, version_number);
CREATE INDEX idx_version_hash ON document_versions(file_hash);
```

**Key Fields**:
- `version_number` — Sequential version (immutable once created)
- `file_hash` — SHA256 for integrity verification
- `is_signed` — Whether version has digital signature
- `upload_reason` — Audit trail for why version created

#### 3. `document_tags` — Organization & Search
```sql
CREATE TABLE document_tags (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  tag VARCHAR(100),
  created_at TIMESTAMPTZ
);

CREATE INDEX idx_tag_document ON document_tags(document_id);
CREATE INDEX idx_tag_name ON document_tags(tag);
```

#### 4. `document_signatures` — Digital Authenticity
```sql
CREATE TABLE document_signatures (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  version_id INTEGER REFERENCES document_versions(id),
  signature_type VARCHAR(50),    -- digital, handwritten, seal, etc.
  signature_data TEXT,           -- Base64 encoded
  signature_hash VARCHAR(64),    -- SHA256 of signature
  signed_by VARCHAR(255),
  signed_at TIMESTAMPTZ,
  is_valid BOOLEAN DEFAULT TRUE,
  invalidated_at TIMESTAMPTZ,
  invalidation_reason VARCHAR(500),
  certificate_id VARCHAR(500),   -- For PKI signatures
  created_at TIMESTAMPTZ
);

CREATE INDEX idx_signature_document ON document_signatures(document_id);
CREATE INDEX idx_signature_version ON document_signatures(version_id);
CREATE INDEX idx_signature_validity ON document_signatures(is_valid, signed_at);
```

---

## Document Types Supported

| Type | Purpose | Example |
|------|---------|---------|
| `payslip` | Employee income proof | Monthly salary slip |
| `bank_statement` | Financial history | 3-month statements |
| `vehicle_or_cr` | Vehicle registration | OR/CR from transport authority |
| `insurance` | Policy documentation | Insurance policy/certificate |
| `contract` | Legal agreements | Lease contract, employment contract |
| `id_document` | Identity proof | Driver's license, national ID |
| `proof_of_address` | Address verification | Utility bill, rental agreement |
| `other` | Miscellaneous | Any other relevant document |

---

## API Endpoints

### 📤 Upload Document
```http
POST /documents/upload
```

**Query Parameters**:
```
entity_type: loan | borrower | vehicle | driver | leasor | leasee
entity_id: integer
document_type: payslip | bank_statement | vehicle_or_cr | insurance | contract | id_document | proof_of_address | other
expiry_date: ISO 8601 datetime (optional)
tags: comma-separated values (optional)
upload_reason: string (optional)
file: multipart file (required)
```

**Example Request**:
```bash
curl -X POST "http://localhost:5000/documents/upload?entity_type=borrower&entity_id=42&document_type=payslip&expiry_date=2027-06-22&tags=June,2026" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@payslip_june.pdf" \
  -F "upload_reason=Updated payslip for June"
```

**Response**:
```json
{
  "id": 123,
  "entity_type": "borrower",
  "entity_id": 42,
  "document_type": "payslip",
  "original_filename": "payslip_june.pdf",
  "status": "active",
  "expiry_date": "2027-06-22T00:00:00Z",
  "is_active": true,
  "current_version": {
    "id": 456,
    "version_number": 1,
    "file_hash": "abc123...",
    "file_size": 102400,
    "uploaded_by": "loan_officer_1",
    "uploaded_at": "2026-06-22T10:30:00Z",
    "is_signed": false
  },
  "tags": [
    { "id": 1, "tag": "June" },
    { "id": 2, "tag": "2026" }
  ],
  "signatures": []
}
```

---

### 📄 Get Document Details
```http
GET /documents/{document_id}
```

**Response**: Full document with current version, tags, signatures

---

### 💾 Download Document
```http
GET /documents/{document_id}/download?version_number=2
```

**Query Parameters**:
- `version_number` (optional) — Specific version to download; defaults to latest

**Response**: File download with original filename and MIME type

---

### 📜 Version History
```http
GET /documents/{document_id}/versions?limit=10
```

**Response**:
```json
{
  "document_id": 123,
  "total_versions": 3,
  "versions": [
    {
      "id": 456,
      "version_number": 3,
      "file_hash": "xyz789...",
      "file_size": 98765,
      "uploaded_by": "credit_analyst",
      "uploaded_at": "2026-06-22T15:45:00Z",
      "upload_reason": "Final updated version",
      "is_signed": true
    }
  ]
}
```

---

### ✍️ Sign Document
```http
POST /documents/{document_id}/sign?version_number=2
```

**Request Body**:
```json
{
  "signature_type": "digital",
  "signature_data": "base64-encoded-signature...",
  "certificate_id": "OU=Class 3, O=Signatory..."  // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Document signed successfully",
  "signature_id": 789,
  "signed_at": "2026-06-22T16:00:00Z"
}
```

**Signature Types**:
- `digital` — PKI/X.509 certificate-based
- `handwritten` — Scanned handwritten signature
- `seal` — Official seal or stamp
- `electronic` — Electronic signature

---

### 👁️ Get Signatures
```http
GET /documents/{document_id}/signatures
```

**Response**:
```json
[
  {
    "id": 789,
    "signature_type": "digital",
    "signed_by": "credit_manager_1",
    "signed_at": "2026-06-22T16:00:00Z",
    "is_valid": true,
    "certificate_id": "CN=Credit Manager"
  }
]
```

---

### 📚 Get Entity Documents
```http
GET /documents/entity/{entity_type}/{entity_id}?document_type=payslip
```

**Example**:
```bash
# Get all payslips for borrower 42
curl http://localhost:5000/documents/entity/borrower/42?document_type=payslip \
  -H "Authorization: Bearer $TOKEN"
```

**Response**: List of documents with version counts and expiry status

---

### ⏰ Expiring Documents
```http
GET /documents/expiry/upcoming?days_threshold=30
```

**Response**: Documents expiring within 30 days with days remaining

---

### 🔍 Bulk Expiry Check
```http
GET /documents/expiry/bulk-check
```

**Response**:
```json
{
  "total_documents": 250,
  "active_documents": 220,
  "expired_documents": 5,
  "expiring_within_30_days": 15,
  "expiring_within_7_days": 3,
  "documents": [
    {
      "id": 123,
      "document_type": "insurance",
      "expiry_date": "2026-06-25",
      "days_until_expiry": 3,
      "is_expired": false
    }
  ]
}
```

---

### 📦 Archive Document
```http
POST /documents/{document_id}/archive
```

**Request Body**:
```json
{
  "reason": "Loan closed"
}
```

---

### 🔄 Restore Document
```http
POST /documents/{document_id}/restore
```

**Request Body**:
```json
{
  "reason": "Loan reopened for review"
}
```

---

### 🧹 Cleanup Old Versions
```http
POST /documents/{document_id}/cleanup-versions?keep_count=3
```

**Effect**: Keeps latest 3 versions, deletes older ones from storage

---

### 🔎 Search Documents
```http
GET /documents/search/payslip?entity_type=borrower
```

**Query Parameters**:
- `query` — Search string (minimum 3 characters)
- `entity_type` — Optional entity filter

**Response**: List of matching documents with match reason

---

## Versioning Strategy

### How Versioning Works

1. **First Upload**: Creates document + first version (v1)
   ```
   POST /documents/upload (entity_type=borrower, entity_id=42, document_type=payslip)
   → Creates Document #123 with DocumentVersion #456 (v1)
   ```

2. **Subsequent Uploads**: Same document creates new version
   ```
   POST /documents/upload (same entity_type, entity_id, document_type)
   → Creates DocumentVersion #457 (v2)
   → Sets current_version_id to #457
   ```

3. **Version History**: All versions retained
   ```
   GET /documents/123/versions
   → Returns v1, v2, v3, ...
   ```

4. **Download Specific Version**:
   ```
   GET /documents/123/download?version_number=1
   → Returns v1 file
   ```

### Storage Path Structure
```
documents/
├── borrower/
│   ├── 42/
│   │   └── payslip/
│   │       ├── v1/
│   │       │   └── payslip_june_2026.pdf
│   │       ├── v2/
│   │       │   └── payslip_june_updated.pdf
│   │       └── v3/
│   │           └── payslip_final.pdf
│   └── 43/
│       └── bank_statement/
│           └── v1/
│               └── statement_june.pdf
├── vehicle/
│   └── 12/
│       └── vehicle_or_cr/
│           └── v1/
│               └── or_cr_2026.pdf
```

---

## Expiry Tracking

### Automatic Status Updates

**Workflow**:
1. Upload document with `expiry_date`
2. System marks as `status: active`
3. Bulk check endpoint updates statuses nightly (recommended cron job)
4. Expired documents marked as `status: expired`

**API Call**:
```bash
# Trigger status update
curl -X GET http://localhost:5000/documents/expiry/bulk-check \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Scheduled Update** (recommended):
```bash
# Add to crontab for nightly check
0 1 * * * curl -s "http://localhost:5000/documents/expiry/bulk-check" \
  -H "Authorization: Bearer $API_TOKEN" >> /var/log/document_expiry_check.log
```

---

## Digital Signatures

### Signature Types

1. **Digital (PKI)**
   - X.509 certificate-based
   - Provides non-repudiation
   - Certificate ID stored for verification
   
2. **Handwritten**
   - Scanned signature image
   - Base64 encoded
   
3. **Seal**
   - Official stamp or organizational seal
   - Tamper-evident
   
4. **Electronic**
   - Generic e-signature type
   - Platform-specific implementation

### Signature Workflow

```bash
# 1. Upload document
POST /documents/upload
→ Document status: active

# 2. Sign document
POST /documents/123/sign
{
  "signature_type": "digital",
  "signature_data": "MIICIjANBgkqhk...",
  "certificate_id": "CN=Finance Officer"
}
→ Document status: signed
→ Version marked as_signed: true

# 3. Get signatures
GET /documents/123/signatures
→ Returns all signatures with validity status

# 4. Invalidate signature (if needed)
POST /documents/123/signatures/789/invalidate
{
  "reason": "Document tampered"
}
→ Signature marked as_valid: false
```

### Signature Verification

```python
# Backend logic (internal)
def verify_signature(signature):
    # Check is_valid flag
    if not signature.is_valid:
        return False
    
    # Verify hash
    calculated_hash = sha256(signature.signature_data)
    if calculated_hash != signature.signature_hash:
        return False
    
    # Verify certificate (if PKI)
    if signature.certificate_id:
        verify_certificate(signature.certificate_id)
    
    return True
```

---

## Role-Based Access Control

### Upload & Download
- **Allowed Roles**: All authenticated users
- **Restriction**: Can only upload/download for own entity

### Expiry Tracking
- **Allowed Roles**: admin, credit_manager, operations, auditor
- **Restriction**: Cannot modify, only view

### Archive/Restore
- **Allowed Roles**: admin, credit_manager, operations
- **Restriction**: Must provide reason for audit trail

### Sign Document
- **Allowed Roles**: admin, credit_manager, approver, auditor (role-specific)
- **Restriction**: Cannot sign own documents (conflict of interest)

---

## File Storage

### Default Configuration
```
Base Path: ./documents
Structure: documents/{entity_type}/{entity_id}/{document_type}/v{version_number}/
```

### Cloud Storage (Optional)
For production, consider:
- **AWS S3**: `s3://bucket/documents/{entity}/{id}/{type}/v{version}/`
- **Google Cloud Storage**: `gs://bucket/...`
- **Azure Blob Storage**: `https://storage.azure.com/...`

**Configuration** (future enhancement):
```python
DOCUMENT_STORAGE_BACKEND = "s3"  # or "local", "gcs", "azure"
DOCUMENT_STORAGE_BUCKET = "fleet-documents"
DOCUMENT_MAX_SIZE = 50 * 1024 * 1024  # 50 MB
```

---

## Best Practices

### 1. **Naming Conventions**
```
# ✅ Good
payslip_june_2026.pdf
bank_statement_jan_mar_2026.pdf
vehicle_or_cr_2026.pdf

# ❌ Avoid
document.pdf
file1.pdf
updated_final_final.pdf
```

### 2. **Tagging**
```
# Use tags for organization
Tags: ["2026", "June", "official", "salary"]
Tags: ["Q2", "financial", "approved"]
```

### 3. **Version Comments**
```json
{
  "upload_reason": "Updated payslip with correction for overtime pay"
}
```

### 4. **Expiry Dates**
```
# Set appropriate expiry dates
Payslips: 12-24 months
Bank Statements: 12 months
Insurance: Policy expiry date
Vehicle OR/CR: Registration expiry date
ID: ID validity date
```

### 5. **Regular Cleanup**
```bash
# Monthly cleanup: keep only last 3 versions
POST /documents/{id}/cleanup-versions?keep_count=3
```

---

## Compliance & Audit Trail

### Audit Information Stored
- ✅ Who uploaded (username)
- ✅ When uploaded (timestamp)
- ✅ Why (upload_reason)
- ✅ File integrity (SHA256 hash)
- ✅ Who signed (signed_by)
- ✅ When signed (signed_at)
- ✅ Archive/restore reason

### Audit Query Example
```bash
# Get all document activity for borrower 42
GET /documents/entity/borrower/42
→ Returns all documents with:
  - created_by, created_at
  - All versions with uploader info
  - All signatures with signer info
```

---

## Error Scenarios

### ❌ File Not Found During Download
```
GET /documents/123/download
→ Status 404: "File not found in storage"
→ Action: Re-upload document
```

### ❌ Unauthorized to Sign
```
POST /documents/123/sign
→ Status 403: "Not authorized to sign documents"
→ Action: Verify role permissions
```

### ❌ Document Expired
```
GET /documents/123
→ Response: status = "expired"
→ Action: Renew or re-upload with new expiry date
```

### ❌ Invalid Signature
```
GET /documents/123/signatures
→ is_valid: false
→ Action: Review invalidation_reason, may need re-signing
```

---

## Performance Considerations

### Indexing Strategy
- `idx_document_entity` — Fast lookup by entity
- `idx_document_type` — Filter by document type
- `idx_document_status` — Track active vs expired
- `idx_document_expiry` — Quick expiry queries
- `idx_version_hash` — Deduplication/integrity checks
- `idx_signature_validity` — Audit trail queries

### Query Optimization
```python
# ✅ Good: Uses index on entity
docs = db.query(Document).filter(
    Document.entity_type == "borrower",
    Document.entity_id == 42
)

# ❌ Slow: Full table scan
docs = db.query(Document).filter(
    Document.original_filename.contains("payslip")
)
```

---

## Configuration

### Environment Variables
```bash
# Storage
DOCUMENT_STORAGE_PATH="./documents"
DOCUMENT_MAX_FILE_SIZE=52428800  # 50 MB
DOCUMENT_CLEANUP_THRESHOLD=30  # Keep 30 versions, delete older

# Expiry Tracking
DOCUMENT_EXPIRY_WARNING_DAYS=30
DOCUMENT_AUTO_EXPIRE_ENABLED=true

# Signatures
DOCUMENT_SIGNATURE_REQUIRED_FOR_APPROVAL=true
DOCUMENT_PKI_VERIFY_ENABLED=false  # Set true for production
```

---

## Summary

| Feature | Capability |
|---------|-----------|
| **Document Types** | 8 types supported |
| **Versioning** | Unlimited versions, keep any |
| **Storage** | Filesystem + cloud-ready |
| **Expiry Tracking** | Automatic status updates |
| **Digital Signatures** | Multiple signature types |
| **Search** | By filename, tags, entity |
| **Access Control** | Role-based + entity scoped |
| **Audit Trail** | Complete history logged |
| **Archive** | Soft delete with restore |
| **Performance** | Indexed queries |

---

**Ready to use!** Start uploading documents via the API.
