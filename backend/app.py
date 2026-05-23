import os
import logging
from typing import List, Dict, Any

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================
load_dotenv()

# =========================================================
# FLASK APP CONFIGURATION
# =========================================================
app = Flask(__name__)
CORS(app)

# =========================================================
# LOGGING CONFIGURATION
# =========================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

logger = logging.getLogger(__name__)

# =========================================================
# DATABASE CONFIGURATION
# =========================================================
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise Exception("DATABASE_URL is missing in .env")

# =========================================================
# SQLALCHEMY ENGINE WITH CONNECTION POOLING
# =========================================================
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True
)

# =========================================================
# DATABASE CONNECTION TEST
# =========================================================
def test_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        logger.info("✅ Connected to Neon PostgreSQL")

    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")

test_connection()

# =========================================================
# CREDIT SCORING ENGINE
# =========================================================
class CreditScoringEngine:

    @staticmethod
    def _score_capacity(b: Dict) -> int:

        score = 0

        married = b.get('is_married', False)
        dsr = b.get('dsr_percent', 0)

        if married:
            if dsr <= 20:
                score += 8
            elif dsr <= 30:
                score += 6
            elif dsr <= 40:
                score += 4
            elif dsr <= 50:
                score += 2
        else:
            if dsr <= 20:
                score += 4
            elif dsr <= 30:
                score += 3
            elif dsr <= 40:
                score += 2

        ndi = b.get('net_disposable_income', 0)

        if ndi >= 100000:
            score += 6
        elif ndi >= 80000:
            score += 5
        elif ndi >= 60000:
            score += 4
        elif ndi >= 40000:
            score += 2

        household = b.get('household_members', 0)

        score += {
            0: 6,
            1: 5,
            2: 4,
            3: 3,
            4: 2
        }.get(min(household, 4), 0)

        adb = b.get('adb_amount', 0)

        if adb >= 100000:
            score += 5
        elif adb >= 10000:
            score += 3

        return min(score, 25)

    @staticmethod
    def _score_character(b: Dict) -> int:

        score = 0

        score += {
            'excellent': 10,
            'satisfactory': 5,
            'none': 0,
            'poor': -10
        }.get(b.get('loan_history', 'none'), 0)

        score += {
            'excellent': 5,
            'satisfactory': 3,
            'poor': -5
        }.get(b.get('deposit_handling', 'excellent'), 0)

        score += {
            'very_satisfactory': 6,
            'satisfactory': 6,
            'dismissed_settled': 3,
            'not_satisfactory': -6
        }.get(b.get('utility_payment', 'very_satisfactory'), 0)

        score += {
            'respectable': 4,
            'adverse': 0
        }.get(b.get('lifestyle', 'respectable'), 0)

        return min(score, 25)

    @staticmethod
    def _score_condition(b: Dict) -> int:

        score = 0

        score += 8 if b.get('is_locally_employed', False) else 4

        employer_years = b.get('employer_years', 0)

        if employer_years >= 10:
            score += 7
        elif employer_years >= 5:
            score += 5
        elif employer_years >= 3:
            score += 3

        service_years = b.get('service_years', 0)

        if service_years >= 5:
            score += 5
        elif service_years >= 3:
            score += 3
        elif service_years >= 1:
            score += 1

        address_years = b.get('address_stay_years', 0)

        if address_years >= 5:
            score += 5
        elif address_years >= 3:
            score += 3
        elif address_years >= 1:
            score += 1

        return min(score, 25)

    @staticmethod
    def _score_property(p: Dict) -> int:

        score = 0

        score += {
            'a': 7,
            'b': 7,
            'c': 7,
            'lowcost': 4,
            'outside': 0
        }.get(p.get('property_class', 'c'), 0)

        value = p.get('appraised_value', 0)

        if value >= 3000000:
            score += 7
        elif value >= 1000000:
            score += 3
        elif value >= 300000:
            score += 1

        score += {
            'single_detached': 6,
            'single_attached': 4,
            'condominium': 4,
            'townhouse': 2,
            'row_house': 0
        }.get(p.get('property_type', 'single_detached'), 0)

        score += 5 if p.get('is_primary_residence', False) else 3

        return min(score, 25)

    @classmethod
    def compute_application(
        cls,
        borrowers: List[Dict],
        properties: List[Dict]
    ) -> Dict[str, Any]:

        best_income = max(
            borrowers,
            key=lambda b: b.get('net_disposable_income', 0)
        )

        capacity_score = cls._score_capacity(best_income)

        char_scores = [
            cls._score_character(b)
            for b in borrowers
        ]

        character_score = min(char_scores) if char_scores else 0

        locally_employed = [
            b for b in borrowers
            if b.get('is_locally_employed', False)
        ]

        condition_borrower = (
            locally_employed[0]
            if locally_employed
            else max(
                borrowers,
                key=lambda b: cls._score_condition(b)
            )
        )

        condition_score = cls._score_condition(condition_borrower)

        collateral_scores = [
            cls._score_property(p)
            for p in properties
        ]

        collateral_score = min(sum(collateral_scores), 18)

        total_score = (
            capacity_score +
            character_score +
            collateral_score +
            condition_score
        )

        risk = (
            "Low Risk"
            if total_score >= 80
            else "Medium Risk"
            if total_score >= 60
            else "High Risk"
        )

        return {
            "capacity_score": capacity_score,
            "character_score": character_score,
            "collateral_score": collateral_score,
            "condition_score": condition_score,
            "total_score": total_score,
            "risk_classification": risk
        }

