#!/usr/bin/env python3
"""Backfill normalized loan application columns from requirements JSON.

The command is a dry run unless ``--apply`` is provided. Existing non-null
column values are never overwritten.
"""

from __future__ import annotations

import argparse

from app.database import SessionLocal
from app.models.loan_application import LoanApplication
from app.services.loan_application_profile_columns import profile_column_values


def backfill(*, apply_changes: bool, batch_size: int = 200) -> tuple[int, int]:
    scanned = 0
    updated = 0
    db = SessionLocal()
    try:
        records = (
            db.query(LoanApplication)
            .filter(LoanApplication.requirements.isnot(None))
            .yield_per(batch_size)
        )
        for record in records:
            scanned += 1
            changed = False
            for column, value in profile_column_values(record.requirements).items():
                if value is not None and getattr(record, column, None) is None:
                    setattr(record, column, value)
                    changed = True
            if changed:
                updated += 1
                if apply_changes and updated % batch_size == 0:
                    db.commit()

        if apply_changes:
            db.commit()
        else:
            db.flush()
            db.rollback()
        return scanned, updated
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit mapped values; without this flag all changes are rolled back.",
    )
    parser.add_argument("--batch-size", type=int, default=200)
    args = parser.parse_args()

    scanned, updated = backfill(
        apply_changes=args.apply,
        batch_size=max(1, args.batch_size),
    )
    mode = "applied" if args.apply else "dry run"
    print(f"Profile column backfill {mode}: scanned={scanned}, updated={updated}")


if __name__ == "__main__":
    main()