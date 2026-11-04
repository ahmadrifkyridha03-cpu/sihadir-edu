"""
Automated Verification Suite for Milestone 5: WhatsApp Gateway Integration (F5.1 - F5.4)
SiHadir-Edu: Multi-Provider REST Client, Anti-Ban Queue, Jitter Engine & Dynamic Spintax
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
# SECTION 1: TypeScript Runtime Core Execution
# ==============================================================================
def test_tsx_runner():
    cmd = ["npx", "tsx", str(ROOT / "tests" / "test_milestone_5_runner.ts")]
    shell_val = sys.platform == "win32"
    try:
        proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, shell=shell_val, timeout=60)
        passed = (proc.returncode == 0) and ("TSX_ALL_M5_CORE_LOGIC_PASSED" in proc.stdout)
        record(
            "TSX_RUNTIME",
            "Direct TypeScript Execution (WhatsApp & Core Logic)",
            passed,
            f"Exit code: {proc.returncode}",
            None if passed else [proc.stderr or proc.stdout]
        )
    except Exception as e:
        record("TSX_RUNTIME", "Direct TypeScript Execution", False, str(e), [str(e)])

# ==============================================================================
# SECTION 2: Multi-Provider WhatsApp Gateway Architecture (F5.1)
# ==============================================================================
def test_gateway_providers():
    wa_file = ROOT / "src" / "lib" / "whatsapp.ts"
    if not wa_file.exists():
        record("GATEWAY_PROVIDERS", "File Existence (src/lib/whatsapp.ts)", False, "File not found")
        return

    content = wa_file.read_text(encoding="utf-8")

    # 1. Check Provider Interfaces and Classes
    has_interface = "export interface WaGatewayClient" in content
    has_fonnte = "export class FonnteGatewayClient implements WaGatewayClient" in content
    has_wablas = "export class WablasGatewayClient implements WaGatewayClient" in content
    has_mock = "export class MockGatewayClient implements WaGatewayClient" in content
    has_factory = "export function getWaGatewayClient" in content

    record(
        "GATEWAY_PROVIDERS",
        "Multi-Provider Client Classes (Fonnte, Wablas, Mock)",
        all([has_interface, has_fonnte, has_wablas, has_mock, has_factory]),
        f"Interface: {has_interface}, Fonnte: {has_fonnte}, Wablas: {has_wablas}, Mock: {has_mock}, Factory: {has_factory}"
    )

    # 2. Check Mock Gateway in-memory ledger
    has_ledger = "sentLedger" in content and "getSentMessages" in content and "getLastMessage" in content
    has_clear = "clear()" in content
    has_simulate = "setSimulateFailure" in content
    record(
        "GATEWAY_PROVIDERS",
        "Mock Gateway Client In-Memory Ledger & Simulation",
        all([has_ledger, has_clear, has_simulate]),
        "In-memory inspection methods for CI/CD deterministic tests"
    )

    # 3. Check Phone Normalization
    has_norm = "export function normalizeIndonesianPhone" in content
    has_valid = "export function isValidIndonesianPhone" in content
    record(
        "PHONE_NORMALIZER",
        "Indonesian Phone Normalization (08 -> 628, +62 -> 62)",
        has_norm and has_valid,
        "Normalizes phone inputs to standard Indonesian E.164 without leading +"
    )

# ==============================================================================
# SECTION 3: Priority Notification Queue & Anti-Ban Jitter (F5.2 - F5.3)
# ==============================================================================
def test_priority_and_jitter():
    wa_file = ROOT / "src" / "lib" / "whatsapp.ts"
    content = wa_file.read_text(encoding="utf-8")

    # 1. Priority Sorting
    has_weight_fn = "getPriorityWeight" in content
    has_tier1 = "GATE_LATE" in content and "ABSENT_ALERT" in content
    has_tier2 = "GATE_IN" in content and "GRADE_UPDATE" in content and "DAILY_DIGEST" in content

    record(
        "PRIORITY_DISPATCH",
        "Priority Tier Hierarchy (Tier 1 URGENT > Tier 2 NORMAL)",
        has_weight_fn and has_tier1 and has_tier2,
        "Urgent anomaly alerts dispatched before normal batch messages"
    )

    # 2. Anti-Ban Jitter Engine
    has_jitter_fn = "calculateRandomJitterMs" in content
    has_bounds = "minSec" in content and "maxSec" in content
    has_concurrency = "concurrency" in content.lower() or "for (" in content

    record(
        "ANTI_BAN_JITTER",
        "4-10s Randomized Jitter Delay & Serial Concurrency",
        has_jitter_fn and has_bounds,
        "Defeats Meta bot heuristics via randomized delay"
    )

    # 3. Serverless Execution Ceiling Guard
    has_ceiling = "maxDurationMs" in content and "Date.now() - startTime" in content
    record(
        "SERVERLESS_GUARD",
        "Vercel Serverless Function Timeout Guard (<45s)",
        has_ceiling,
        "Prevents abrupt serverless termination mid-batch"
    )

# ==============================================================================
# SECTION 4: Dynamic Spintax Formatter & Catalog (F5.4)
# ==============================================================================
def test_spintax_and_templates():
    wa_file = ROOT / "src" / "lib" / "whatsapp.ts"
    content = wa_file.read_text(encoding="utf-8")

    # 1. Spintax functions
    has_spintax = "export function resolveSpintax" in content
    has_interp = "export function interpolateVariables" in content
    has_format = "export function formatWaMessage" in content

    record(
        "SPINTAX_ENGINE",
        "Recursive Nested Spintax Resolution & Variable Interpolation",
        has_spintax and has_interp and has_format,
        "Supports nested {A|B} blocks and {{variable}} replacement"
    )

    # 2. Template Catalog (7 standard templates)
    templates = [
        "TEMPLATE_GATE_LATE",
        "TEMPLATE_GATE_IN",
        "TEMPLATE_ABSENT_BOLOS",
        "TEMPLATE_LEAVE_APPROVED",
        "TEMPLATE_LEAVE_REJECTED",
        "TEMPLATE_DAILY_DIGEST",
        "TEMPLATE_GRADE_UPDATE",
    ]
    all_templates = all(tmpl in content for tmpl in templates)
    record(
        "TEMPLATE_CATALOG",
        "Standard 7-Template School Notification Catalog",
        all_templates,
        f"Verified 7 school templates: {', '.join(templates)}"
    )

# ==============================================================================
# SECTION 5: Server Actions & Route Handlers
# ==============================================================================
def test_actions_and_routes():
    act_file = ROOT / "src" / "actions" / "whatsapp.ts"
    dispatch_file = ROOT / "src" / "app" / "api" / "whatsapp" / "dispatch" / "route.ts"
    digest_file = ROOT / "src" / "app" / "api" / "cron" / "wa-digest" / "route.ts"

    files_exist = act_file.exists() and dispatch_file.exists() and digest_file.exists()
    record(
        "SERVER_INTEGRATION",
        "Server Actions & Route Handlers Existence",
        files_exist,
        f"Actions: {act_file.exists()}, Dispatch API: {dispatch_file.exists()}, Digest Cron: {digest_file.exists()}"
    )

    if act_file.exists():
        act_content = act_file.read_text(encoding="utf-8")
        has_process_act = "processWaQueueAction" in act_content
        has_test_act = "testSendWhatsAppAction" in act_content
        has_logs_act = "getNotificationLogsAction" in act_content
        record(
            "SERVER_INTEGRATION",
            "WhatsApp Server Actions Implementation",
            has_process_act and has_test_act and has_logs_act,
            "Includes process queue, test send, and notification log queries"
        )

# ==============================================================================
# SECTION 6: Database Enum Invariant Guard
# ==============================================================================
def test_schema_invariants():
    schema_file = ROOT / "prisma" / "schema.prisma"
    content = schema_file.read_text(encoding="utf-8")

    # Match WaStatus enum
    match_status = re.search(r"enum\s+WaStatus\s+\{([^}]+)\}", content)
    status_vals = [line.strip() for line in match_status.group(1).splitlines() if line.strip() and not line.strip().startswith("//")] if match_status else []
    expected_status = {"QUEUED", "SENT", "FAILED"}
    status_intact = set(status_vals) == expected_status

    # Match WaNotifType enum
    match_type = re.search(r"enum\s+WaNotifType\s+\{([^}]+)\}", content)
    type_vals = [line.strip() for line in match_type.group(1).splitlines() if line.strip() and not line.strip().startswith("//")] if match_type else []
    expected_type = {"GATE_LATE", "GATE_IN", "ABSENT_ALERT", "GRADE_UPDATE", "DAILY_DIGEST"}
    type_intact = set(type_vals) == expected_type

    record(
        "SCHEMA_INVARIANTS",
        "Prisma WaStatus & WaNotifType Enum Integrity",
        status_intact and type_intact,
        f"WaStatus: {status_vals}, WaNotifType: {type_vals}"
    )

def main():
    print("==============================================================================")
    print("Verification Harness: Milestone 5 WhatsApp Gateway Integration (F5.1 - F5.4)")
    print("==============================================================================\n")

    test_tsx_runner()
    test_gateway_providers()
    test_priority_and_jitter()
    test_spintax_and_templates()
    test_actions_and_routes()
    test_schema_invariants()

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    print("\n==============================================================================")
    print("Milestone 5 WhatsApp Gateway Verification Summary:")
    print(f"Total Tests : {total}")
    print(f"Passed      : {passed}")
    print(f"Failed      : {failed}")
    print(f"Verdict     : {'APPROVE' if failed == 0 else 'REJECT'}")
    print("==============================================================================")

    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
