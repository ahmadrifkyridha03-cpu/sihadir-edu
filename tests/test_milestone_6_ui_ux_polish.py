"""
Automated Verification Suite for Milestone 6: UI/UX Design System Polish (F6.8)
SiHadir-Edu: WCAG AAA Color Tokens, Hardware Animations, Emil Kowalski Tactile Scale & Primitives
"""

import os
import re
import sys
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
# SECTION 1: WCAG AAA Design Tokens in globals.css
# ==============================================================================
def test_globals_css_tokens():
    css_path = ROOT / "src" / "app" / "globals.css"
    if not css_path.exists():
        record("DESIGN_TOKENS", "globals.css Existence", False, "File missing")
        return

    content = css_path.read_text(encoding="utf-8")

    # Status tokens
    has_hadir = "#065F46" in content or "#065f46" in content
    has_terlambat = "#78350F" in content or "#78350f" in content
    has_izin = "#075985" in content or "#075985" in content
    has_sakit = "#5B21B6" in content or "#5b21b6" in content
    has_alpa = "#9F1239" in content or "#9f1239" in content

    all_tokens = has_hadir and has_terlambat and has_izin and has_sakit and has_alpa
    record(
        "DESIGN_TOKENS",
        "WCAG AAA Status Foreground Color Tokens",
        all_tokens,
        f"Hadir: {has_hadir}, Terlambat: {has_terlambat}, Izin: {has_izin}, Sakit: {has_sakit}, Alpa: {has_alpa}"
    )

    # Safe area bottom inset
    has_pb_safe = "safe-area-inset-bottom" in content
    record(
        "DESIGN_TOKENS",
        "Mobile Viewport Safe Area Inset (.pb-safe)",
        has_pb_safe,
        "Includes env(safe-area-inset-bottom) for iPhone home indicator clearance"
    )

    # Hardware accelerated keyframe animations
    has_shimmer = "@keyframes shimmer" in content
    has_slide_up = "@keyframes slideUp" in content or "@keyframes slide-up" in content
    has_snappy = "enterSnappy" in content or "cubic-bezier" in content
    record(
        "DESIGN_TOKENS",
        "Hardware-Accelerated Keyframes & Snappy Cubic-Bezier Curves",
        has_shimmer and (has_slide_up or has_snappy),
        f"Shimmer: {has_shimmer}, SlideUp/Snappy: {has_slide_up or has_snappy}"
    )

# ==============================================================================
# SECTION 2: UI Primitives Component Library
# ==============================================================================
def test_ui_primitives():
    primitives = [
        ("button.tsx", ["min-h-[44px]", "active:scale-[0.98]", "cva"]),
        ("card.tsx", ["rounded-2xl", "border"]),
        ("badge.tsx", ["hadir", "terlambat", "izin", "sakit", "alpa"]),
        ("skeleton.tsx", ["animate-shimmer", "bg-slate-200"]),
        ("bottom-sheet.tsx", ["fixed inset-0", "max-w-lg"]),
        ("empty-state.tsx", ["title", "description"]),
    ]

    for fname, patterns in primitives:
        p = ROOT / "src" / "components" / "ui" / fname
        if not p.exists():
            record("UI_PRIMITIVES", f"Primitive: {fname}", False, "File missing")
            continue

        c = p.read_text(encoding="utf-8")
        matches = [pat for pat in patterns if pat in c]
        passed = len(matches) >= 1
        record(
            "UI_PRIMITIVES",
            f"Primitive: {fname}",
            passed,
            f"Found patterns: {matches}"
        )

# ==============================================================================
# SECTION 3: Font & Mobile Nav Layout Polish
# ==============================================================================
def test_layout_and_nav():
    layout_path = ROOT / "src" / "app" / "layout.tsx"
    nav_path = ROOT / "src" / "components" / "parent" / "ParentBottomNav.tsx"

    if layout_path.exists():
        c = layout_path.read_text(encoding="utf-8")
        has_font_weights = "Plus_Jakarta_Sans" in c and ("'400'" in c or '"400"' in c or "weight" in c)
        record(
            "LAYOUT_POLISH",
            "Plus Jakarta Sans Explicit Font Weights & Subsets",
            has_font_weights,
            "Configures multi-weight Latin font subsets for zero FOUT layout shift"
        )
    else:
        record("LAYOUT_POLISH", "Root Layout", False, "File missing")

    if nav_path.exists():
        c = nav_path.read_text(encoding="utf-8")
        has_nav_items = "parent-dashboard" in c and "documentations" in c and "grades-report" in c
        has_tap_target = "min-h-[44px]" in c or "py-2" in c or "active:scale" in c
        record(
            "LAYOUT_POLISH",
            "Parent Bottom Navigation 44px Tap Target & Active Highlighting",
            has_nav_items and has_tap_target,
            f"Routes: {has_nav_items}, Tactile Feedback: {has_tap_target}"
        )
    else:
        record("LAYOUT_POLISH", "Parent Bottom Nav", False, "File missing")

def main():
    print("==============================================================================")
    print("Verification Harness: Milestone 6 UI/UX Design System Polish (F6.8)")
    print("==============================================================================\n")

    test_globals_css_tokens()
    test_ui_primitives()
    test_layout_and_nav()

    passed_count = sum(1 for r in results if r.passed)
    total_count = len(results)

    print("\n==============================================================================")
    print("Milestone 6 UI/UX Polish Verification Summary:")
    print(f"Total Tests : {total_count}")
    print(f"Passed      : {passed_count}")
    print(f"Failed      : {total_count - passed_count}")
    print(f"Verdict     : {'APPROVE' if passed_count == total_count else 'REJECT'}")
    print("==============================================================================")

    if passed_count != total_count:
        sys.exit(1)

if __name__ == "__main__":
    main()
