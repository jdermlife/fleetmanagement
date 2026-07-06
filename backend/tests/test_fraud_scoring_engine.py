from __future__ import annotations

import unittest
from types import SimpleNamespace

import tests._warning_filters  # noqa: F401

from app.services.fraud_scoring_engine import compute_fraud_score


class FraudScoringEngineTests(unittest.TestCase):
    def test_fraud_engine_scores_verified_profile_as_low_risk(self) -> None:
        payload = SimpleNamespace(
            gov_id="NATIONAL-ID-1",
            email="verified@company.com",
            phone="09171234567",
            monthly_income=100000.0,
            other_income=10000.0,
            requirements={
                "governmentIds": {
                    "idNumber": "NATIONAL-ID-1",
                },
                "contactInformation": {
                    "mobileNumber": "09171234567",
                    "mobileYearsUsed": "6 years",
                    "emailAddress": "verified@company.com",
                    "emailYearsUsed": "6 years",
                },
                "otherInformation": {
                    "recentPhotoUploaded": True,
                    "deviceVerified": True,
                },
                "supportingDocuments": {
                    "philSysId": True,
                    "passportIfApplicable": True,
                    "proofOfIncome": True,
                    "certificateOfEmployment": True,
                    "latestPayslips": True,
                    "bankStatements": True,
                },
                "employmentInformation": {
                    "grossMonthlyIncome": 100000.0,
                    "employerBusinessName": "Acme Corp",
                },
                "bankingRelationships": {
                    "accountNumber": "001",
                    "accountType": "Savings",
                    "memberSince": "2018-01-01",
                },
                "addressInformation": {
                    "presentAddress": "123 Main Street",
                    "permanentAddress": "123 Main Street",
                    "mailingAddress": "123 Main Street",
                },
                "enhancedDueDiligence": {
                    "employmentReferencePerson": "HR Manager",
                    "hrContactInformation": "Acme HR",
                    "supervisorInformation": "Supervisor",
                    "consentIdentityVerification": True,
                },
                "fraudVerification": {
                    "faceMatchScore": 99.5,
                    "livenessDetection": "Passed",
                    "payrollVerificationStatus": "Verified",
                    "bankAccountOwnershipStatus": "Verified",
                    "deviceReputation": "Trusted",
                    "ipAddressRisk": "Normal",
                    "deviceConsistency": "Same device",
                },
                "documentAnalysis": {
                    "incomeDocumentsStatus": "Verified",
                    "employmentVerificationStatus": "Verified",
                    "bankStatementVerificationStatus": "Matches application",
                    "ocrAnalysisStatus": "No signs of tampering",
                },
                "fraudIntelligence": {
                    "watchlistStatus": "Clear",
                    "previousFraudRecords": "None",
                    "applicationVelocity": "Normal",
                },
            },
        )

        result = compute_fraud_score(payload)

        self.assertEqual(result["identity_score"], 20.0)
        self.assertEqual(result["document_score"], 20.0)
        self.assertEqual(result["geo_location_score"], 20.0)
        self.assertEqual(result["device_score"], 10.0)
        self.assertEqual(result["duplicate_application_score"], 15.0)
        self.assertEqual(result["overall_fraud_score"], 100.0)
        self.assertIn("Extremely Low Fraud Risk", str(result["fraud_risk_level"]))
        self.assertEqual(result["fraud_flags"]["fraud_grade"], "Platinum")

    def test_fraud_engine_applies_hard_stop_for_failed_face_match(self) -> None:
        payload = SimpleNamespace(
            gov_id="ID-1",
            email="borrower@example.com",
            phone="09170000000",
            requirements={
                "supportingDocuments": {
                    "validGovernmentId": True,
                },
                "fraudVerification": {
                    "faceMatchScore": 89.0,
                    "livenessDetection": "Passed",
                },
                "fraudIntelligence": {
                    "watchlistStatus": "Clear",
                    "previousFraudRecords": "None",
                    "applicationVelocity": "Normal",
                },
            },
        )

        result = compute_fraud_score(payload)

        self.assertEqual(result["overall_fraud_score"], 0.0)
        self.assertEqual(result["fraud_flags"]["override_action"], "Automatic Decline")
        self.assertIn("Automatic Decline", str(result["fraud_risk_level"]))
