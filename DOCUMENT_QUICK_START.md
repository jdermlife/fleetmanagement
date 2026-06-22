# Enterprise Document Repository - Quick Start

**Version**: 1.0  
**Status**: ✅ Ready to Use

---

## 🎯 30-Second Overview

You can now upload, version, sign, and track documents with a single API:

```bash
# Upload payslip for borrower #42
curl -X POST "http://localhost:5000/documents/upload?entity_type=borrower&entity_id=42&document_type=payslip&expiry_date=2027-06-22" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@payslip.pdf"

# Get all documents for borrower
curl "http://localhost:5000/documents/entity/borrower/42" \
  -H "Authorization: Bearer $TOKEN"

# Sign document
curl -X POST "http://localhost:5000/documents/123/sign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_type": "digital",
    "signature_data": "base64-encoded-sig"
  }'

# Check expiring documents
curl "http://localhost:5000/documents/expiry/upcoming?days_threshold=30" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 📊 Supported Documents

| Type | Use Case | Example |
|------|----------|---------|
| **payslip** | Income proof | Monthly salary slip |
| **bank_statement** | Financial history | 3-month statements |
| **vehicle_or_cr** | Vehicle registration | OR/CR from authority |
| **insurance** | Policy documentation | Insurance certificate |
| **contract** | Legal agreements | Lease/employment contract |
| **id_document** | Identity proof | Driver's license |
| **proof_of_address** | Address verification | Utility bill |
| **other** | Miscellaneous | Any other document |

---

## 🚀 Common Tasks

### 1️⃣ Upload Borrower's Payslip
```bash
curl -X POST "http://localhost:5000/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/payslip.pdf" \
  -F "entity_type=borrower" \
  -F "entity_id=42" \
  -F "document_type=payslip" \
  -F "expiry_date=2027-12-31" \
  -F "tags=June,2026,official" \
  -F "upload_reason=Monthly salary slip for June 2026"
```

**Response**:
```json
{
  "id": 123,
  "status": "active",
  "current_version": {
    "version_number": 1,
    "file_hash": "abc123...",
    "uploaded_at": "2026-06-22T10:30:00Z"
  }
}
```

---

### 2️⃣ Get All Documents for Borrower
```bash
curl "http://localhost:5000/documents/entity/borrower/42" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
[
  {
    "id": 123,
    "document_type": "payslip",
    "original_filename": "payslip.pdf",
    "status": "active",
    "expiry_date": "2027-12-31",
    "version_count": 1,
    "latest_upload_at": "2026-06-22T10:30:00Z",
    "is_expiring_soon": false
  },
  {
    "id": 124,
    "document_type": "bank_statement",
    "original_filename": "statement.pdf",
    "status": "active",
    "expiry_date": "2027-06-22",
    "version_count": 2,
    "latest_upload_at": "2026-06-22T14:15:00Z",
    "is_expiring_soon": true
  }
]
```

---

### 3️⃣ Download Latest Version
```bash
curl "http://localhost:5000/documents/123/download" \
  -H "Authorization: Bearer $TOKEN" \
  --output payslip_latest.pdf
```

---

### 4️⃣ Download Specific Version
```bash
# Download version 1 (original upload)
curl "http://localhost:5000/documents/123/download?version_number=1" \
  -H "Authorization: Bearer $TOKEN" \
  --output payslip_v1.pdf
```

---

### 5️⃣ View Version History
```bash
curl "http://localhost:5000/documents/123/versions?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "document_id": 123,
  "total_versions": 3,
  "versions": [
    {
      "version_number": 3,
      "file_hash": "xyz789...",
      "uploaded_by": "credit_analyst",
      "uploaded_at": "2026-06-22T16:45:00Z",
      "upload_reason": "Corrected amount",
      "is_signed": true
    },
    {
      "version_number": 2,
      "file_hash": "def456...",
      "uploaded_by": "loan_officer",
      "uploaded_at": "2026-06-22T14:30:00Z",
      "upload_reason": "Updated payslip",
      "is_signed": false
    },
    {
      "version_number": 1,
      "file_hash": "abc123...",
      "uploaded_by": "loan_officer",
      "uploaded_at": "2026-06-22T10:30:00Z",
      "upload_reason": null,
      "is_signed": false
    }
  ]
}
```

---

### 6️⃣ Upload New Version of Document
```bash
# Same entity_type, entity_id, document_type = new version
curl -X POST "http://localhost:5000/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/payslip_updated.pdf" \
  -F "entity_type=borrower" \
  -F "entity_id=42" \
  -F "document_type=payslip" \
  -F "upload_reason=Corrected amount for overtime pay"
```

**Effect**:
- Creates DocumentVersion #2 (v2)
- Sets current_version_id to this new version
- All versions kept in history
- Original v1 still downloadable

---

### 7️⃣ Sign Document (Digital)
```bash
curl -X POST "http://localhost:5000/documents/123/sign" \
  -H "Authorization: Bearer $CREDIT_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_type": "digital",
    "signature_data": "MIICIjANBgkqhk...",
    "certificate_id": "CN=Credit Manager"
  }'
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

---

### 8️⃣ Get Signatures
```bash
curl "http://localhost:5000/documents/123/signatures" \
  -H "Authorization: Bearer $TOKEN"
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

### 9️⃣ Check Expiring Documents (30 Days)
```bash
curl "http://localhost:5000/documents/expiry/upcoming?days_threshold=30" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response**:
```json
[
  {
    "id": 124,
    "document_type": "bank_statement",
    "original_filename": "statement.pdf",
    "expiry_date": "2026-07-15",
    "days_until_expiry": 23,
    "is_expired": false,
    "entity_type": "borrower",
    "entity_id": 42
  }
]
```

---

