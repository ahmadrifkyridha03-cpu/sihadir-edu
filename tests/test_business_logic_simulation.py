"""
Empirical Simulation and Stress Test for SiHadir-Edu Business Logic Invariants
Simulates:
1. Gate attendance time thresholds and late minute calculation
2. 5-minute cooldown idempotency
3. Bolos cross-layer anomaly detection
4. Two-tier grading and KKM mastery evaluation
5. Dynamic Spintax variability distribution
6. WebP size and dimension validation
"""

import sys
import datetime
import random
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def test_gate_attendance_rules():
    print("[TEST] 1. Gate Attendance Lateness Logic")
    gate_threshold = datetime.time(7, 15, 0)
    
    # Case A: On time (07:10 WIB)
    t1 = datetime.time(7, 10, 0)
    is_late_1 = t1 > gate_threshold
    assert not is_late_1, "07:10 should NOT be late"
    
    # Case B: Exactly at threshold (07:15 WIB)
    t2 = datetime.time(7, 15, 0)
    is_late_2 = t2 > gate_threshold
    assert not is_late_2, "07:15:00 should NOT be late (threshold inclusive)"
    
    # Case C: 1 second late (07:15:01 WIB)
    t3 = datetime.time(7, 15, 1)
    is_late_3 = t3 > gate_threshold
    assert is_late_3, "07:15:01 MUST be late"
    
    # Case D: Late by 25 minutes (07:40 WIB)
    t4 = datetime.time(7, 40, 0)
    late_minutes = (t4.hour * 60 + t4.minute) - (gate_threshold.hour * 60 + gate_threshold.minute)
    assert late_minutes == 25, f"Expected 25 minutes late, got {late_minutes}"
    print("   -> Lateness calculation validated correctly.")

def test_cooldown_logic():
    print("[TEST] 2. 5-Minute Cooldown Rate Limiting")
    scan_history = {} # student_id -> last_scan_timestamp
    
    student_id = "stu-12345"
    base_time = datetime.datetime(2026, 11, 4, 6, 50, 0)
    
    # First scan
    scan_history[student_id] = base_time
    
    # Duplicate scan at 6:52:00 (120s later -> should be rejected)
    scan_2 = base_time + datetime.timedelta(seconds=120)
    diff_2 = (scan_2 - scan_history[student_id]).total_seconds()
    rejected_2 = diff_2 < 300
    assert rejected_2, "Scan within 120s must be rejected"
    
    # Duplicate scan at 6:54:59 (299s later -> should be rejected)
    scan_3 = base_time + datetime.timedelta(seconds=299)
    diff_3 = (scan_3 - scan_history[student_id]).total_seconds()
    rejected_3 = diff_3 < 300
    assert rejected_3, "Scan within 299s must be rejected"
    
    # Allowed scan at 6:55:01 (301s later -> allowed)
    scan_4 = base_time + datetime.timedelta(seconds=301)
    diff_4 = (scan_4 - scan_history[student_id]).total_seconds()
    rejected_4 = diff_4 < 300
    assert not rejected_4, "Scan after 301s must be permitted"
    print("   -> Cooldown boundary (<300s vs >=300s) verified.")

def test_bolos_detection():
    print("[TEST] 3. Bolos Anomaly Detection Rule")
    records = [
        {"student_id": "S1", "gate": "HADIR", "subject": "HADIR", "expected_alert": False},
        {"student_id": "S2", "gate": "HADIR", "subject": "ALPA_BOLOS", "expected_alert": True},
        {"student_id": "S3", "gate": "ALPA", "subject": "ALPA_BOLOS", "expected_alert": False},
        {"student_id": "S4", "gate": "SAKIT", "subject": "SAKIT", "expected_alert": False},
    ]
    for r in records:
        is_bolos = (r["gate"] == "HADIR") and (r["subject"] == "ALPA_BOLOS")
        assert is_bolos == r["expected_alert"], f"Failed for record {r}"
    print("   -> Bolos detection correctly identifies gate HADIR with subject ALPA_BOLOS.")

def test_kkm_evaluation():
    print("[TEST] 4. KKM Mastery Evaluation")
    kkm = 75.00
    scores = [
        (74.99, False, "REMEDIAL"),
        (75.00, True, "TUNTAS"),
        (75.01, True, "TUNTAS"),
        (100.00, True, "TUNTAS"),
        (0.00, False, "REMEDIAL")
    ]
    for score, expected_tuntas, expected_badge in scores:
        is_tuntas = score >= kkm
        assert is_tuntas == expected_tuntas, f"Score {score} with KKM {kkm} evaluation mismatch"
    print("   -> KKM boundary evaluation (74.99 vs 75.00) verified.")

def test_spintax_engine():
    print("[TEST] 5. Dynamic Spintax Engine Simulation")
    template = "{Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {nama_ortu},"
    
    def resolve_spintax(text):
        pattern = re.compile(r"\{([^{}]+)\}")
        while True:
            match = pattern.search(text)
            if not match:
                break
            choices = match.group(1).split("|")
            chosen = random.choice(choices)
            text = text[:match.start()] + chosen + text[match.end():]
        return text

    generations = set()
    for _ in range(100):
        resolved = resolve_spintax(template.replace("{nama_ortu}", "Budi"))
        generations.add(resolved)
        
    assert "Assalamu'alaikum Bapak/Ibu Budi," in generations
    assert "Selamat Pagi Bapak/Ibu Budi," in generations
    assert "Halo Bapak/Ibu Budi," in generations
    print(f"   -> Spintax generated {len(generations)} distinct phrasing variants over 100 trials.")

def test_webp_compression_contract():
    print("[TEST] 6. WebP Compression Payload Contract")
    def validate_upload(file_size_bytes, mime_type, max_dim):
        if mime_type != "image/webp":
            return False, "INVALID_MIME"
        if file_size_bytes > 180 * 1024: # 180 KB
            return False, "PAYLOAD_TOO_LARGE"
        if max_dim > 1280:
            return False, "DIMENSION_EXCEEDED"
        return True, "OK"
        
    ok1, _ = validate_upload(145 * 1024, "image/webp", 1280)
    assert ok1, "Valid 145 KB WebP 1280px should pass"
    
    ok2, err2 = validate_upload(195 * 1024, "image/webp", 1280)
    assert not ok2 and err2 == "PAYLOAD_TOO_LARGE", "195 KB must be rejected"
    
    ok3, err3 = validate_upload(120 * 1024, "image/jpeg", 1280)
    assert not ok3 and err3 == "INVALID_MIME", "Non-WebP must be rejected"
    
    ok4, err4 = validate_upload(150 * 1024, "image/webp", 1920)
    assert not ok4 and err4 == "DIMENSION_EXCEEDED", ">1280px must be rejected"
    print("   -> WebP compression constraints strictly satisfied.")

if __name__ == "__main__":
    print("=" * 60)
    print("STARTING BUSINESS LOGIC EMPIRICAL SIMULATION")
    print("=" * 60)
    test_gate_attendance_rules()
    test_cooldown_logic()
    test_bolos_detection()
    test_kkm_evaluation()
    test_spintax_engine()
    test_webp_compression_contract()
    print("=" * 60)
    print("ALL 6 BUSINESS LOGIC SIMULATION SUITES PASSED!")
    print("=" * 60)
