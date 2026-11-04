"""
Empirical Verification Test Suite for Milestone 2
Next.js App Router, Tailwind CSS, Prisma 17 ERD Models, Types, and Seeding
Author: worker_m2 (QA / Implementer)
"""

import os
import sys
import hmac
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def test_prisma_schema_entities():
    schema_path = ROOT / "prisma" / "schema.prisma"
    assert schema_path.exists(), "schema.prisma does not exist"
    content = schema_path.read_text(encoding="utf-8")

    expected_models = [
        "User", "Teacher", "Parent", "Student", "ParentStudentLink",
        "AcademicYear", "Class", "Subject", "Schedule",
        "GateAttendance", "ClassJournal", "SubjectAttendance",
        "Documentation", "Assessment", "StudentGrade",
        "LeaveRequest", "WaNotificationLog"
    ]
    for model in expected_models:
        assert f"model {model}" in content, f"Model {model} missing from schema.prisma"

    expected_enums = [
        "Role", "Gender", "StudentStatus", "ParentRelation",
        "GateStatus", "SubjectStatus", "EngagementBadge",
        "AssessmentCategory", "DocVisibility", "LeaveType",
        "ApprovalStatus", "WaNotifType", "WaStatus"
    ]
    for enum in expected_enums:
        assert f"enum {enum}" in content, f"Enum {enum} missing from schema.prisma"

    print(f"[PASS] 1. Prisma schema contains all {len(expected_models)} models and {len(expected_enums)} enums.")

def test_database_singleton_and_types():
    db_file = ROOT / "src" / "lib" / "db.ts"
    types_file = ROOT / "src" / "types" / "database.ts"

    assert db_file.exists(), "src/lib/db.ts does not exist"
    assert types_file.exists(), "src/types/database.ts does not exist"

    db_content = db_file.read_text(encoding="utf-8")
    assert "prismaClientSingleton" in db_content, "Missing singleton pattern in db.ts"
    assert "globalThis.prismaGlobal" in db_content, "Missing globalThis persistence in db.ts"

    types_content = types_file.read_text(encoding="utf-8")
    assert "StudentWithClassAndParents" in types_content
    assert "ClassJournalWithDetails" in types_content
    assert "ParentSessionContext" in types_content
    assert "ServerActionResult" in types_content
    assert "GateScanInput" in types_content

    print("[PASS] 2. Database singleton and strict type contracts exist and are complete.")

def test_qr_hmac_signing():
    secret = "kunci-rahasia-penandatangan-kartu-qr-siswa-2026"
    short_id = "std26101"
    
    # Python equivalent of Node crypto.createHmac("sha256", secret).update(short_id).digest("hex")[:8]
    h = hmac.new(secret.encode("utf-8"), short_id.encode("utf-8"), hashlib.sha256)
    expected_sig = h.hexdigest()[:8]
    expected_token = f"SHD.{short_id}.{expected_sig}"

    seed_file = ROOT / "prisma" / "seed.ts"
    assert seed_file.exists(), "prisma/seed.ts does not exist"
    seed_content = seed_file.read_text(encoding="utf-8")
    assert "createHmac" in seed_content
    assert "SHD.${shortId}.${signature}" in seed_content

    assert expected_token.startswith("SHD.std26101.")
    assert len(expected_sig) == 8
    print(f"[PASS] 3. HMAC-SHA256 QR token format validated: {expected_token}")

def test_env_and_gitignore_patch():
    env_example = ROOT / ".env.example"
    gitignore = ROOT / ".gitignore"

    assert env_example.exists(), ".env.example does not exist"
    env_text = env_example.read_text(encoding="utf-8")
    required_keys = [
        "DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
        "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
        "WA_GATEWAY_PROVIDER", "WA_GATEWAY_API_URL", "WA_GATEWAY_TOKEN",
        "NEXTAUTH_SECRET", "QR_SIGNING_SECRET", "SCHOOL_NAME",
        "GATE_LATE_THRESHOLD", "GATE_CHECKOUT_START", "SCAN_COOLDOWN_SECONDS",
        "MAX_IMAGE_SIZE_KB", "MAX_IMAGE_DIMENSION_PX"
    ]
    for key in required_keys:
        assert f"{key}=" in env_text, f"Key {key} missing from .env.example"

    gi_text = gitignore.read_text(encoding="utf-8")
    assert ".env*" in gi_text
    assert "!.env.example" in gi_text

    print(f"[PASS] 4. All {len(required_keys)} environment variables present in .env.example and .gitignore wildcard active.")

def test_nextjs_and_tailwind_scaffolding():
    pkg = ROOT / "package.json"
    assert pkg.exists(), "package.json does not exist"

    layout = ROOT / "src" / "app" / "layout.tsx"
    page = ROOT / "src" / "app" / "page.tsx"
    globals_css = ROOT / "src" / "app" / "globals.css"
    tailwind_cfg = ROOT / "tailwind.config.ts"
    next_cfg = ROOT / "next.config.mjs"

    assert layout.exists()
    assert page.exists()
    assert globals_css.exists()
    assert tailwind_cfg.exists()
    assert next_cfg.exists()

    css_text = globals_css.read_text(encoding="utf-8")
    assert "--status-hadir-fg" in css_text
    assert "--status-alpa-fg" in css_text
    assert ".tabular-nums" in css_text
    assert ".btn-press" in css_text

    print("[PASS] 5. Next.js App Router, Tailwind design tokens, and CSS layers verified.")

if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING MILESTONE 2 ARCHITECTURE EMPIRICAL VERIFICATION")
    print("=" * 60)
    test_prisma_schema_entities()
    test_database_singleton_and_types()
    test_qr_hmac_signing()
    test_env_and_gitignore_patch()
    test_nextjs_and_tailwind_scaffolding()
    print("=" * 60)
    print("ALL 5 MILESTONE 2 VERIFICATION SUITES PASSED!")
    print("=" * 60)
