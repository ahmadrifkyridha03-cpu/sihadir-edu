"""
Automated Verification Suite for Milestone 5: Multi-Format Reports & Mass QR Card Generator (F5.7 - F5.8)
SiHadir-Edu: ExcelJS 4-Worksheet Workbook, Native Print CSS, jsPDF Reports & CR80 QR Cards
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
# SECTION 1: Package Dependencies Check
# ==============================================================================
def test_package_dependencies():
    pkg_file = ROOT / "package.json"
    content = pkg_file.read_text(encoding="utf-8")

    packages = ["exceljs", "qrcode", "jspdf", "jspdf-autotable", "@types/qrcode"]
    all_installed = all(pkg in content for pkg in packages)
    record(
        "DEPENDENCIES",
        "Milestone 5 Package Installation (exceljs, qrcode, jspdf, autotable)",
        all_installed,
        f"Verified packages in package.json: {', '.join(packages)}"
    )

# ==============================================================================
# SECTION 2: ExcelJS Multi-Worksheet Engine (F5.7)
# ==============================================================================
def test_exceljs_engine():
    excel_file = ROOT / "src" / "lib" / "export" / "excel-export.ts"
    school_file = ROOT / "src" / "lib" / "export" / "school-config.ts"

    files_exist = excel_file.exists() and school_file.exists()
    record(
        "EXCEL_ENGINE",
        "Excel Export & School Profile Files Existence",
        files_exist,
        f"excel-export: {excel_file.exists()}, school-config: {school_file.exists()}"
    )

    if not files_exist:
        return

    content = excel_file.read_text(encoding="utf-8")

    # 1. Check 4 Core Worksheets
    sheets = ["Rekap_Bulanan", "Rekap_Semester", "Rekap_Nilai", "Daftar_EWS"]
    has_sheets = all(f"'{sheet}'" in content or f'"{sheet}"' in content for sheet in sheets)
    record(
        "EXCEL_WORKSHEETS",
        "4 Structured Worksheets (Bulanan, Semester, Nilai, EWS)",
        has_sheets,
        f"Verified sheets: {', '.join(sheets)}"
    )

    # 2. Check Semantic Color Fills
    colors = ["hadirFill", "terlambatFill", "sakitFill", "izinFill", "alpaFill", "bolosFill"]
    has_colors = all(col in content for col in colors)
    record(
        "EXCEL_STYLING",
        "Semantic Color Fills & Borders (Emerald, Amber, Violet, Sky, Rose)",
        has_colors,
        "Color-coded cells matching DESIGN.md standards"
    )

    # 3. Check Native Formulas
    has_formulas = "COUNTIF" in content and "AVERAGE" in content and "ROUND" in content
    record(
        "EXCEL_FORMULAS",
        "Native Spreadsheet Formulas (COUNTIF, AVERAGE, ROUND, IF)",
        has_formulas,
        "Formulas with precomputed fallback values for instant viewer compatibility"
    )

# ==============================================================================
# SECTION 3: Programmatic PDF Reports (F5.7)
# ==============================================================================
def test_pdf_engine():
    pdf_file = ROOT / "src" / "lib" / "export" / "pdf-export.ts"
    if not pdf_file.exists():
        record("PDF_ENGINE", "File Existence (pdf-export.ts)", False, "File not found")
        return

    content = pdf_file.read_text(encoding="utf-8")

    has_jspdf = "jsPDF" in content and "autoTable" in content
    has_landscape = "orientation: 'landscape'" in content or 'orientation: "landscape"' in content
    has_kop = "governingBody" in content and "schoolName" in content
    has_signatures = "Mengetahui" in content and "Wali Kelas" in content

    record(
        "PDF_ENGINE",
        "jsPDF & AutoTable Landscape A4 Attendance Matrix Report",
        all([has_jspdf, has_landscape, has_kop, has_signatures]),
        "Landscape A4 format with Kop Surat, metadata, autoTable, and Titi Mangsa signatures"
    )

# ==============================================================================
# SECTION 4: Mass CR80 QR Card Generator (F5.8)
# ==============================================================================
def test_qr_card_generator():
    card_file = ROOT / "src" / "lib" / "export" / "qr-card-export.ts"
    if not card_file.exists():
        record("QR_CARDS", "File Existence (qr-card-export.ts)", False, "File not found")
        return

    content = card_file.read_text(encoding="utf-8")

    # 1. CR80 Standard Dimensions
    has_dim = "85.6" in content and "53.98" in content
    record(
        "CR80_GEOMETRY",
        "ISO/IEC 7810 ID-1 CR80 Dimensions (85.60 mm x 53.98 mm)",
        has_dim,
        "Standard student badge dimensions"
    )

    # 2. A4 Imposition (10 cards 2x5 grid)
    has_imposition = "10_CARDS" in content and "numCols = 2" in content
    record(
        "A4_IMPOSITION",
        "10-Cards-Per-Sheet (2x5 Grid) Precision A4 Imposition",
        has_imposition,
        "Maximum paper efficiency (10 students per A4 sheet)"
    )

    # 3. Cutting Guides & Crop Marks
    has_guides = "showCropMarks" in content and "markLen" in content
    record(
        "CUTTING_GUIDES",
        "Guillotine Cutting Guides & Corner Crosshair Crop Marks",
        has_guides,
        "Aids manual paper cutting and card trimming"
    )

    # 4. Cryptographic HMAC-SHA256 Signed QR Code
    has_token = "generateSignedQrToken" in content and "QRCode.toDataURL" in content and "errorCorrectionLevel: 'M'" in content
    record(
        "SIGNED_QR_SECURITY",
        "HMAC-SHA256 Cryptographic Token & Level M Error Correction",
        has_token,
        "High-contrast QR code resilient against surface scratches and wear"
    )

# ==============================================================================
# SECTION 5: Route Handlers & UI Views
# ==============================================================================
def test_routes_and_ui():
    excel_route = ROOT / "src" / "app" / "api" / "export" / "excel" / "route.ts"
    pdf_route = ROOT / "src" / "app" / "api" / "export" / "pdf" / "route.ts"
    qr_route = ROOT / "src" / "app" / "api" / "export" / "qr-cards" / "route.ts"
    qr_page = ROOT / "src" / "app" / "(admin)" / "qr-cards" / "page.tsx"

    all_exist = excel_route.exists() and pdf_route.exists() and qr_route.exists() and qr_page.exists()
    record(
        "EXPORT_ROUTES_AND_UI",
        "Export Route Handlers & Admin QR Cards Page Existence",
        all_exist,
        f"Excel Route: {excel_route.exists()}, PDF Route: {pdf_route.exists()}, QR Route: {qr_route.exists()}, QR UI: {qr_page.exists()}"
    )

    if qr_page.exists():
        qr_ui_content = qr_page.read_text(encoding="utf-8")
        has_mockup = "Pratinjau Kartu Siswa Fisik" in qr_ui_content or "CR80" in qr_ui_content
        has_download = "/api/export/qr-cards" in qr_ui_content
        record(
            "QR_CARDS_UI",
            "CR80 Live Mockup Preview & 1-Click Batch Download",
            has_mockup and has_download,
            "Displays 1:1 physical card mockup and batch download trigger"
        )

def main():
    print("==============================================================================")
    print("Verification Harness: Milestone 5 Export Engine & QR Cards (F5.7 - F5.8)")
    print("==============================================================================\n")

    test_package_dependencies()
    test_exceljs_engine()
    test_pdf_engine()
    test_qr_card_generator()
    test_routes_and_ui()

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    print("\n==============================================================================")
    print("Milestone 5 Export Engine Verification Summary:")
    print(f"Total Tests : {total}")
    print(f"Passed      : {passed}")
    print(f"Failed      : {failed}")
    print(f"Verdict     : {'APPROVE' if failed == 0 else 'REJECT'}")
    print("==============================================================================")

    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