# =========================================================
# API ROUTES
# =========================================================

@app.route('/api/v1/health', methods=['GET'])
def health():

    try:

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        return jsonify({
            "status": "ok",
            "database": "connected"
        }), 200

    except Exception as e:

        logger.error(f"Health check failed: {e}")

        return jsonify({
            "status": "error",
            "database": str(e)
        }), 500


@app.route('/api/v1/score', methods=['POST'])
def compute_and_save():

    connection = None

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "Invalid JSON payload"
            }), 400

        borrowers = data.get('borrowers', [])
        properties = data.get('properties', [])

        if not borrowers or not properties:

            return jsonify({
                "success": False,
                "error": "At least one borrower and one property required"
            }), 400

        scores = CreditScoringEngine.compute_application(
            borrowers,
            properties
        )

        connection = engine.connect()
        transaction = connection.begin()

        # ==========================================
        # CREATE APPLICATION
        # ==========================================
        application_result = connection.execute(
            text("""
                INSERT INTO loan_applications
                DEFAULT VALUES
                RETURNING id
            """)
        )

        application_id = application_result.fetchone()[0]

        # ==========================================
        # INSERT BORROWERS
        # ==========================================
        for borrower in borrowers:

            connection.execute(
                text("""
                    INSERT INTO borrowers (
                        application_id,
                        is_primary,
                        full_name,
                        is_married,
                        dsr_percent,
                        net_disposable_income,
                        household_members,
                        adb_amount,
                        is_locally_employed,
                        employer_years,
                        service_years,
                        address_stay_years,
                        loan_history,
                        deposit_handling,
                        utility_payment,
                        lifestyle
                    )
                    VALUES (
                        :application_id,
                        :is_primary,
                        :full_name,
                        :is_married,
                        :dsr_percent,
                        :net_disposable_income,
                        :household_members,
                        :adb_amount,
                        :is_locally_employed,
                        :employer_years,
                        :service_years,
                        :address_stay_years,
                        :loan_history,
                        :deposit_handling,
                        :utility_payment,
                        :lifestyle
                    )
                """),
                {
                    "application_id": application_id,
                    "is_primary": borrower.get('is_primary', False),
                    "full_name": borrower.get('full_name', ''),
                    "is_married": borrower.get('is_married', False),
                    "dsr_percent": borrower.get('dsr_percent', 0),
                    "net_disposable_income": borrower.get('net_disposable_income', 0),
                    "household_members": borrower.get('household_members', 0),
                    "adb_amount": borrower.get('adb_amount', 0),
                    "is_locally_employed": borrower.get('is_locally_employed', False),
                    "employer_years": borrower.get('employer_years', 0),
                    "service_years": borrower.get('service_years', 0),
                    "address_stay_years": borrower.get('address_stay_years', 0),
                    "loan_history": borrower.get('loan_history', 'none'),
                    "deposit_handling": borrower.get('deposit_handling', 'excellent'),
                    "utility_payment": borrower.get('utility_payment', 'very_satisfactory'),
                    "lifestyle": borrower.get('lifestyle', 'respectable')
                }
            )

        # ==========================================
        # INSERT COLLATERAL PROPERTIES
        # ==========================================
        for property_item in properties:

            connection.execute(
                text("""
                    INSERT INTO collateral_properties (
                        application_id,
                        property_class,
                        appraised_value,
                        property_type,
                        is_primary_residence
                    )
                    VALUES (
                        :application_id,
                        :property_class,
                        :appraised_value,
                        :property_type,
                        :is_primary_residence
                    )
                """),
                {
                    "application_id": application_id,
                    "property_class": property_item.get('property_class', 'c'),
                    "appraised_value": property_item.get('appraised_value', 0),
                    "property_type": property_item.get('property_type', 'single_detached'),
                    "is_primary_residence": property_item.get('is_primary_residence', False)
                }
            )

        # ==========================================
        # INSERT SCORES
        # ==========================================
        connection.execute(
            text("""
                INSERT INTO application_scores (
                    application_id,
                    capacity_score,
                    character_score,
                    collateral_score,
                    condition_score,
                    total_score,
                    risk_classification
                )
                VALUES (
                    :application_id,
                    :capacity_score,
                    :character_score,
                    :collateral_score,
                    :condition_score,
                    :total_score,
                    :risk_classification
                )
            """),
            {
                "application_id": application_id,
                "capacity_score": scores['capacity_score'],
                "character_score": scores['character_score'],
                "collateral_score": scores['collateral_score'],
                "condition_score": scores['condition_score'],
                "total_score": scores['total_score'],
                "risk_classification": scores['risk_classification']
            }
        )

        transaction.commit()

        logger.info(
            f"Application {application_id} scored successfully"
        )

        return jsonify({
            "success": True,
            "application_id": application_id,
            "data": scores
        }), 200

    except Exception as e:

        logger.error(f"Scoring failed: {e}")

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:

        if connection:
            connection.close()

# =========================================================
# START APPLICATION
# =========================================================
if __name__ == '__main__':

    app.run(
        host='0.0.0.0',
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "False") == "True"
    )