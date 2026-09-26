"""Create and seed the unified Apple App Store and Google Play billing tables."""

import json
import os

from sqlalchemy import text

from app.database import Base, SessionLocal, engine
from app.models.subscription import PaymentProvider, StoreProduct, StorePurchase, SubscriptionPlan


STORE_PROVIDERS = (
    ("GOOGLE_PLAY", "Google Play", "https://androidpublisher.googleapis.com"),
    ("APPLE_APP_STORE", "Apple App Store", "https://api.storekit.itunes.apple.com"),
)

POSTGRES_UPGRADE_STATEMENTS = (
    "ALTER TABLE store_products ALTER COLUMN plan_id DROP NOT NULL",
    "ALTER TABLE store_products ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) NOT NULL DEFAULT 'SUBS'",
    "ALTER TABLE store_products ADD COLUMN IF NOT EXISTS entitlement_category VARCHAR(30)",
    "ALTER TABLE store_purchases ALTER COLUMN subscription_id DROP NOT NULL",
    """
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_store_products_product_type') THEN
            ALTER TABLE store_products ADD CONSTRAINT ck_store_products_product_type
            CHECK (product_type IN ('SUBS','INAPP'));
        END IF;
    END $$
    """,
    """
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_store_products_entitlement_category') THEN
            ALTER TABLE store_products ADD CONSTRAINT ck_store_products_entitlement_category
            CHECK (entitlement_category IS NULL OR entitlement_category IN
                ('REPORTS','STATEMENTS','CERTIFICATIONS','SCORES'));
        END IF;
    END $$
    """,
    """
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_store_products_product_coherence') THEN
            ALTER TABLE store_products ADD CONSTRAINT ck_store_products_product_coherence CHECK (
                (product_type = 'SUBS' AND plan_id IS NOT NULL AND entitlement_category IS NULL) OR
                (product_type = 'INAPP' AND platform = 'ANDROID' AND plan_id IS NULL
                    AND base_plan_id IS NULL AND entitlement_category IS NOT NULL)
            );
        END IF;
    END $$
    """,
    """
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT platform, purchase_token_hash FROM store_purchases
            GROUP BY platform, purchase_token_hash HAVING COUNT(*) > 1
        ) THEN
            CREATE UNIQUE INDEX IF NOT EXISTS uq_store_purchases_platform_token
            ON store_purchases(platform, purchase_token_hash);
        END IF;
    END $$
    """,
)


def run_migration() -> None:
    Base.metadata.create_all(
        bind=engine,
        tables=[StoreProduct.__table__, StorePurchase.__table__],
        checkfirst=True,
    )
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            for statement in POSTGRES_UPGRADE_STATEMENTS:
                connection.execute(text(statement))
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
            product_id = str(mapping.get("product_id") or "").strip()
            product_type = str(mapping.get("product_type") or "SUBS").upper()
            category = str(
                mapping.get("entitlement_category") or mapping.get("category") or ""
            ).upper() or None
            plan = None
            if platform not in {"ANDROID", "IOS"} or not product_id or product_type not in {"SUBS", "INAPP"}:
                raise ValueError("Store mappings require a valid platform, product_id, and product_type")
            if product_type == "SUBS":
                plan_code = str(mapping.get("plan_code") or "").upper()
                if not plan_code or category is not None:
                    raise ValueError("SUBS store mappings require plan_code and no category")
                plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_code == plan_code).first()
                if plan is None:
                    raise ValueError(f"Subscription plan {plan_code} does not exist")
            elif (
                platform != "ANDROID"
                or category not in {"REPORTS", "STATEMENTS", "CERTIFICATIONS", "SCORES"}
                or mapping.get("base_plan_id")
                or mapping.get("plan_code")
            ):
                raise ValueError("INAPP store mappings require Android, category, and no plan or base plan")
            existing = (
                db.query(StoreProduct)
                .filter(StoreProduct.platform == platform)
                .filter(StoreProduct.product_id == product_id)
                .first()
            )
            if existing is None:
                db.add(StoreProduct(
                    plan_id=plan.id if plan is not None else None,
                    platform=platform,
                    product_id=product_id,
                    base_plan_id=(str(mapping.get("base_plan_id") or "").strip() or None),
                    product_type=product_type,
                    entitlement_category=category,
                    is_active=True,
                ))
            else:
                existing.plan_id = plan.id if plan is not None else None
                existing.base_plan_id = str(mapping.get("base_plan_id") or "").strip() or None
                existing.product_type = product_type
                existing.entitlement_category = category
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