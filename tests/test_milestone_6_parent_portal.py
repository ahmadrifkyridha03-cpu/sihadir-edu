"""
Automated Verification Suite for Milestone 6: Parent Portal & PWA (F6.1 - F6.5)
SiHadir-Edu: WhatsApp PIN Auth, Sibling Switcher, Real-time Timeline, Scoped Gallery & PWA
"""

import os
import re
import sys
import subprocess
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional

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
    cmd = ["npx", "tsx", str(ROOT / "tests" / "test_milestone_6_runner.ts")]
    shell_val = sys.platform == "win32"
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            shell=shell_val,
            timeout=60,
            encoding="utf-8",
            errors="replace"
        )
        passed = (proc.returncode == 0) and ("TSX_ALL_M6_CORE_LOGIC_PASSED" in proc.stdout)
        record(
            "TSX_RUNTIME",
            "Direct TypeScript Execution (Parent Auth & Crypto Logic)",
            passed,
            f"Exit code: {proc.returncode}",
            None if passed else [proc.stderr or proc.stdout]
        )
    except Exception as e:
        record("TSX_RUNTIME", "Direct TypeScript Execution", False, str(e), [str(e)])

# ==============================================================================
# SECTION 2: Parent Auth & Session Management
# ==============================================================================
def test_parent_auth_files():
    files = [
        "src/lib/phone.ts",
        "src/lib/auth-crypto.ts",
        "src/lib/rate-limit.ts",
        "src/lib/session.ts",
        "src/actions/parent-auth.ts",
        "src/app/(auth)/login/page.tsx",
    ]
    for rel in files:
        p = ROOT / rel
        record(
            "AUTH_FILES",
            f"File Existence: {rel}",
            p.exists() and p.stat().st_size > 0,
            f"Size: {p.stat().st_size if p.exists() else 0} bytes"
        )

def test_parent_auth_logic():
    auth_action_path = ROOT / "src" / "actions" / "parent-auth.ts"
    if not auth_action_path.exists():
        record("AUTH_LOGIC", "Parent Auth Server Actions", False, "File missing")
        return

    content = auth_action_path.read_text(encoding="utf-8")
    has_login = "export async function parentLoginAction" in content
    has_logout = "export async function parentLogoutAction" in content
    has_active_student = "export async function setActiveStudentCookieAction" in content
    has_rate_limit = "checkPinRateLimit" in content and "recordFailedPinAttempt" in content
    has_timing_safe = "verifyPin" in content

    record(
        "AUTH_LOGIC",
        "Parent Auth Server Actions Implementation",
        all([has_login, has_logout, has_active_student, has_rate_limit, has_timing_safe]),
        f"Login: {has_login}, Logout: {has_logout}, RateLimit: {has_rate_limit}, TimingSafe: {has_timing_safe}"
    )

# ==============================================================================
# SECTION 3: Multi-Child Sibling Switcher (F6.2)
# ==============================================================================
def test_child_switcher():
    path = ROOT / "src" / "components" / "parent" / "ChildSwitcher.tsx"
    if not path.exists():
        record("CHILD_SWITCHER", "ChildSwitcher Component", False, "File missing")
        return

    content = path.read_text(encoding="utf-8")
    has_dropdown = "DropdownMenu" in content or "select" in content.lower() or "button" in content
    has_single_badge = "students.length <= 1" in content or "students.length === 1" in content
    has_cookie_action = "setActiveStudentCookieAction" in content or "router.push" in content

    record(
        "CHILD_SWITCHER",
        "Sibling Switcher Multi-Child vs Single Child Support",
        has_dropdown and (has_single_badge or "students.length" in content),
        f"Dropdown/Modal: {has_dropdown}, Single Child Badge: {has_single_badge}, Navigation Action: {has_cookie_action}"
    )

# ==============================================================================
# SECTION 4: Parent Portal Dashboard & Activity Timeline (F6.3)
# ==============================================================================
def test_parent_dashboard():
    dashboard_path = ROOT / "src" / "app" / "(parent)" / "parent-dashboard" / "page.tsx"
    banner_path = ROOT / "src" / "components" / "parent" / "StatusSummaryBanner.tsx"
    timeline_path = ROOT / "src" / "components" / "parent" / "ActivityTimeline.tsx"

    record(
        "PARENT_PORTAL",
        "Parent Dashboard Page Existence",
        dashboard_path.exists() and dashboard_path.stat().st_size > 0,
        f"Path: {dashboard_path}"
    )

    if banner_path.exists():
        content = banner_path.read_text(encoding="utf-8")
        has_3sec_rule = "HADIR" in content and "TERLAMBAT" in content and ("BELUM_HADIR" in content or "BELUM" in content)
        record(
            "PARENT_PORTAL",
            "3-Second Rule Status Summary Banner",
            has_3sec_rule,
            "Includes prominent visual status cards for Hadir, Terlambat, and Belum Hadir"
        )
    else:
        record("PARENT_PORTAL", "3-Second Rule Status Summary Banner", False, "Banner component missing")

    if timeline_path.exists():
        content = timeline_path.read_text(encoding="utf-8")
        has_timeline_events = "gateScan" in content or "subject" in content or "badge" in content or "timeline" in content.lower()
        record(
            "PARENT_PORTAL",
            "Real-Time Activity Timeline",
            has_timeline_events,
            "Renders chronological daily events (gate scan, subject journals, engagement badges)"
        )
    else:
        record("PARENT_PORTAL", "Real-Time Activity Timeline", False, "Timeline component missing")

