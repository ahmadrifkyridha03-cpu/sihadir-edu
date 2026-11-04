"""
Adversarial Stress Test Suite for Milestone 5 WhatsApp Gateway (F5.1 - F5.4)
Executes TypeScript empirical harness and validates edge-case behavior.
"""

import sys
import subprocess
from pathlib import Path

# Ensure UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

def main():
    print("==============================================================================")
    print("Empirical Verification: Adversarial M5 WhatsApp Stress Harness")
    print("==============================================================================\n")

    cmd = ["npx", "tsx", str(ROOT / "tests" / "adversarial_m5_whatsapp_stress.ts")]
    shell_val = sys.platform == "win32"
    
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            shell=shell_val,
            timeout=120
        )
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)

        passed = (proc.returncode == 0) and ("ALL EMPIRICAL ADVERSARIAL STRESS TESTS PASSED" in proc.stdout)
        
        print("\n==============================================================================")
        print(f"Adversarial WhatsApp Stress Verdict: {'APPROVE' if passed else 'REJECT'}")
        print("==============================================================================")
        sys.exit(0 if passed else 1)
    except Exception as e:
        print(f"Execution Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