### 🔟 Bulk Expiry Status
```bash
curl "http://localhost:5000/documents/expiry/bulk-check" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response**:
```json
{
  "total_documents": 1000,
  "active_documents": 950,
  "expired_documents": 10,
  "expiring_within_30_days": 25,
  "expiring_within_7_days": 3,
  "documents": [
    {
      "id": 124,
      "document_type": "insurance",
      "expiry_date": "2026-06-28",
      "days_until_expiry": 6
    }
  ]
}
```

---

## 🔍 Search & Filter

### Search by Filename or Tag
```bash
curl "http://localhost:5000/documents/search/payslip?entity_type=borrower" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
[
  {
    "id": 123,
    "document_type": "payslip",
    "original_filename": "payslip_june.pdf",
    "status": "active",
    "match_reason": "filename match"
  }
]
```

---

## 📦 Archive & Restore

### Archive Document
```bash
curl -X POST "http://localhost:5000/documents/123/archive" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Loan closed"
  }'
```

---

### Restore Document
```bash
curl -X POST "http://localhost:5000/documents/123/restore" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Loan reopened"
  }'
```

---

## 🧹 Cleanup Old Versions

Keep only last 3 versions, delete older ones:

```bash
curl -X POST "http://localhost:5000/documents/123/cleanup-versions?keep_count=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "Deleted 2 old versions",
  "deleted_count": 2
}
```

---

## 🏢 Entity Types

Documents can be attached to:

| Entity | Use Case | Example ID |
|--------|----------|-----------|
| **loan** | Loan application documents | Loan #42 |
| **borrower** | Individual borrower docs | Borrower #10 |
| **vehicle** | Vehicle documentation | Vehicle #5 |
| **driver** | Driver credentials | Driver #3 |
| **leasor** | Lessor documents | Leasor #8 |
| **leasee** | Lessee documents | Leasee #12 |

---

## 📋 Complete Workflow Example

**Scenario**: Loan officer submits borrower's documents for credit review

```bash
# Step 1: Upload payslip
curl -X POST "http://localhost:5000/documents/upload?entity_type=borrower&entity_id=42&document_type=payslip&expiry_date=2027-12-31" \
  -H "Authorization: Bearer $LOAN_OFFICER_TOKEN" \
  -F "file=@payslip.pdf" \
  -F "tags=official,June2026"

# Response: { "id": 123, "status": "active" }

# Step 2: Upload bank statement
curl -X POST "http://localhost:5000/documents/upload?entity_type=borrower&entity_id=42&document_type=bank_statement&expiry_date=2027-06-22" \
  -H "Authorization: Bearer $LOAN_OFFICER_TOKEN" \
  -F "file=@statement.pdf" \
  -F "tags=3months"

# Response: { "id": 124, "status": "active" }

# Step 3: Credit analyst verifies documents
curl "http://localhost:5000/documents/entity/borrower/42" \
  -H "Authorization: Bearer $CREDIT_ANALYST_TOKEN"

# Response: [{ "id": 123, ... }, { "id": 124, ... }]

# Step 4: Credit manager signs off
curl -X POST "http://localhost:5000/documents/123/sign" \
  -H "Authorization: Bearer $CREDIT_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_type": "digital",
    "signature_data": "..."
  }'

# Response: { "success": true, "signature_id": 789 }

# Step 5: View complete audit trail
curl "http://localhost:5000/documents/123" \
  -H "Authorization: Bearer $TOKEN"

# Response: Full document with all versions and signatures
```

---

## 🔐 Role-Based Access

| Action | Allowed Roles |
|--------|---------------|
| Upload | Any authenticated user |
| Download | Document owner + admin |
| View versions | Document owner + admin |
| Sign | credit_manager, approver, admin |
| Archive | credit_manager, operations, admin |
| Expiry check | admin, credit_manager, operations, auditor |
| Search | Any authenticated user |

---

## ⚡ Tips & Tricks

### Auto-Expire Documents
```bash
# Run daily to update expired statuses
curl "http://localhost:5000/documents/expiry/bulk-check" \
  -H "Authorization: Bearer $API_TOKEN"

# Add to crontab
0 1 * * * curl -s "http://localhost:5000/documents/expiry/bulk-check" \
  -H "Authorization: Bearer $API_TOKEN"
```

### Organize with Tags
```
# Good tag structure
Tags: ["2026", "June", "salary", "official"]
Tags: ["Q2", "financial", "approved"]
Tags: ["vehicle", "registration", "renewed"]
```

### Document Naming
```
# Use descriptive filenames
✅ payslip_june_2026.pdf
✅ bank_statement_jan_mar_2026.pdf
✅ vehicle_or_cr_2026.pdf

❌ document.pdf
❌ file1.pdf
```

### Monitor Expiry
```bash
# Weekly expiry check
curl "http://localhost:5000/documents/expiry/upcoming?days_threshold=7" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🆘 Troubleshooting

### Upload Fails
```bash
# Check file exists
ls -lh /path/to/file.pdf

# Check file size (50MB max)
du -h /path/to/file.pdf

# Check authorization
# Ensure TOKEN is valid and has permission
```

### Document Not Found
```bash
# Verify document ID
curl "http://localhost:5000/documents/123" \
  -H "Authorization: Bearer $TOKEN"

# Check status 404 = document doesn't exist
```

### Expiry Date Not Set
```bash
# Re-upload with expiry_date parameter
curl -X POST "http://localhost:5000/documents/upload?expiry_date=2027-12-31" \
  -F "file=@document.pdf"
```

---

## 📚 Full Documentation

For complete API reference, database schema, and configuration:
→ See [ENTERPRISE_DOCUMENT_REPOSITORY.md](ENTERPRISE_DOCUMENT_REPOSITORY.md)

---

**Start using now!** All endpoints are live and ready for production.
