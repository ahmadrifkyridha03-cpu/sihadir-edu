"""
Empirical Adversarial Verification Suite for Milestone 6 (F6.1 - F6.5)
Challenger: challenger_m6_1
Runs TSX adversarial suite and records comprehensive results.
"""

import sys
import subprocess
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

def run_adversarial_suite():
    print("=" * 80)
    print("EMPIRICAL CHALLENGER PYTHON HARNESS: MILESTONE 6 SECURITY & PRIVACY")
    print("=" * 80)

    cmd = ["npx", "tsx", str(ROOT / "tests" / "adversarial_m6_security_stress.ts")]
    shell_val = sys.platform == "win32"

    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        shell=shell_val,
        encoding="utf-8",
        errors="replace"
    )

    print(proc.stdout)
    if proc.stderr:
        print("[STDERR]:", proc.stderr)

    print(f"Exit code: {proc.returncode}")
    return proc.returncode

if __name__ == "__main__":
    code = run_adversarial_suite()
    sys.exit(code)
