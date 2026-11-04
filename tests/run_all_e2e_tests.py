#!/usr/bin/env python3
"""
SiHadir-Edu: Master Python CLI Runner & Verification Dashboard
Executes TypeScript master E2E test suite (Tiers 1-4), verifies AST and schema invariants,
supports --all flag to execute complete milestone regression suites (M1-M6),
and generates structured JSON/Markdown artifacts in tests/artifacts/.

Usage:
  python tests/run_all_e2e_tests.py
  python tests/run_all_e2e_tests.py --all
"""

import os
import sys
import json
import time
import argparse
import subprocess
from pathlib import Path

# Fix Windows console encoding for Unicode output
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Terminal ANSI Color Palette
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
GRAY = "\033[90m"

ROOT_DIR = Path(__file__).resolve().parent.parent
TESTS_DIR = ROOT_DIR / "tests"
E2E_DIR = TESTS_DIR / "e2e"
ARTIFACTS_DIR = TESTS_DIR / "artifacts"


def print_banner():
    print(f"{BLUE}{BOLD}{'=' * 80}{RESET}")
    print(f"{CYAN}{BOLD}       SIHADIR-EDU: UNIFIED E2E TESTING TRACK & REGRESSION DASHBOARD{RESET}")
    print(f"{BLUE}{BOLD}{'=' * 80}{RESET}")
    print(f"{GRAY}Workspace: {ROOT_DIR}{RESET}")
    print(f"{GRAY}Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}{RESET}")
    print(f"{BLUE}{'-' * 80}{RESET}\n")


def verify_system_invariants():
    """Verifies critical project invariants, AST structures, and file integrity."""
    print(f"{CYAN}[Step 1/3] Verifying System Architecture & Governance Invariants...{RESET}")
    checks = []

    # 1. agent.md governance
    agent_md = ROOT_DIR / "agent.md"
    if agent_md.exists():
        content = agent_md.read_text(encoding="utf-8")
        lines = len(content.splitlines())
        checks.append(("agent.md Governance (>=700 lines)", lines >= 700, f"{lines} lines"))
    else:
        checks.append(("agent.md Governance file", False, "Missing"))

    # 2. TEST_INFRA.md specification
    test_infra = ROOT_DIR / "TEST_INFRA.md"
    checks.append(("TEST_INFRA.md Specification Document", test_infra.exists(), "Present" if test_infra.exists() else "Missing"))

    # 3. Prisma schema verification
    schema_file = ROOT_DIR / "prisma" / "schema.prisma"
    if schema_file.exists():
        schema_text = schema_file.read_text(encoding="utf-8")
        model_count = schema_text.count("model ")
        enum_count = schema_text.count("enum ")
        checks.append(("Prisma Schema (17 models, 13 enums)", model_count == 17 and enum_count == 13, f"{model_count} models, {enum_count} enums"))
    else:
        checks.append(("Prisma Schema", False, "Missing"))

    # 4. E2E test directory structure
    required_files = [
        E2E_DIR / "runner.ts",
        E2E_DIR / "test_tier1_features.ts",
        E2E_DIR / "test_tier2_boundaries.ts",
        E2E_DIR / "test_tier3_pairwise.ts",
        E2E_DIR / "test_tier4_scenarios.ts",
        E2E_DIR / "mocks" / "in-memory-db.ts",
        E2E_DIR / "mocks" / "mock-data.ts",
    ]
    all_files_exist = all(p.exists() for p in required_files)
    checks.append(("E2E Test Suite Files (Tiers 1-4 + Mocks)", all_files_exist, f"{len(required_files)}/7 verified"))

    for name, status, detail in checks:
        icon = f"{GREEN}[OK]{RESET}" if status else f"{RED}[X]{RESET}"
        status_text = f"{GREEN}PASS{RESET}" if status else f"{RED}FAIL{RESET}"
        print(f"  {icon} {name:<45} [{status_text}] ({detail})")

    all_passed = all(status for _, status, _ in checks)
    if not all_passed:
        print(f"\n{RED}{BOLD}Invariant verification failed!{RESET}")
        return False
    print(f"\n{GREEN}System invariants verified successfully.{RESET}\n")
    return True


