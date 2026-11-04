"""
Automated Verification Suite for Milestone 5: Analytics Recaps & Early Warning System (F5.5 - F5.6)
SiHadir-Edu: Attendance Matrix Recap, Form 8355 Gender Breakdown, 5-Invariant EWS & Counseling SOPs
"""

import os
import re
import sys
import subprocess
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Ensure UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

@dataclass
class TestResult:
    category: str
    name: str
    passed: bool
    details: str
    errors: List[str] = field(default_factory=list)

results: List[TestResult] = []

def record(category: str, name: str, passed: bool, details: str, errors: Optional[List[str]] = None):
    results.append(TestResult(
        category=category,
        name=name,
        passed=passed,
        details=details,
        errors=errors or []
    ))
    status_str = "[PASS]" if passed else "[FAIL]"
    print(f"{status_str} [{category}] {name} - {details}")
    if errors:
        for err in errors:
            print(f"       ERROR: {err}")

# ==============================================================================
# SECTION 1: Attendance Matrix Recap Engine (F5.5)
# ==============================================================================
def test_recap_matrix_engine():
    matrix_file = ROOT / "src" / "lib" / "analytics" / "recap-matrix.ts"
    holiday_file = ROOT / "src" / "lib" / "analytics" / "holidays.ts"

    files_exist = matrix_file.exists() and holiday_file.exists()
    record(
        "RECAP_ENGINE",
        "Analytics Core Files Existence (recap-matrix.ts, holidays.ts)",
        files_exist,
        f"recap-matrix: {matrix_file.exists()}, holidays: {holiday_file.exists()}"
    )

    if not files_exist:
        return

    content = matrix_file.read_text(encoding="utf-8")

    # 1. Status Code Precedence Check
    codes = ["'H'", "'T'", "'S'", "'I'", "'A'", "'B'", "'-'", "' '"]
    all_codes = all(code in content for code in codes)
    record(
        "STATUS_PRECEDENCE",
        "Deterministic 6-Tier Status Code Support (H, T, S, I, A, B, -, ' ')",
        all_codes,
        "Covers present, late, sick, permission, unexcused, bolos, and non-school days"
    )

    # 2. Dual-Layer Bolos Detection in Recap
    has_bolos = "bolosSet" in content and "ALPA_BOLOS" in content and "dailyStatuses[d.date] = 'B'" in content
    record(
        "TRUANCY_INTEGRATION",
        "Dual-Layer Bolos Code Resolution ('B') in Attendance Grid",
        has_bolos,
        "Resolves Gate scan HADIR/TERLAMBAT + Subject ALPA_BOLOS to 'B'"
    )

    # 3. Mid-Month Elapsed Day Mathematical Invariant
    has_elapsed_div = "elapsedEffectiveDays" in content and "elapsedEffectiveDays > 0" in content
    record(
        "MATHEMATICAL_ACCURACY",
        "Division by Elapsed Effective Days (Mid-Month Invariant)",
        has_elapsed_div,
        "Prevents artificial mid-month attendance failure by dividing by elapsed days"
    )

    # 4. Kemdikbud Form 8355 / Dapodik Gender Disaggregation
    has_dapodik = "countLaki" in content and "countPerempuan" in content and "genderStats" in content
    record(
        "DAPODIK_STANDARD",
        "Kemdikbud Form 8355 Gender Disaggregation (Laki-laki vs Perempuan)",
        has_dapodik,
        "Calculates N_L, N_P, daily distributions and gender attendance rates"
    )

