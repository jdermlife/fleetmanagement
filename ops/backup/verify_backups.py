from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_hash_file(payload_file: Path, hash_file: Path) -> bool:
    if not payload_file.exists() or not hash_file.exists():
        return False

    expected = hash_file.read_text(encoding="utf-8").strip().split()[0]
    actual = sha256(payload_file)
    return expected == actual


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify daily backups")
    parser.add_argument("--backup-root", default="backups/daily", help="Backup root path")
    parser.add_argument("--max-age-hours", type=int, default=26, help="Maximum acceptable age for latest backup")
    parser.add_argument("--report-file", default=None, help="Optional path to write JSON verification report")
    args = parser.parse_args()

    report: dict[str, object] = {
        "backup_root": args.backup_root,
        "max_age_hours": args.max_age_hours,
        "status": "unknown",
        "details": [],
    }

    backup_root = Path(args.backup_root)
    if not backup_root.exists():
        report["status"] = "fail"
        report["details"] = ["backup root does not exist"]
        _write_report(args.report_file, report)
        print("FAIL: backup root does not exist")
        return 1

    runs = sorted([p for p in backup_root.iterdir() if p.is_dir()])
    if not runs:
        report["status"] = "fail"
        report["details"] = ["no backup runs found"]
        _write_report(args.report_file, report)
        print("FAIL: no backup runs found")
        return 1

    latest = runs[-1]
    report["latest_backup_run"] = str(latest)
    age_ok = datetime.now() - datetime.fromtimestamp(latest.stat().st_mtime) <= timedelta(hours=args.max_age_hours)
    if not age_ok:
        report["status"] = "fail"
        report["details"] = [f"latest backup too old: {latest}"]
        _write_report(args.report_file, report)
        print(f"FAIL: latest backup is too old: {latest}")
        return 1

    checks = []
    checks.append((latest / "database.dump", latest / "database.dump.sha256"))
    checks.append((latest / "documents.tar.gz", latest / "documents.tar.gz.sha256"))
    checks.append((latest / "config.tar.gz", latest / "config.tar.gz.sha256"))

    any_valid = False
    detail_messages: list[str] = []
    for payload, hash_file in checks:
        if payload.exists() and hash_file.exists():
            any_valid = True
            if not verify_hash_file(payload, hash_file):
                report["status"] = "fail"
                report["details"] = [f"checksum mismatch for {payload.name}"]
                _write_report(args.report_file, report)
                print(f"FAIL: checksum mismatch for {payload.name}")
                return 1
            detail_messages.append(f"verified {payload.name}")

    if not any_valid:
        report["status"] = "fail"
        report["details"] = ["no checksum-verifiable backup artifacts found"]
        _write_report(args.report_file, report)
        print("FAIL: no checksum-verifiable backup artifacts found")
        return 1

    report["status"] = "ok"
    report["details"] = detail_messages
    _write_report(args.report_file, report)
    print(f"OK: verified latest backup run at {latest}")
    return 0


def _write_report(report_file: str | None, report: dict[str, object]) -> None:
    if not report_file:
        return

    report_path = Path(report_file)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
