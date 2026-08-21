"""Create and seed the unified Apple App Store and Google Play billing tables."""

import json
import os

from app.database import Base, SessionLocal, engine
from app.models.subscription import PaymentProvider, StoreProduct, StorePurchase, SubscriptionPlan


STORE_PROVIDERS = (
    ("GOOGLE_PLAY", "Google Play", "https://androidpublisher.googleapis.com"),
    ("APPLE_APP_STORE", "Apple App Store", "https://api.storekit.itunes.apple.com"),
)


def run_migration() -> None:
    Base.metadata.create_all(
        bind=engine,
        tables=[StoreProduct.__table__, StorePurchase.__table__],
        checkfirst=True,
    )
    db = SessionLocal()
    try:
        for provider_code, provider_name, api_endpoint in STORE_PROVIDERS:
            provider = db.query(PaymentProvider).filter(PaymentProvider.provider_code == provider_code).first()
            if provider is None:
                db.add(PaymentProvider(
                    provider_code=provider_code,
                    provider_name=provider_name,
                    api_endpoint=api_endpoint,
                    is_active=True,
                ))

        raw_mappings = os.getenv("STORE_PRODUCT_MAPPINGS_JSON", "[]").strip() or "[]"
        mappings = json.loads(raw_mappings)
        if not isinstance(mappings, list):
            raise ValueError("STORE_PRODUCT_MAPPINGS_JSON must be a JSON array")
        for mapping in mappings:
            if not isinstance(mapping, dict):
                raise ValueError("Each store product mapping must be an object")
            platform = str(mapping.get("platform") or "").upper()
            plan_code = str(mapping.get("plan_code") or "").upper()
            product_id = str(mapping.get("product_id") or "").strip()
            if platform not in {"ANDROID", "IOS"} or not plan_code or not product_id:
                raise ValueError("Store mappings require platform, plan_code, and product_id")
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_code == plan_code).first()
            if plan is None:
                raise ValueError(f"Subscription plan {plan_code} does not exist")
            existing = (
                db.query(StoreProduct)
                .filter(StoreProduct.platform == platform)
                .filter(StoreProduct.product_id == product_id)
                .first()
            )
            if existing is None:
                db.add(StoreProduct(
                    plan_id=plan.id,
                    platform=platform,
                    product_id=product_id,
                    base_plan_id=str(mapping.get("base_plan_id") or "").strip() or None,
                    is_active=True,
                ))
            else:
                existing.plan_id = plan.id
                existing.base_plan_id = str(mapping.get("base_plan_id") or "").strip() or None
                existing.is_active = True
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()
    print("Store billing migration completed.")