import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from typing import List, Dict, Any

load_dotenv()
app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'dbname': os.getenv('DB_NAME'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASS'),
    'sslmode': os.getenv('DB_SSLMODE', 'require')
}

def get_db():
    return psycopg2.connect(**DB_CONFIG)

# ==========================================
# 🧠 CREDIT SCORING ENGINE (PDF Rules)
# ==========================================
class CreditScoringEngine:
    @staticmethod
    def _score_capacity(b: Dict) -> int:
        score = 0
        m = b.get('is_married', False)
        dsr = b.get('dsr_percent', 0)
        if m:
            if dsr <= 20: score += 8
            elif dsr <= 30: score += 6
            elif dsr <= 40: score += 4
            elif dsr <= 50: score += 2
        else:
            if dsr <= 20: score += 4
            elif dsr <= 30: score += 3
            elif dsr <= 40: score += 2

        ndi = b.get('net_disposable_income', 0)
        if ndi >= 100000: score += 6
        elif ndi >= 80000: score += 5
        elif ndi >= 60000: score += 4
        elif ndi >= 40000: score += 2

        hh = b.get('household_members', 0)
        score += {0:6, 1:5, 2:4, 3:3, 4:2}.get(min(hh, 4), 0)

        adb = b.get('adb_amount', 0)
        if adb >= 100000: score += 5
        elif adb >= 10000: score += 3
        return min(score, 25)

    @staticmethod
    def _score_character(b: Dict) -> int:
        score = 0
        score += {'excellent':10, 'satisfactory':5, 'none':0, 'poor':-10}.get(b.get('loan_history', 'none'), 0)
        score += {'excellent':5, 'satisfactory':3, 'poor':-5}.get(b.get('deposit_handling', 'excellent'), 0)
        score += {'very_satisfactory':6, 'satisfactory':6, 'dismissed_settled':3, 'not_satisfactory':-6}.get(b.get('utility_payment', 'very_satisfactory'), 0)
        score += {'respectable':4, 'adverse':0}.get(b.get('lifestyle', 'respectable'), 0)
        return min(score, 25)

    @staticmethod
    def _score_condition(b: Dict) -> int:
        score = 0
        score += 8 if b.get('is_locally_employed', False) else 4

        ey = b.get('employer_years', 0)
        if ey >= 10: score += 7
        elif ey >= 5: score += 5
        elif ey >= 3: score += 3

        sy = b.get('service_years', 0)
        if sy >= 5: score += 5
        elif sy >= 3: score += 3
        elif sy >= 1: score += 1

        ay = b.get('address_stay_years', 0)
        if ay >= 5: score += 5
        elif ay >= 3: score += 3
        elif ay >= 1: score += 1
        return min(score, 25)

    @staticmethod
    def _score_property(p: Dict) -> int:
        score = 0
        score += {'a':7, 'b':7, 'c':7, 'lowcost':4, 'outside':0}.get(p.get('property_class', 'c'), 0)
        val = p.get('appraised_value', 0)
        if val >= 3000000: score += 7
        elif val >= 1000000: score += 3
        elif val >= 300000: score += 1
        score += {'single_detached':6, 'single_attached':4, 'condominium':4, 'townhouse':2, 'row_house':0}.get(p.get('property_type', 'single_detached'), 0)
        score += 5 if p.get('is_primary_residence', False) else 3
        return min(score, 25)

    @classmethod
    def compute_application(cls, borrowers: List[Dict], properties: List[Dict]) -> Dict[str, Any]:
        # 📏 PDF Rule: Capacity uses highest income borrower
        best_income = max(borrowers, key=lambda b: b.get('net_disposable_income', 0))
        capacity_score = cls._score_capacity(best_income)

        # 👤 PDF Rule: Character uses lower score (conservative)
        char_scores = [cls._score_character(b) for b in borrowers]
        character_score = min(char_scores) if char_scores else 0

        # 💼 PDF Rule: Condition prefers locally employed, else max score
        locally = [b for b in borrowers if b.get('is_locally_employed', False)]
        condition_borrower = locally[0] if locally else max(borrowers, key=lambda b: cls._score_condition(b))
        condition_score = cls._score_condition(condition_borrower)

        # 🏠 Collateral: Score each property, cap total at 18 per bank policy
        coll_scores = [cls._score_property(p) for p in properties]
        collateral_score = min(sum(coll_scores), 18)

        total = capacity_score + character_score + collateral_score + condition_score
        risk = "Low Risk" if total >= 80 else "Medium Risk" if total >= 60 else "High Risk"

        return {
            "capacity_score": capacity_score,
            "character_score": character_score,
            "collateral_score": collateral_score,
            "condition_score": condition_score,
            "total_score": total,
            "risk_classification": risk
        }

# ==========================================
# 🌐 API ENDPOINTS
# ==========================================
@app.route('/api/score', methods=['POST'])
def compute_and_save():
    try:
        data = request.get_json()
        borrowers = data.get('borrowers', [])
        properties = data.get('properties', [])

        if not borrowers or not properties:
            return jsonify({"success": False, "error": "At least one borrower and one property required"}), 400

        scores = CreditScoringEngine.compute_application(borrowers, properties)

        conn = get_db()
        cursor = conn.cursor()

        # 1. Create application & get ID
        cursor.execute("INSERT INTO loan_applications DEFAULT VALUES RETURNING id")
        app_id = cursor.fetchone()[0]

        # 2. Insert borrowers
        for b in borrowers:
            cursor.execute("""
                INSERT INTO borrowers (application_id, is_primary, full_name, is_married, dsr_percent, 
                net_disposable_income, household_members, adb_amount, is_locally_employed, employer_years, service_years, 
                address_stay_years, loan_history, deposit_handling, utility_payment, lifestyle) 
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                app_id, b.get('is_primary', False), b.get('full_name', ''), b.get('is_married', False), b.get('dsr_percent', 0),
                b.get('net_disposable_income', 0), b.get('household_members', 0), b.get('adb_amount', 0),
                b.get('is_locally_employed', False), b.get('employer_years', 0), b.get('service_years', 0),
                b.get('address_stay_years', 0), b.get('loan_history', 'none'), b.get('deposit_handling', 'excellent'),
                b.get('utility_payment', 'very_satisfactory'), b.get('lifestyle', 'respectable')
            ))

        # 3. Insert properties
        for p in properties:
            cursor.execute("""
                INSERT INTO collateral_properties (application_id, property_class, appraised_value, 
                property_type, is_primary_residence) VALUES (%s,%s,%s,%s,%s)
            """, (
                app_id, p.get('property_class', 'c'), p.get('appraised_value', 0),
                p.get('property_type', 'single_detached'), p.get('is_primary_residence', False)
            ))

        # 4. Save scores
        cursor.execute("""
            INSERT INTO application_scores (application_id, capacity_score, character_score, 
            collateral_score, condition_score, total_score, risk_classification) VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            app_id, scores['capacity_score'], scores['character_score'], scores['collateral_score'],
            scores['condition_score'], scores['total_score'], scores['risk_classification']
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "data": scores, "application_id": app_id}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)