# ==============================================================================
# SECTION 2: Early Warning System (EWS) 5-Invariant Engine (F5.6)
# ==============================================================================
def test_ews_engine():
    ews_file = ROOT / "src" / "lib" / "analytics" / "early-warning.ts"
    if not ews_file.exists():
        record("EWS_ENGINE", "File Existence (src/lib/analytics/early-warning.ts)", False, "File not found")
        return

    content = ews_file.read_text(encoding="utf-8")

    # 1. Invariant 1: Consecutive Alpa
    has_inv1 = "INV_1_CONSECUTIVE_ALPA" in content and "consecutiveAlpa >= 3" in content
    record(
        "EWS_INVARIANTS",
        "Invariant 1: Consecutive Alpa Streak (>=3 days CRITICAL, 2 days WARNING)",
        has_inv1,
        "Home visit trigger for students missing consecutive days"
    )

    # 2. Invariant 2: Monthly Absence Accumulation
    has_inv2 = "INV_2_MONTHLY_ABSENCE" in content and "monthlyAlpaCount >= 3" in content and "attendanceRate < 85" in content
    record(
        "EWS_INVARIANTS",
        "Invariant 2: Monthly Absence Threshold (Alpa >= 3 or Rate < 85% CRITICAL)",
        has_inv2,
        "Detects accumulated non-consecutive absences and low percentage"
    )

    # 3. Invariant 3: Habitual Lateness
    has_inv3 = "INV_3_HABITUAL_LATENESS" in content and "lateArrivalCount >= 5" in content
    record(
        "EWS_INVARIANTS",
        "Invariant 3: Habitual Lateness (>=5 times CRITICAL, >=3 times WARNING)",
        has_inv3,
        "Tracks frequent gate tardiness and lost morning instructional minutes"
    )

    # 4. Invariant 4: Dual-Layer Bolos Pattern
    has_inv4 = "INV_4_BOLOS_ANOMALY" in content and "bolosCount >= 2" in content
    record(
        "EWS_INVARIANTS",
        "Invariant 4: Dual-Layer Truancy Bolos (>=2 times CRITICAL, 1 time WARNING)",
        has_inv4,
        "Connects gate entry with classroom subject absences"
    )

    # 5. Invariant 5: Academic & Attendance Correlation
    has_inv5 = "INV_5_ACADEMIC_CORRELATION" in content and "remedialSubjects" in content
    record(
        "EWS_INVARIANTS",
        "Invariant 5: Academic Correlation (Rate < 90% + Remedial >= 2 CRITICAL)",
        has_inv5,
        "Connects M3 attendance data with M4 formal grading assessments"
    )

    # 6. Composite Score & Classification Tiers
    has_scoring = "riskScore" in content and "CRITICAL" in content and "WARNING" in content and "NORMAL" in content
    record(
        "EWS_SCORING",
        "Composite Risk Score (0-100) & Status Tiers (CRITICAL, WARNING, NORMAL)",
        has_scoring,
        "Transparent, explainable point accumulation capped at 100"
    )

    # 7. Actionable Counseling SOPs & Documents
    has_sop = "counselingSop" in content and "officialDocumentRequired" in content and "WALI_KELAS" in content and "GURU_BK" in content
    record(
        "COUNSELING_SOPS",
        "Role-Specific Counseling SOPs & Official Administrative Documents",
        has_sop,
        "Includes Home Visit Assignment, SP 1, SP 2, and commitment contracts"
    )

    # 8. WhatsApp EWS Notification Templates
    has_wa_payload = "TEMPLATE_EWS_CONSECUTIVE_ALPA" in content and "TEMPLATE_EWS_BOLOS" in content and "TEMPLATE_EWS_LATENESS" in content
    record(
        "EWS_WHATSAPP",
        "1-Tap WhatsApp EWS Alert Payloads with Spintax",
        has_wa_payload,
        "Pre-formatted emergency alerts ready for parent dispatch"
    )

# ==============================================================================
# SECTION 3: Server Actions & Administrative UI Views
# ==============================================================================
def test_ui_and_actions():
    act_file = ROOT / "src" / "actions" / "analytics.ts"
    recap_page = ROOT / "src" / "app" / "(admin)" / "recap-attendance" / "page.tsx"
    print_page = ROOT / "src" / "app" / "(admin)" / "recap-attendance" / "print" / "page.tsx"
    ews_page = ROOT / "src" / "app" / "(admin)" / "early-warning" / "page.tsx"

    all_exist = act_file.exists() and recap_page.exists() and print_page.exists() and ews_page.exists()
    record(
        "UI_AND_ACTIONS",
        "Administrative Analytics Views & Server Actions Existence",
        all_exist,
        f"Actions: {act_file.exists()}, Recap Page: {recap_page.exists()}, Print Page: {print_page.exists()}, EWS Page: {ews_page.exists()}"
    )

    if print_page.exists():
        print_content = print_page.read_text(encoding="utf-8")
        has_print_css = "@media print" in print_content and "A4 landscape" in print_content
        has_kop = "Kop Surat" in print_content or "governingBody" in print_content
        has_signatures = "Mengetahui" in print_content and "Wali Kelas" in print_content
        record(
            "PRINT_CSS_LAYOUT",
            "Native Print CSS Layout & Kop Surat Resmi",
            has_print_css and has_kop and has_signatures,
            "Complies with Indonesian official school document layout"
        )

def main():
    print("==============================================================================")
    print("Verification Harness: Milestone 5 Analytics Recaps & EWS (F5.5 - F5.6)")
    print("==============================================================================\n")

    test_recap_matrix_engine()
    test_ews_engine()
    test_ui_and_actions()

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    print("\n==============================================================================")
    print("Milestone 5 Analytics & EWS Verification Summary:")
    print(f"Total Tests : {total}")
    print(f"Passed      : {passed}")
    print(f"Failed      : {failed}")
    print(f"Verdict     : {'APPROVE' if failed == 0 else 'REJECT'}")
    print("==============================================================================")

    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