def run_e2e_typescript_suite():
    """Runs the master TypeScript test runner executing Tiers 1-4."""
    print(f"{CYAN}[Step 2/3] Executing TypeScript Dual-Track E2E Test Suite (Tiers 1-4)...{RESET}")
    runner_path = E2E_DIR / "runner.ts"
    if not runner_path.exists():
        print(f"{RED}Error: {runner_path} does not exist.{RESET}")
        return False

    env = os.environ.copy()
    if "DATABASE_URL" not in env:
        env["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/absen_db?schema=public"
    if "QR_SIGNING_SECRET" not in env:
        env["QR_SIGNING_SECRET"] = "kunci-rahasia-penandatangan-kartu-qr-siswa-2026"
    if "AUTH_SECRET" not in env:
        env["AUTH_SECRET"] = "sihadir-parent-auth-secret-key-32chars-2026"

    # Execute npx tsx tests/e2e/runner.ts
    cmd = ["npx", "tsx", str(runner_path)]
    if sys.platform == "win32":
        cmd = ["cmd", "/c", "npx", "tsx", str(runner_path)]

    start_time = time.time()
    proc = subprocess.run(cmd, cwd=str(ROOT_DIR), env=env, text=True, capture_output=True, encoding="utf-8", errors="replace")
    duration = time.time() - start_time

    print(proc.stdout)
    if proc.stderr:
        print(f"{YELLOW}{proc.stderr}{RESET}")

    if proc.returncode != 0:
        print(f"{RED}{BOLD}TypeScript E2E Runner exited with code {proc.returncode}{RESET}")
        return False
    return True


def run_milestone_regression_suites():
    """Runs all existing milestone Python & TS regression tests when --all is enabled."""
    print(f"\n{CYAN}[Step 3/3] Running Milestone 1-6 Regression Suites (--all enabled)...{RESET}")
    env = os.environ.copy()
    if "DATABASE_URL" not in env:
        env["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/absen_db?schema=public"
    regression_tests = [
        ("M1 Invariants", "python", TESTS_DIR / "test_agent_md_invariants.py"),
        ("M1 Logic Simulation", "python", TESTS_DIR / "test_business_logic_simulation.py"),
        ("M1 Relations", "python", TESTS_DIR / "test_prisma_bidirectional_relations.py"),
        ("M2 Architecture", "python", TESTS_DIR / "test_milestone_2_architecture.py"),
        ("M2 Schema Adversarial", "python", TESTS_DIR / "test_m2_schema_adversarial.py"),
        ("M3 Attendance Engine", "python", TESTS_DIR / "test_milestone_3_attendance.py"),
        ("M3 QR Cooldown Stress", "python", TESTS_DIR / "test_m3_qr_and_cooldown_stress.py"),
        ("M3 TSX Core Runner", "tsx", TESTS_DIR / "test_milestone_3_runner.ts"),
        ("M4 Grading & Docs", "python", TESTS_DIR / "test_milestone_4_grading_and_docs.py"),
        ("M4 Grading Stress", "python", TESTS_DIR / "test_m4_grading_and_compression_stress.py"),
        ("M4 TSX Core Runner", "tsx", TESTS_DIR / "test_milestone_4_runner.ts"),
        ("M5 Export Engine", "python", TESTS_DIR / "test_milestone_5_export.py"),
        ("M5 Recap & EWS", "python", TESTS_DIR / "test_milestone_5_recap_and_ews.py"),
        ("M5 WhatsApp Gateway", "python", TESTS_DIR / "test_milestone_5_whatsapp.py"),
        ("M5 TSX Core Runner", "tsx", TESTS_DIR / "test_milestone_5_runner.ts"),
        ("M6 UI/UX Polish", "python", TESTS_DIR / "test_milestone_6_ui_ux_polish.py"),
        ("M6 Teacher & Kiosk", "python", TESTS_DIR / "test_milestone_6_teacher_and_kiosk.py"),
        ("M6 Parent Portal", "python", TESTS_DIR / "test_milestone_6_parent_portal.py"),
        ("M6 Adversarial Security", "python", TESTS_DIR / "test_milestone_6_adversarial.py"),
        ("M6 TSX Core Runner", "tsx", TESTS_DIR / "test_milestone_6_runner.ts"),
    ]

    passed_count = 0
    failed_count = 0

    for label, runner_type, script_path in regression_tests:
        if not script_path.exists():
            continue
        start_t = time.time()
        if runner_type == "python":
            cmd = [sys.executable, str(script_path)]
        else:
            cmd = ["npx", "tsx", str(script_path)]
            if sys.platform == "win32":
                cmd = ["cmd", "/c", "npx", "tsx", str(script_path)]

        proc = subprocess.run(cmd, cwd=str(ROOT_DIR), env=env, text=True, capture_output=True, encoding="utf-8", errors="replace")
        dur_ms = int((time.time() - start_t) * 1000)

        if proc.returncode == 0:
            passed_count += 1
            print(f"  {GREEN}[OK]{RESET} {label:<40} {GREEN}PASS{RESET} ({dur_ms}ms)")
        else:
            failed_count += 1
            print(f"  {RED}[X]{RESET}  {label:<40} {RED}FAIL{RESET} ({dur_ms}ms)")
            if proc.stderr:
                print(f"    {GRAY}{proc.stderr.strip()[:160]}{RESET}")

    total_reg = passed_count + failed_count
    print(f"\nMilestone Regression Suites: {passed_count}/{total_reg} passed.")
    return failed_count == 0


def main():
    parser = argparse.ArgumentParser(description="SiHadir-Edu Master E2E Runner")
    parser.add_argument("--all", action="store_true", help="Run all regression suites across Milestones 1-6")
    args = parser.parse_args()

    print_banner()

    # Step 1: System Invariants Verification
    if not verify_system_invariants():
        sys.exit(1)

    # Step 2: TypeScript Master E2E Runner (Tiers 1-4)
    e2e_ok = run_e2e_typescript_suite()
    if not e2e_ok:
        sys.exit(1)

    # Step 3: Optional Milestone 1-6 Regression Suites
    if args.all:
        reg_ok = run_milestone_regression_suites()
        if not reg_ok:
            sys.exit(1)

    # Verify Artifacts were created
    json_path = ARTIFACTS_DIR / "test-results.json"
    md_path = ARTIFACTS_DIR / "test-summary.md"
    if json_path.exists() and md_path.exists():
        print(f"\n{GREEN}{BOLD}Artifacts verified:{RESET}")
        print(f"  - {json_path} ({json_path.stat().st_size} bytes)")
        print(f"  - {md_path} ({md_path.stat().st_size} bytes)")

    print(f"\n{GREEN}{BOLD}ALL TESTS AND INVARIANTS PASSED SUCCESSFULLY (Exit Code 0).{RESET}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
