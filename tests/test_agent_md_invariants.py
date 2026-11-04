"""
Empirical Verification Test Harness for agent.md Invariants
Milestone 1: Foundation & Knowledge Tracking
Author: challenger_m1_2
"""

import os
import re
import sys
import json

# Ensure utf-8 output on Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional

AGENT_MD_PATH = os.path.abspath("d:/WEBSITE ABSENSI/agent.md")

@dataclass
class TestResult:
    name: str
    passed: bool
    details: str
    errors: List[str] = field(default_factory=list)

def read_agent_md() -> str:
    if not os.path.exists(AGENT_MD_PATH):
        raise FileNotFoundError(f"agent.md not found at {AGENT_MD_PATH}")
    with open(AGENT_MD_PATH, "r", encoding="utf-8") as f:
        return f.read()

def extract_prisma_schema(content: str) -> str:
    match = re.search(r"```prisma\s*(.*?)\s*```", content, re.DOTALL)
    if not match:
        raise ValueError("No ```prisma ... ``` code block found in agent.md")
    return match.group(1)

def parse_enums(schema_text: str) -> Dict[str, List[str]]:
    enums = {}
    pattern = re.compile(r"enum\s+(\w+)\s*\{([^}]+)\}", re.DOTALL)
    for match in pattern.finditer(schema_text):
        name = match.group(1)
        body = match.group(2)
        values = []
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            # Strip inline comments
            val = line.split("//")[0].strip()
            if val:
                values.append(val)
        enums[name] = values
    return enums

def parse_models(schema_text: str) -> Dict[str, dict]:
    models = {}
    # Pattern to match model Name { ... }
    pattern = re.compile(r"model\s+(\w+)\s*\{([^}]+)\}", re.DOTALL)
    for match in pattern.finditer(schema_text):
        model_name = match.group(1)
        body = match.group(2)
        
        fields = {}
        table_map = None
        indexes = []
        uniques = []
        
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            
            # Check @@map
            map_match = re.search(r"@@map\(\"([^\"]+)\"\)", line)
            if map_match:
                table_map = map_match.group(1)
                continue
            
            # Check @@unique
            unique_match = re.search(r"@@unique\(\[([^\]]+)\]\)", line)
            if unique_match:
                uniques.append([col.strip() for col in unique_match.group(1).split(",")])
                continue

            # Check @@index
            index_match = re.search(r"@@index\(\[([^\]]+)\]\)", line)
            if index_match:
                indexes.append([col.strip() for col in index_match.group(1).split(",")])
                continue
            
            # Field line: name type attributes...
            # e.g. "id String @id @default(uuid()) @db.Uuid"
            parts = line.split("//")[0].strip().split()
            if len(parts) >= 2:
                f_name = parts[0]
                f_type = parts[1]
                f_attrs = " ".join(parts[2:])
                fields[f_name] = {
                    "type": f_type,
                    "attrs": f_attrs,
                    "raw": line
                }
        
        models[model_name] = {
            "table_map": table_map,
            "fields": fields,
            "uniques": uniques,
            "indexes": indexes
        }
    return models