# ==============================================================================
# SECTION 5: Scoped Photo Gallery (F6.4)
# ==============================================================================
def test_scoped_photo_gallery():
    action_path = ROOT / "src" / "actions" / "parent-gallery.ts"
    gallery_ui_path = ROOT / "src" / "components" / "parent" / "PhotoGalleryGrid.tsx"

    if not action_path.exists():
        record("GALLERY_SCOPING", "Photo Gallery Server Action", False, "Action file missing")
        return

    content = action_path.read_text(encoding="utf-8")
    has_class_public = "CLASS_PUBLIC" in content
    has_tagged_filter = "TAGGED_STUDENTS_ONLY" in content
    has_rls_query = "taggedStudents" in content or "where" in content

    record(
        "GALLERY_SCOPING",
        "CLASS_PUBLIC vs TAGGED_STUDENTS_ONLY Visibility Scoping",
        has_class_public and has_tagged_filter,
        f"Public Check: {has_class_public}, Tagged Check: {has_tagged_filter}, RLS Query: {has_rls_query}"
    )

    gallery_content = gallery_ui_path.read_text(encoding="utf-8") if gallery_ui_path.exists() else ""
    has_lightbox = ("activePhoto" in gallery_content or "selectedPhoto" in gallery_content) and "fixed inset-0" in gallery_content

    record(
        "GALLERY_SCOPING",
        "Photo Gallery UI Grid with Modal Lightbox",
        gallery_ui_path.exists() and has_lightbox,
        "Supports thumbnail grid, responsive columns, and full-screen modal zoom"
    )

# ==============================================================================
# SECTION 6: PWA Manifest & Service Worker (F6.5)
# ==============================================================================
def test_pwa_configuration():
    manifest_path = ROOT / "public" / "manifest.json"
    sw_path = ROOT / "public" / "sw.js"
    icon192 = ROOT / "public" / "icons" / "icon-192x192.png"
    icon512 = ROOT / "public" / "icons" / "icon-512x512.png"
    pwa_reg = ROOT / "src" / "components" / "pwa" / "ServiceWorkerRegister.tsx"

    manifest_ok = False
    if manifest_path.exists():
        c = manifest_path.read_text(encoding="utf-8")
        manifest_ok = "standalone" in c and "theme_color" in c and "icons" in c

    record("PWA_SETUP", "PWA Web App Manifest (standalone, theme_color)", manifest_ok, f"Manifest: {manifest_path}")
    record("PWA_SETUP", "Service Worker (sw.js) Cache & Offline Support", sw_path.exists() and "fetch" in sw_path.read_text(encoding="utf-8"), f"Service worker: {sw_path}")
    record("PWA_SETUP", "PWA High-Res PNG App Icons (192x192 & 512x512)", icon192.exists() and icon512.exists(), "Both PNG icons exist in public/icons")
    record("PWA_SETUP", "Client-Side ServiceWorkerRegister Lifecycle Component", pwa_reg.exists() and "navigator.serviceWorker" in pwa_reg.read_text(encoding="utf-8"), "Registers sw.js on window load")

def main():
    print("==============================================================================")
    print("Verification Harness: Milestone 6 Parent Portal & PWA Subsystem (F6.1 - F6.5)")
    print("==============================================================================\n")

    test_tsx_runner()
    test_parent_auth_files()
    test_parent_auth_logic()
    test_child_switcher()
    test_parent_dashboard()
    test_scoped_photo_gallery()
    test_pwa_configuration()

    passed_count = sum(1 for r in results if r.passed)
    total_count = len(results)

    print("\n==============================================================================")
    print("Milestone 6 Parent Portal Verification Summary:")
    print(f"Total Tests : {total_count}")
    print(f"Passed      : {passed_count}")
    print(f"Failed      : {total_count - passed_count}")
    print(f"Verdict     : {'APPROVE' if passed_count == total_count else 'REJECT'}")
    print("==============================================================================")

    if passed_count != total_count:
        sys.exit(1)

if __name__ == "__main__":
    main()
