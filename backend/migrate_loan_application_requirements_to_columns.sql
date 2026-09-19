-- Normalize loan_applications.requirements into queryable columns.
-- Safe to run repeatedly. Existing non-null column values are preserved.
-- The requirements column remains the lossless source for backward compatibility.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.jsonb_first_text(document JSONB, paths TEXT[])
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT NULLIF(BTRIM(document #>> STRING_TO_ARRAY(path, '.')), '')
    FROM UNNEST(paths) AS candidate(path)
    WHERE NULLIF(BTRIM(document #>> STRING_TO_ARRAY(path, '.')), '') IS NOT NULL
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION pg_temp.try_numeric(value TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN REPLACE(value, ',', '')::NUMERIC;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.try_integer(value TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN TRUNC(REPLACE(value, ',', '')::NUMERIC)::INTEGER;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.try_date(value TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN LEFT(value, 10)::DATE;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.try_boolean(value TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE LOWER(BTRIM(value))
        WHEN 'true' THEN TRUE WHEN '1' THEN TRUE WHEN 'yes' THEN TRUE WHEN 'y' THEN TRUE
        WHEN 'false' THEN FALSE WHEN '0' THEN FALSE WHEN 'no' THEN FALSE WHEN 'n' THEN FALSE
        ELSE NULL
    END
$$;

DO $$
DECLARE
    mapping RECORD;
    source_expression TEXT;
    value_expression TEXT;
BEGIN
    FOR mapping IN
        SELECT *
        FROM (VALUES
            ('last_name', 'TEXT', 'text', ARRAY['applicantPersonal.lastName', 'buildProfile.values.lastName']),
            ('first_name', 'TEXT', 'text', ARRAY['applicantPersonal.firstName', 'buildProfile.values.firstName']),
            ('middle_name', 'TEXT', 'text', ARRAY['applicantPersonal.middleName', 'buildProfile.values.middleName']),
            ('date_of_birth', 'DATE', 'date', ARRAY['applicantPersonal.dateOfBirth', 'buildProfile.values.dateOfBirth']),
            ('place_of_birth', 'TEXT', 'text', ARRAY['applicantPersonal.placeOfBirth', 'buildProfile.values.placeOfBirth']),
            ('age', 'INTEGER', 'integer', ARRAY['applicantPersonal.age', 'buildProfile.values.age']),
            ('gender', 'TEXT', 'text', ARRAY['applicantPersonal.gender', 'buildProfile.values.gender']),
            ('citizenship', 'TEXT', 'text', ARRAY['applicantPersonal.citizenship', 'buildProfile.values.citizenship']),
            ('number_of_dependents', 'INTEGER', 'integer', ARRAY['applicantPersonal.numberOfDependents', 'buildProfile.values.dependents']),
            ('marital_status', 'TEXT', 'text', ARRAY['applicantPersonal.maritalStatus', 'buildProfile.values.civilStatus']),
            ('mothers_maiden_name', 'TEXT', 'text', ARRAY['applicantPersonal.mothersMaidenName', 'buildProfile.values.mothersMaidenName']),
            ('mobile_number', 'TEXT', 'text', ARRAY['contactInformation.mobileNumber', 'buildProfile.values.mobileNumber']),
            ('home_phone_number', 'TEXT', 'text', ARRAY['contactInformation.homePhoneNumber', 'buildProfile.values.homePhoneNumber']),
            ('tin', 'TEXT', 'text', ARRAY['governmentIds.tin', 'buildProfile.values.tin']),
            ('sss_gsis_number', 'TEXT', 'text', ARRAY['governmentIds.sssGsisNumber', 'buildProfile.values.sssGsis']),
            ('other_government_id', 'TEXT', 'text', ARRAY['governmentIds.otherGovernmentId', 'buildProfile.values.otherGovernmentId']),
            ('id_number', 'TEXT', 'text', ARRAY['governmentIds.idNumber', 'buildProfile.values.otherGovernmentIdNumber']),
            ('issue_date', 'DATE', 'date', ARRAY['governmentIds.issueDate', 'buildProfile.values.idIssueDate']),
            ('expiry_date', 'DATE', 'date', ARRAY['governmentIds.expiryDate', 'buildProfile.values.idExpiryDate']),
            ('present_address', 'TEXT', 'text', ARRAY['addressInformation.presentAddress', 'buildProfile.values.address']),
            ('permanent_address', 'TEXT', 'text', ARRAY['addressInformation.permanentAddress', 'buildProfile.values.permanentAddress']),
            ('mailing_address', 'TEXT', 'text', ARRAY['addressInformation.mailingAddress', 'buildProfile.values.mailingAddress']),
            ('length_of_stay', 'TEXT', 'text', ARRAY['addressInformation.lengthOfStay', 'buildProfile.values.lengthOfStay']),
            ('home_ownership', 'TEXT', 'text', ARRAY['otherInformation.homeOwnership', 'buildProfile.values.homeOwnership']),
            ('educational_attainment', 'TEXT', 'text', ARRAY['otherInformation.educationalAttainment', 'buildProfile.values.education']),
            ('number_of_vehicles_owned', 'INTEGER', 'integer', ARRAY['otherInformation.numberOfVehiclesOwned', 'buildProfile.values.numberOfVehiclesOwned']),
            ('recent_photo_uploaded', 'BOOLEAN', 'boolean', ARRAY['otherInformation.recentPhotoUploaded', 'buildProfile.values.recentPhotoUploaded']),
            ('employment_status', 'TEXT', 'text', ARRAY['employmentInformation.employmentStatus', 'buildProfile.values.employmentStatus']),
            ('employer_business_name', 'TEXT', 'text', ARRAY['employmentInformation.employerBusinessName', 'buildProfile.values.employerName', 'buildProfile.values.employmentHistory']),
            ('office_address', 'TEXT', 'text', ARRAY['employmentInformation.officeAddress', 'buildProfile.values.officeAddress']),
            ('occupation', 'TEXT', 'text', ARRAY['employmentInformation.occupation', 'buildProfile.values.occupation']),
            ('position', 'TEXT', 'text', ARRAY['employmentInformation.position', 'buildProfile.values.position']),
            ('nature_of_work_business', 'TEXT', 'text', ARRAY['employmentInformation.natureOfWorkBusiness', 'buildProfile.values.natureOfWorkBusiness']),
            ('date_hired', 'DATE', 'date', ARRAY['employmentInformation.dateHired', 'buildProfile.values.dateHired']),
            ('office_phone_number', 'TEXT', 'text', ARRAY['employmentInformation.officePhoneNumber', 'buildProfile.values.officePhoneNumber']),
            ('previous_employer', 'TEXT', 'text', ARRAY['employmentInformation.previousEmployer', 'buildProfile.values.previousEmployer']),
            ('total_years_working', 'TEXT', 'text', ARRAY['employmentInformation.totalYearsWorking', 'buildProfile.values.totalYearsWorking']),
            ('gross_monthly_income', 'NUMERIC', 'numeric', ARRAY['employmentInformation.grossMonthlyIncome', 'buildProfile.values.monthlyIncome']),
            ('monthly_living_expenses', 'NUMERIC', 'numeric', ARRAY['employmentInformation.monthlyLivingExpenses', 'buildProfile.values.monthlyExpenses']),
            ('other_sources_of_income', 'TEXT', 'text', ARRAY['employmentInformation.otherSourcesOfIncome', 'buildProfile.values.otherIncome']),
            ('investment_income', 'NUMERIC', 'numeric', ARRAY['employmentInformation.investmentIncome', 'buildProfile.values.investmentIncome']),
            ('business_income', 'NUMERIC', 'numeric', ARRAY['employmentInformation.businessIncome', 'buildProfile.values.businessIncome']),
            ('pension_income', 'NUMERIC', 'numeric', ARRAY['employmentInformation.pensionIncome', 'buildProfile.values.pensionIncome']),
            ('insurance', 'TEXT', 'text', ARRAY['collateralAssetDetails.insuranceProviderCompany', 'buildProfile.values.insurance', 'buildProfile.values.insuranceProviderCompany']),
            ('registration', 'TEXT', 'text', ARRAY['buildProfile.values.registration', 'collateralAssetDetails.orNumber']),
            ('property_address', 'TEXT', 'text', ARRAY['collateralInformation.propertyAddress', 'buildProfile.values.propertyAddress']),
            ('registered_owner', 'TEXT', 'text', ARRAY['collateralInformation.registeredOwner', 'buildProfile.values.registeredOwner']),
            ('lot_number', 'TEXT', 'text', ARRAY['collateralInformation.lotNumber', 'buildProfile.values.lotNumber']),
            ('block_number', 'TEXT', 'text', ARRAY['collateralInformation.blockNumber', 'buildProfile.values.blockNumber']),
            ('tct_cct_number', 'TEXT', 'text', ARRAY['collateralInformation.tctCctNumber', 'buildProfile.values.tctCctNumber']),
            ('spouse_name', 'TEXT', 'text', ARRAY['spouseInformation.fullName', 'buildProfile.values.spouseFullName']),
            ('spouse_date_of_birth', 'DATE', 'date', ARRAY['spouseInformation.dateOfBirth', 'buildProfile.values.spouseDateOfBirth']),
            ('spouse_place_of_birth', 'TEXT', 'text', ARRAY['spouseInformation.placeOfBirth', 'buildProfile.values.spousePlaceOfBirth']),
            ('spouse_citizenship', 'TEXT', 'text', ARRAY['spouseInformation.citizenship', 'buildProfile.values.spouseCitizenship']),
            ('spouse_mobile_number', 'TEXT', 'text', ARRAY['spouseInformation.mobileNumber', 'buildProfile.values.spouseMobileNumber']),
            ('spouse_present_address', 'TEXT', 'text', ARRAY['spouseInformation.presentAddress', 'buildProfile.values.spousePresentAddress']),
            ('spouse_employer_business_name', 'TEXT', 'text', ARRAY['spouseInformation.employerBusinessName', 'buildProfile.values.spouseEmployerBusinessName']),
            ('spouse_office_address', 'TEXT', 'text', ARRAY['spouseInformation.officeAddress', 'buildProfile.values.spouseOfficeAddress']),
            ('spouse_occupation', 'TEXT', 'text', ARRAY['spouseInformation.occupation', 'buildProfile.values.spouseOccupation']),
            ('spouse_position', 'TEXT', 'text', ARRAY['spouseInformation.position', 'buildProfile.values.spousePosition']),
            ('spouse_nature_of_work', 'TEXT', 'text', ARRAY['spouseInformation.natureOfWork', 'buildProfile.values.spouseNatureOfWork']),
            ('spouse_years_with_employer', 'TEXT', 'text', ARRAY['spouseInformation.yearsWithEmployer', 'buildProfile.values.spouseYearsWithEmployer']),
            ('spouse_previous_employer', 'TEXT', 'text', ARRAY['spouseInformation.previousEmployer', 'buildProfile.values.spousePreviousEmployer']),
            ('spouse_total_years_working', 'TEXT', 'text', ARRAY['spouseInformation.totalYearsWorking', 'buildProfile.values.spouseTotalYearsWorking']),
            ('spouse_gross_monthly_income', 'NUMERIC', 'numeric', ARRAY['spouseInformation.grossMonthlyIncome', 'buildProfile.values.spouseGrossMonthlyIncome']),
            ('spouse_monthly_expenses', 'NUMERIC', 'numeric', ARRAY['spouseInformation.monthlyExpenses', 'buildProfile.values.spouseMonthlyExpenses']),
            ('spouse_other_income_sources', 'TEXT', 'text', ARRAY['spouseInformation.otherIncomeSources', 'buildProfile.values.spouseOtherIncomeSources']),
            ('credit_card_issuer', 'TEXT', 'text', ARRAY['bankingRelationships.creditCardIssuer', 'buildProfile.values.creditCardIssuer']),
            ('credit_card_number', 'TEXT', 'text', ARRAY['bankingRelationships.creditCardNumber', 'buildProfile.values.creditCardNumber']),
            ('credit_limit', 'NUMERIC', 'numeric', ARRAY['bankingRelationships.creditLimit', 'buildProfile.values.creditLimit']),
            ('outstanding_balance', 'NUMERIC', 'numeric', ARRAY['bankingRelationships.outstandingBalance', 'buildProfile.values.outstandingBalance']),
            ('member_since', 'DATE', 'date', ARRAY['bankingRelationships.memberSince', 'buildProfile.values.memberSince']),
            ('bank_branch', 'TEXT', 'text', ARRAY['bankingRelationships.bankBranch', 'buildProfile.values.bankBranch']),
            ('account_type', 'TEXT', 'text', ARRAY['bankingRelationships.accountType', 'buildProfile.values.accountType']),
            ('account_number', 'TEXT', 'text', ARRAY['bankingRelationships.accountNumber', 'buildProfile.values.accountNumber']),
            ('current_balance', 'NUMERIC', 'numeric', ARRAY['bankingRelationships.currentBalance', 'buildProfile.values.currentBalance']),
            ('loan_lender', 'TEXT', 'text', ARRAY['bankingRelationships.loanLender', 'buildProfile.values.loanLender']),
            ('loan_type', 'TEXT', 'text', ARRAY['bankingRelationships.loanType', 'buildProfile.values.loanType']),
            ('loan_current_balance', 'NUMERIC', 'numeric', ARRAY['bankingRelationships.loanCurrentBalance', 'buildProfile.values.loanCurrentBalance']),
            ('loan_monthly_amortization', 'NUMERIC', 'numeric', ARRAY['bankingRelationships.loanMonthlyAmortization', 'buildProfile.values.loanMonthlyAmortization']),
            ('credit_officer', 'TEXT', 'text', ARRAY['editorState.routing.creditOfficer']),
            ('branch_manager', 'TEXT', 'text', ARRAY['editorState.routing.branchManager']),
            ('credit_committee', 'TEXT', 'text', ARRAY['editorState.routing.creditCommittee']),
            ('bank_account', 'TEXT', 'text', ARRAY['editorState.disbursement.bankAccount']),
            ('disbursement_account_number', 'TEXT', 'text', ARRAY['editorState.disbursement.accountNumber']),
            ('disbursement_date', 'DATE', 'date', ARRAY['editorState.disbursement.disbursementDate']),
            ('booking_date', 'DATE', 'date', ARRAY['editorState.disbursement.bookingDate']),
            ('start_repayment_date', 'DATE', 'date', ARRAY['editorState.disbursement.startRepaymentDate']),
            ('first_payment_date', 'DATE', 'date', ARRAY['editorState.disbursement.firstPaymentDate']),
            ('all_required_documents_provided', 'BOOLEAN', 'boolean', ARRAY['releaseReadiness.finalChecklist.allRequiredDocumentsProvided']),
            ('all_signatures_collected', 'BOOLEAN', 'boolean', ARRAY['releaseReadiness.finalChecklist.allSignaturesCollected']),
            ('credit_committee_approved', 'BOOLEAN', 'boolean', ARRAY['releaseReadiness.finalChecklist.creditCommitteeApproved']),
            ('executive_approval_obtained', 'BOOLEAN', 'boolean', ARRAY['releaseReadiness.finalChecklist.executiveApprovalObtained']),
            ('collateral_documentation_ready', 'BOOLEAN', 'boolean', ARRAY['releaseReadiness.finalChecklist.collateralDocumentationReady']),
            ('co_borrower_name', 'TEXT', 'text', ARRAY['coBorrowers.0.name', 'buildProfile.coBorrowers.0.name']),
            ('co_borrower_relationship', 'TEXT', 'text', ARRAY['coBorrowers.0.relationship', 'buildProfile.coBorrowers.0.relationship']),
            ('co_borrower_monthly_income', 'NUMERIC', 'numeric', ARRAY['coBorrowers.0.monthlyIncome', 'buildProfile.coBorrowers.0.monthlyIncome']),
            ('guarantor_name', 'TEXT', 'text', ARRAY['buildProfile.guarantors.0.name']),
            ('guarantor_mobile', 'TEXT', 'text', ARRAY['buildProfile.guarantors.0.mobileNumber']),
            ('guarantor_address', 'TEXT', 'text', ARRAY['buildProfile.guarantors.0.presentAddress']),
            ('guarantor_relationship', 'TEXT', 'text', ARRAY['buildProfile.guarantors.0.relationship']),
            ('guarantor_monthly_income', 'NUMERIC', 'numeric', ARRAY['buildProfile.guarantors.0.monthlyIncome']),
            ('identity_verification_status', 'TEXT', 'text', ARRAY['fraudVerification.livenessDetection']),
            ('document_verification_status', 'TEXT', 'text', ARRAY['fraudVerification.incomeDocumentsStatus']),
            ('banking_verification_status', 'TEXT', 'text', ARRAY['fraudVerification.bankStatementVerificationStatus']),
            ('device_verification_status', 'TEXT', 'text', ARRAY['deviceRisk.deviceReputation']),
            ('financial_goal_target_amount', 'NUMERIC', 'numeric', ARRAY['buildProfile.values.targetAmount']),
            ('financial_goal_target_period', 'INTEGER', 'integer', ARRAY['buildProfile.values.targetMonths']),
            ('financial_goal_target_period_unit', 'TEXT', 'text', ARRAY['buildProfile.values.targetPeriodUnit']),
            ('collateral_asset_type', 'TEXT', 'text', ARRAY['collateralAssetDetails.assetType', 'buildProfile.values.assetType']),
            ('collateral_maker', 'TEXT', 'text', ARRAY['collateralAssetDetails.maker', 'buildProfile.values.maker']),
            ('collateral_brand', 'TEXT', 'text', ARRAY['collateralAssetDetails.brand', 'buildProfile.values.brand']),
            ('collateral_model', 'TEXT', 'text', ARRAY['collateralAssetDetails.model', 'buildProfile.values.model']),
            ('collateral_year', 'TEXT', 'text', ARRAY['collateralAssetDetails.year', 'buildProfile.values.year']),
            ('vehicle_marketability_category', 'TEXT', 'text', ARRAY['collateralAssetDetails.vehicleMarketabilityCategory', 'buildProfile.values.vehicleMarketabilityCategory']),
            ('vehicle_condition_category', 'TEXT', 'text', ARRAY['collateralAssetDetails.vehicleConditionCategory', 'buildProfile.values.vehicleConditionCategory']),
            ('vehicle_type_category', 'TEXT', 'text', ARRAY['collateralAssetDetails.vehicleTypeCategory', 'buildProfile.values.vehicleTypeCategory']),
            ('motorcycle_intended_use', 'TEXT', 'text', ARRAY['collateralAssetDetails.motorcycleIntendedUse', 'buildProfile.values.motorcycleIntendedUse']),
            ('property_marketability_category', 'TEXT', 'text', ARRAY['collateralAssetDetails.propertyMarketabilityCategory', 'buildProfile.values.propertyMarketabilityCategory']),
            ('house_unit_model_category', 'TEXT', 'text', ARRAY['collateralAssetDetails.houseUnitModelCategory', 'buildProfile.values.houseUnitModelCategory']),
            ('collateral_occupancy_type', 'TEXT', 'text', ARRAY['collateralAssetDetails.collateralOccupancyType', 'buildProfile.values.collateralOccupancyType']),
            ('property_appraised_value', 'NUMERIC', 'numeric', ARRAY['collateralAssetDetails.propertyAppraisedValue', 'buildProfile.values.propertyAppraisedValue']),
            ('collateral_policy_number', 'TEXT', 'text', ARRAY['collateralAssetDetails.policyNumber', 'buildProfile.values.policyNumber']),
            ('collateral_or_number', 'TEXT', 'text', ARRAY['collateralAssetDetails.orNumber', 'buildProfile.values.orNumber']),
            ('collateral_cr_number', 'TEXT', 'text', ARRAY['collateralAssetDetails.crNumber', 'buildProfile.values.crNumber'])
        ) AS definitions(column_name, column_type, value_kind, json_paths)
    LOOP
        EXECUTE FORMAT(
            'ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS %I %s',
            mapping.column_name,
            mapping.column_type
        );

        source_expression := FORMAT(
            'pg_temp.jsonb_first_text(requirements, %L::TEXT[])',
            mapping.json_paths::TEXT
        );
        value_expression := CASE mapping.value_kind
            WHEN 'numeric' THEN FORMAT('pg_temp.try_numeric(%s)', source_expression)
            WHEN 'integer' THEN FORMAT('pg_temp.try_integer(%s)', source_expression)
            WHEN 'date' THEN FORMAT('pg_temp.try_date(%s)', source_expression)
            WHEN 'boolean' THEN FORMAT('pg_temp.try_boolean(%s)', source_expression)
            ELSE source_expression
        END;

        EXECUTE FORMAT(
            'UPDATE loan_applications SET %1$I = %2$s WHERE %1$I IS NULL AND requirements IS NOT NULL AND %2$s IS NOT NULL',
            mapping.column_name,
            value_expression
        );
    END LOOP;
END
$$;

ALTER TABLE loan_applications
    ADD COLUMN IF NOT EXISTS enhanced_due_diligence TEXT,
    ADD COLUMN IF NOT EXISTS questionnaire_responses JSONB,
    ADD COLUMN IF NOT EXISTS asset_details JSONB,
    ADD COLUMN IF NOT EXISTS liability_details JSONB,
    ADD COLUMN IF NOT EXISTS additional_loan_details JSONB,
    ADD COLUMN IF NOT EXISTS bank_account_details JSONB,
    ADD COLUMN IF NOT EXISTS credit_history_details JSONB,
    ADD COLUMN IF NOT EXISTS build_profile_values JSONB,
    ADD COLUMN IF NOT EXISTS build_profile_documents JSONB,
    ADD COLUMN IF NOT EXISTS suitability_answers JSONB,
    ADD COLUMN IF NOT EXISTS co_borrowers JSONB,
    ADD COLUMN IF NOT EXISTS guarantors JSONB,
    ADD COLUMN IF NOT EXISTS additional_collaterals JSONB,
    ADD COLUMN IF NOT EXISTS real_estate_collaterals JSONB,
    ADD COLUMN IF NOT EXISTS financial_instrument_collaterals JSONB,
    ADD COLUMN IF NOT EXISTS property_declarations JSONB,
    ADD COLUMN IF NOT EXISTS step3_financial_investments JSONB,
    ADD COLUMN IF NOT EXISTS financial_investments JSONB,
    ADD COLUMN IF NOT EXISTS dependents JSONB,
    ADD COLUMN IF NOT EXISTS build_profile_completion_percent NUMERIC,
    ADD COLUMN IF NOT EXISTS build_profile_step INTEGER;

UPDATE loan_applications
SET
    enhanced_due_diligence = COALESCE(enhanced_due_diligence, NULLIF(requirements->'enhancedDueDiligence', '{}'::JSONB)::TEXT),
    questionnaire_responses = COALESCE(questionnaire_responses, NULLIF(requirements->'psychometricAssessment', '{}'::JSONB)),
    asset_details = COALESCE(
        asset_details,
        JSONB_BUILD_OBJECT(
            'collateral', COALESCE(requirements->'collateralAssetDetails', '{}'::JSONB),
            'additionalCollaterals', COALESCE(requirements #> '{buildProfile,additionalCollaterals}', '[]'::JSONB),
            'propertyDeclarations', COALESCE(requirements #> '{buildProfile,propertyDeclarations}', '[]'::JSONB),
            'financialInvestments', COALESCE(requirements #> '{buildProfile,financialInvestments}', '[]'::JSONB)
        )
    ),
    liability_details = COALESCE(liability_details, requirements #> '{buildProfile,additionalLoans}'),
    additional_loan_details = COALESCE(additional_loan_details, requirements #> '{buildProfile,additionalLoans}'),
    bank_account_details = COALESCE(bank_account_details, requirements->'bankingRelationships'),
    credit_history_details = COALESCE(
        credit_history_details,
        CASE WHEN requirements ? 'bankingRelationships' THEN JSONB_BUILD_OBJECT(
            'creditPaymentHistory', requirements #> '{bankingRelationships,creditPaymentHistory}',
            'creditCardRelationshipStatus', requirements #> '{bankingRelationships,creditCardRelationshipStatus}',
            'accountHandling', requirements #> '{bankingRelationships,accountHandling}',
            'utilityCreditBureauStatus', requirements #> '{bankingRelationships,utilityCreditBureauStatus}'
        ) END
    ),
    build_profile_values = COALESCE(build_profile_values, requirements #> '{buildProfile,values}'),
    build_profile_documents = COALESCE(build_profile_documents, requirements #> '{buildProfile,documents}'),
    suitability_answers = COALESCE(suitability_answers, requirements #> '{buildProfile,suitabilityAnswers}'),
    co_borrowers = COALESCE(co_borrowers, requirements->'coBorrowers', requirements #> '{buildProfile,coBorrowers}'),
    guarantors = COALESCE(guarantors, requirements #> '{buildProfile,guarantors}'),
    additional_collaterals = COALESCE(additional_collaterals, requirements #> '{buildProfile,additionalCollaterals}'),
    real_estate_collaterals = COALESCE(real_estate_collaterals, requirements #> '{buildProfile,realEstateCollaterals}'),
    financial_instrument_collaterals = COALESCE(financial_instrument_collaterals, requirements #> '{buildProfile,financialInstrumentCollaterals}'),
    property_declarations = COALESCE(property_declarations, requirements #> '{buildProfile,propertyDeclarations}'),
    step3_financial_investments = COALESCE(step3_financial_investments, requirements #> '{buildProfile,step3FinancialInvestments}'),
    financial_investments = COALESCE(financial_investments, requirements #> '{buildProfile,financialInvestments}'),
    dependents = COALESCE(dependents, requirements #> '{buildProfile,dependents}'),
    build_profile_completion_percent = COALESCE(build_profile_completion_percent, pg_temp.try_numeric(requirements #>> '{buildProfile,completionPercent}')),
    build_profile_step = COALESCE(build_profile_step, pg_temp.try_integer(requirements #>> '{buildProfile,step}'))
WHERE requirements IS NOT NULL;

-- The existing mapper defaults this unit to months whenever targetMonths exists.
UPDATE loan_applications
SET financial_goal_target_period_unit = 'months'
WHERE financial_goal_target_period_unit IS NULL
  AND financial_goal_target_period IS NOT NULL;

COMMIT;

-- Verification queries (run after the transaction):
-- SELECT COUNT(*) AS rows_with_requirements FROM loan_applications WHERE requirements IS NOT NULL;
-- SELECT COUNT(*) AS rows_with_profile_columns FROM loan_applications WHERE build_profile_values IS NOT NULL;
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'loan_applications' ORDER BY ordinal_position;