def run_tests():
    content = read_agent_md()
    schema_text = extract_prisma_schema(content)
    enums = parse_enums(schema_text)
    models = parse_models(schema_text)
    
    results: List[TestResult] = []
    
    # -------------------------------------------------------------
    # SUITE 1: 17 ERD Models / Tables Verification
    # -------------------------------------------------------------
    expected_tables = {
        "users": "User",
        "teachers": "Teacher",
        "parents": "Parent",
        "students": "Student",
        "parent_student_links": "ParentStudentLink",
        "academic_years": "AcademicYear",
        "classes": "Class",
        "subjects": "Subject",
        "schedules": "Schedule",
        "gate_attendances": "GateAttendance",
        "class_journals": "ClassJournal",
        "subject_attendances": "SubjectAttendance",
        "documentations": "Documentation",
        "assessments": "Assessment",
        "student_grades": "StudentGrade",
        "leave_requests": "LeaveRequest",
        "wa_notification_logs": "WaNotificationLog"
    }
    
    missing_models = []
    missing_mappings = []
    for tbl, mdl in expected_tables.items():
        if mdl not in models:
            missing_models.append(mdl)
        elif models[mdl]["table_map"] != tbl:
            missing_mappings.append(f"{mdl} mapped to '{models[mdl]['table_map']}', expected '{tbl}'")
            
    if not missing_models and not missing_mappings:
        results.append(TestResult(
            "1.1 ERD Tables & Models Presence",
            True,
            f"All {len(expected_tables)} models present and correctly mapped to PostgreSQL snake_case tables."
        ))
    else:
        results.append(TestResult(
            "1.1 ERD Tables & Models Presence",
            False,
            f"Missing models: {missing_models}, Incorrect mappings: {missing_mappings}",
            errors=missing_models + missing_mappings
        ))

    # -------------------------------------------------------------
    # SUITE 2: Primary Keys, UUIDs & Cascades
    # -------------------------------------------------------------
    pk_errors = []
    for mdl, data in models.items():
        id_field = data["fields"].get("id")
        if not id_field:
            pk_errors.append(f"{mdl} is missing 'id' field")
        else:
            if "@id" not in id_field["attrs"]:
                pk_errors.append(f"{mdl}.id missing @id attribute")
            if "@default(uuid())" not in id_field["attrs"]:
                pk_errors.append(f"{mdl}.id missing @default(uuid()) attribute")
            if "@db.Uuid" not in id_field["attrs"]:
                pk_errors.append(f"{mdl}.id missing @db.Uuid attribute")
                
    if not pk_errors:
        results.append(TestResult(
            "1.2 Primary Key Invariants",
            True,
            f"All {len(models)} models enforce UUID primary key with @default(uuid()) and @db.Uuid."
        ))
    else:
        results.append(TestResult(
            "1.2 Primary Key Invariants",
            False,
            f"PK errors found: {len(pk_errors)}",
            errors=pk_errors
        ))

    # Foreign Key Cascade checks:
    cascade_checks = [
        ("Teacher", "user", "Cascade"),
        ("Parent", "user", "Cascade"),
        ("Student", "class", "Restrict"),
        ("Student", "user", "SetNull"),
        ("ParentStudentLink", "parent", "Cascade"),
        ("ParentStudentLink", "student", "Cascade"),
        ("Class", "academicYear", "Restrict"),
        ("Class", "homeroomTeacher", "SetNull"),
        ("Schedule", "class", "Cascade"),
        ("Schedule", "subject", "Cascade"),
        ("Schedule", "teacher", "Restrict"),
        ("GateAttendance", "student", "Cascade"),
        ("ClassJournal", "schedule", "SetNull"),
        ("ClassJournal", "class", "Restrict"),
        ("ClassJournal", "subject", "Restrict"),
        ("ClassJournal", "teacher", "Restrict"),
        ("SubjectAttendance", "journal", "Cascade"),
        ("SubjectAttendance", "student", "Cascade"),
        ("Documentation", "journal", "Cascade"),
        ("Assessment", "class", "Cascade"),
        ("Assessment", "subject", "Cascade"),
        ("Assessment", "teacher", "Restrict"),
        ("Assessment", "journal", "SetNull"),
        ("StudentGrade", "assessment", "Cascade"),
        ("StudentGrade", "student", "Cascade"),
        ("LeaveRequest", "student", "Cascade"),
        ("LeaveRequest", "parent", "Cascade"),
        ("LeaveRequest", "approvedBy", "SetNull"),
        ("WaNotificationLog", "student", "Cascade")
    ]
    
    cascade_errors = []
    for mdl, rel_field, expected_action in cascade_checks:
        field_info = models.get(mdl, {}).get("fields", {}).get(rel_field)
        if not field_info:
            cascade_errors.append(f"{mdl}.{rel_field} relation field missing")
            continue
        expected_pattern = f"onDelete:\\s*{expected_action}"
        if not re.search(expected_pattern, field_info["attrs"]):
            cascade_errors.append(f"{mdl}.{rel_field} expected onDelete: {expected_action}, found: {field_info['attrs']}")

    if not cascade_errors:
        results.append(TestResult(
            "1.3 Foreign Key Cascades & Deletion Integrity",
            True,
            f"All {len(cascade_checks)} foreign key relation policies match exact integrity requirements (Cascade, Restrict, SetNull)."
        ))
    else:
        results.append(TestResult(
            "1.3 Foreign Key Cascades & Deletion Integrity",
            False,
            f"Cascade errors found: {len(cascade_errors)}",
            errors=cascade_errors
        ))

    # Composite Unique Constraints
    unique_checks = [
        ("ParentStudentLink", ["parentId", "studentId"]),
        ("GateAttendance", ["studentId", "attendanceDate"]),
        ("SubjectAttendance", ["journalId", "studentId"]),
        ("StudentGrade", ["assessmentId", "studentId"])
    ]
    unique_errors = []
    for mdl, expected_cols in unique_checks:
        found = False
        for u in models.get(mdl, {}).get("uniques", []):
            if set(u) == set(expected_cols):
                found = True
                break
        if not found:
            unique_errors.append(f"{mdl} missing @@unique({expected_cols})")

    if not unique_errors:
        results.append(TestResult(
            "1.4 Composite Unique Integrity Constraints",
            True,
            f"All {len(unique_checks)} critical composite unique constraints verified."
        ))
    else:
        results.append(TestResult(
            "1.4 Composite Unique Integrity Constraints",
            False,
            f"Unique constraint errors: {len(unique_errors)}",
            errors=unique_errors
        ))

    # -------------------------------------------------------------
    # SUITE 3: Enums Verification
    # -------------------------------------------------------------
    expected_enums = {
        "Role": ["ADMIN", "TEACHER", "PARENT", "STUDENT", "SCANNER"],
        "Gender": ["L", "P"],
        "StudentStatus": ["ACTIVE", "GRADUATED", "MOVED"],
        "ParentRelation": ["AYAH", "IBU", "WALI"],
        "GateStatus": ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALPA"],
        "SubjectStatus": ["HADIR", "SAKIT", "IZIN", "ALPA_BOLOS"],
        "EngagementBadge": ["ACTIVE_STAR", "GOOD", "LESS_FOCUS", "NO_TASK"],
        "AssessmentCategory": ["TUGAS", "KUIS", "PRAKTIKUM", "UH", "PTS", "PAS"],
        "DocVisibility": ["CLASS_PUBLIC", "TAGGED_STUDENTS_ONLY"],
        "LeaveType": ["SAKIT", "IZIN"],
        "ApprovalStatus": ["PENDING", "APPROVED", "REJECTED"],
        "WaNotifType": ["GATE_LATE", "GATE_IN", "ABSENT_ALERT", "GRADE_UPDATE", "DAILY_DIGEST"],
        "WaStatus": ["QUEUED", "SENT", "FAILED"]
    }
    
    enum_errors = []
    for ename, expected_vals in expected_enums.items():
        if ename not in enums:
            enum_errors.append(f"Enum {ename} missing")
            continue
        actual_vals = enums[ename]
        if set(actual_vals) != set(expected_vals):
            enum_errors.append(f"Enum {ename} mismatch. Expected {expected_vals}, got {actual_vals}")

    if not enum_errors:
        results.append(TestResult(
            "1.5 Enum Declarations (13 enums)",
            True,
            f"All {len(expected_enums)} enum types declared with exact values matching PRD and ARCHITECTURE."
        ))
    else:
        results.append(TestResult(
            "1.5 Enum Declarations (13 enums)",
            False,
            f"Enum errors: {len(enum_errors)}",
            errors=enum_errors
        ))

    # -------------------------------------------------------------
    # SUITE 4: Business Logic Invariants
    # -------------------------------------------------------------
    biz_tests = []
    
    # Anti-Fraud: 5-minute cooldown
    has_cooldown = bool(re.search(r"5-Minute Scan Cooldown|300 seconds|< 300 seconds", content, re.IGNORECASE))
    biz_tests.append(("5-Minute Scan Cooldown (Anti-Duplicate)", has_cooldown, "Cooldown rule explicitly defined with <300 seconds rate limiting"))

    # Anti-Fraud: Signed QR token format SHD.<id>.<sig>
    has_signed_qr = bool(re.search(r"SHD\.<student_short_id>\.<signature>|SHD\.<id>\.<sig>|HMAC-SHA256", content))
    biz_tests.append(("Signed QR Token Format (HMAC-SHA256)", has_signed_qr, "QR token specified as SHD.<id>.<sig> with HMAC-SHA256 signature"))

    # Anti-Fraud: Face popup modal
    has_face_popup = bool(re.search(r"Face Verification Pop-up|Large verified student portrait modal|Full-size student profile photo", content, re.IGNORECASE))
    biz_tests.append(("Face Verification Popup UI", has_face_popup, "High-contrast student portrait modal for visual verification by gate operator"))

    # Anti-Fraud: Audio feedback chime
    has_audio = bool(re.search(r"beep-success\.mp3.*beep-error\.mp3|beep-success|beep-error", content, re.IGNORECASE))
    biz_tests.append(("Audio Feedback Tones", has_audio, "Explicit beep-success.mp3 and beep-error.mp3 defined for scanner feedback"))

    # Bolos Anomaly Detection
    has_bolos = bool(re.search(r"GateAttendance\.status\s*==\s*HADIR.*SubjectAttendance\.status\s*==\s*ALPA_BOLOS|Bolos Detection Rule", content, re.DOTALL))
    biz_tests.append(("Bolos Anomaly Detection Rule", has_bolos, "Cross-layer gate HADIR vs subject ALPA_BOLOS triggers Early Warning System & instant WhatsApp alert"))

    # WebP Compression: Max 1280px, WebP, <= 180 KB, WebWorker
    has_webp_1280 = bool(re.search(r"1280px", content))
    has_webp_format = bool(re.search(r"image/webp", content, re.IGNORECASE))
    has_webp_180kb = bool(re.search(r"180 KB", content))
    has_webp_worker = bool(re.search(r"WebWorker|OffscreenCanvas", content, re.IGNORECASE))
    webp_valid = has_webp_1280 and has_webp_format and has_webp_180kb and has_webp_worker
    biz_tests.append(("Client-Side WebP Compression Pipeline", webp_valid, "Enforces <=1280px bounding box, image/webp format, <=180 KB ceiling, and WebWorker / OffscreenCanvas execution"))

    # Two-tier grading: 4 badges (🌟, ✅, ⚠️, ❌), default GOOD + 0-100 formal grading with KKM
    has_badges = bool(re.search(r"🌟", content) and re.search(r"✅", content) and re.search(r"⚠️", content) and re.search(r"❌", content))
    has_default_good = bool(re.search(r"default.*GOOD|default\s*state.*GOOD", content, re.IGNORECASE))
    has_kkm_tier2 = bool(re.search(r"0\.00.*100\.00", content) and re.search(r"KKM", content))
    grading_valid = has_badges and has_default_good and has_kkm_tier2
    biz_tests.append(("Two-Tier Grading Engine", grading_valid, "Tier 1: 4 engagement badges (🌟, ✅, ⚠️, ❌) default GOOD + Tier 2: 0-100 grading with KKM mastery indicator"))

    # WhatsApp Gateway: Queue table, 4-10s random jitter, Spintax
    has_wa_queue = bool(re.search(r"wa_notification_logs", content) and re.search(r"QUEUED", content))
    has_wa_jitter = bool(re.search(r"4\s*(?:to|-)\s*10\s*second", content, re.IGNORECASE))
    has_spintax = bool(re.search(r"Spintax|Assalamu'alaikum\|Selamat Pagi\|Halo", content))
    wa_valid = has_wa_queue and has_wa_jitter and has_spintax
    biz_tests.append(("WhatsApp Gateway & Anti-Ban Architecture", wa_valid, "Queue table in DB, 4-10s randomized jitter delay, and dynamic Spintax template engine"))

    for name, ok, details in biz_tests:
        results.append(TestResult(f"2. Business Logic: {name}", ok, details, errors=[] if ok else [f"{name} failed check"]))

    # -------------------------------------------------------------
    # SUITE 5: UI/UX Design Intelligence
    # -------------------------------------------------------------
    ux_tests = []
    
    # Active scale 0.97
    has_active_scale = bool(re.search(r"scale\(0\.97\)", content))
    ux_tests.append(("Active Scale Feedback 0.97", has_active_scale, "transform: scale(0.97) on :active state with cubic-bezier timing"))

    # Custom ease-out cubic-bezier(0.23, 1, 0.32, 1) & <=250ms duration
    has_ease_out = bool(re.search(r"cubic-bezier\(0\.23,\s*1,\s*0\.32,\s*1\)", content))
    has_duration_limit = bool(re.search(r"250ms", content))
    ux_tests.append(("Micro-interaction Timing & Easing", has_ease_out and has_duration_limit, "cubic-bezier(0.23, 1, 0.32, 1) and <=250ms duration enforced"))

    # 3-second rule for parents
    has_3sec_rule = bool(re.search(r"3-Second Rule", content, re.IGNORECASE))
    ux_tests.append(("Parent Portal 3-Second Rule", has_3sec_rule, "Instant comprehension of school arrival, current lesson, and participation without scrolling"))

    # Mobile-first touch targets >= 44x44px
    has_touch_target = bool(re.search(r"44px\s*[×x]\s*44px|44\s*x\s*44", content, re.IGNORECASE))
    ux_tests.append(("Accessibility Touch Targets >= 44x44px", has_touch_target, "Minimum 44px x 44px touch targets for mobile thumb ergonomics"))

    for name, ok, details in ux_tests:
        results.append(TestResult(f"3. Design Intelligence: {name}", ok, details, errors=[] if ok else [f"{name} failed check"]))

    return results

if __name__ == "__main__":
    print("=" * 70)
    print("RUNNING EMPIRICAL VERIFICATION ON agent.md")
    print("=" * 70)
    test_results = run_tests()
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r.passed)
    failed = total - passed
    
    for r in test_results:
        status = "PASS" if r.passed else "FAIL"
        print(f"[{status}] {r.name}")
        print(f"       {r.details}")
        if r.errors:
            for err in r.errors:
                print(f"       ERROR: {err}")
        print()
        
    print("-" * 70)
    print(f"SUMMARY: {passed}/{total} Passed, {failed} Failed.")
    print("=" * 70)
    
    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)
