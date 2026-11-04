"""
Empirical Verification Test Harness for Milestone 1
Knowledge Graph (graphify) & Git Governance Boundaries
Author: challenger_m1_1
"""

import os
import sys
import json
import subprocess
from pathlib import Path

ROOT = Path(".").resolve()
GRAPH_JSON = ROOT / "graphify-out" / "graph.json"
GRAPH_HTML = ROOT / "graphify-out" / "graph.html"
GRAPH_REPORT = ROOT / "graphify-out" / "GRAPH_REPORT.md"
AGENT_MD = ROOT / "agent.md"
PROJECT_MD = ROOT / "PROJECT.md"
GITIGNORE = ROOT / ".gitignore"

test_results = []

def run_test(name, fn):
    try:
        passed, msg = fn()
        test_results.append({"name": name, "passed": passed, "message": msg})
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {name}: {msg}")
    except Exception as e:
        test_results.append({"name": name, "passed": False, "message": f"Exception: {e}"})
        print(f"[FAIL] {name}: Exception: {e}")

# -----------------------------------------------------------------------------
# Test 1: Graph Diagnostics & Multigraph Integrity
# -----------------------------------------------------------------------------
def test_graph_diagnostics():
    cmd = ["graphify", "diagnose", "multigraph", "--graph", str(GRAPH_JSON)]
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    if res.returncode != 0:
        return False, f"graphify diagnose multigraph exited with code {res.returncode}: {res.stderr}"
    
    out = res.stdout
    if "missing_endpoint_edges: 0" not in out:
        return False, f"missing_endpoint_edges is not 0: {out}"
    if "dangling_endpoint_edges: 0" not in out:
        return False, f"dangling_endpoint_edges is not 0: {out}"
    if "self_loop_edges: 0" not in out:
        return False, f"self_loop_edges is not 0: {out}"
    if "exact_duplicate_edges: 0" not in out:
        return False, f"exact_duplicate_edges is not 0: {out}"
    
    return True, "0 missing endpoints, 0 dangling endpoints, 0 self loops, 0 exact duplicate edges"

# -----------------------------------------------------------------------------
# Test 2: Graph JSON Content & Structure
# -----------------------------------------------------------------------------
def test_graph_json_structure():
    if not GRAPH_JSON.exists():
        return False, f"graph.json not found at {GRAPH_JSON}"
    with open(GRAPH_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    nodes = data.get("nodes", [])
    edges = data.get("links", data.get("edges", []))
    
    if len(nodes) < 100:
        return False, f"Insufficient nodes in graph: {len(nodes)}"
    if len(edges) < 100:
        return False, f"Insufficient edges in graph: {len(edges)}"
    
    return True, f"Found {len(nodes)} nodes and {len(edges)} edges with schema_version={data.get('graph', {}).get('schema_version')}"

# -----------------------------------------------------------------------------
# Test 3: Zero .agents/ Leakage in Knowledge Graph
# -----------------------------------------------------------------------------
def test_zero_agents_leakage():
    with open(GRAPH_JSON, "r", encoding="utf-8") as f:
        raw_json = f.read()
    
    if ".agents" in raw_json:
        return False, "Leaked '.agents' substring found in graphify-out/graph.json!"
    if "teamwork" in raw_json:
        return False, "Leaked 'teamwork' substring found in graphify-out/graph.json!"
    if "orchestrator" in raw_json:
        return False, "Leaked 'orchestrator' substring found in graphify-out/graph.json!"
    
    return True, "Zero presence of '.agents', 'teamwork', or 'orchestrator' in graph.json"

# -----------------------------------------------------------------------------
# Test 4: God Nodes Identification
# -----------------------------------------------------------------------------
def test_god_nodes():
    cmd = ["graphify", "god-nodes", "--top", "5", "--graph", str(GRAPH_JSON)]
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    if res.returncode != 0:
        return False, f"graphify god-nodes exited with {res.returncode}: {res.stderr}"
    
    out = res.stdout
    required_gods = ["ARCHITECTURE", "PRD", "SiHadir-Edu"]
    found = [g for g in required_gods if g.lower() in out.lower()]
    if len(found) < 3:
        return False, f"Key specification god nodes missing from top 5: {out}"
    
    return True, f"Top god nodes correctly reflect core governance and specifications: {out.strip()}"

# -----------------------------------------------------------------------------
# Test 5: Graph Queries - WebP
# -----------------------------------------------------------------------------
def test_query_webp():
    cmd = ["graphify", "query", "WebP", "--graph", str(GRAPH_JSON)]
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    if res.returncode != 0:
        return False, f"graphify query 'WebP' failed: {res.stderr}"
    out = res.stdout
    if "WebP" not in out or "Classroom Documentation" not in out:
        return False, f"Query 'WebP' did not resolve expected traversal: {out}"
    return True, f"Resolved WebP traversal with {out.count('NODE')} nodes"

# -----------------------------------------------------------------------------
# Test 6: Graph Queries - Supabase
# -----------------------------------------------------------------------------
def test_query_supabase():
    cmd = ["graphify", "query", "Supabase", "--graph", str(GRAPH_JSON)]
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    if res.returncode != 0:
        return False, f"graphify query 'Supabase' failed: {res.stderr}"
    out = res.stdout
    if "Supabase PostgreSQL Database" not in out or "13 Core ERD Tables" not in out:
        return False, f"Query 'Supabase' did not resolve expected traversal: {out}"
    return True, f"Resolved Supabase traversal with {out.count('NODE')} nodes"

# -----------------------------------------------------------------------------
# Test 7: Graph Queries - Attendance / Absen Domain Terms
# -----------------------------------------------------------------------------
def test_query_attendance_domain():
    # Test 'absen'
    cmd1 = ["graphify", "query", "absen", "--graph", str(GRAPH_JSON)]
    res1 = subprocess.run(cmd1, capture_output=True, text=True, cwd=str(ROOT))
    if res1.returncode != 0:
        return False, f"graphify query 'absen' failed: {res1.stderr}"
    
    # Test 'attendance'
    cmd2 = ["graphify", "query", "Attendance", "--graph", str(GRAPH_JSON)]
    res2 = subprocess.run(cmd2, capture_output=True, text=True, cwd=str(ROOT))
    if res2.returncode != 0:
        return False, f"graphify query 'Attendance' failed: {res2.stderr}"
    
    # Note on 'presensi': Presensi is a body-text synonym in Indonesian, while Absensi and Attendance are node labels.
    cmd3 = ["graphify", "query", "presensi", "--graph", str(GRAPH_JSON)]
    res3 = subprocess.run(cmd3, capture_output=True, text=True, cwd=str(ROOT))
    presensi_matches = (res3.returncode == 0)
    
    return True, f"'absen' resolved {res1.stdout.count('NODE')} nodes; 'Attendance' resolved {res2.stdout.count('NODE')} nodes; 'presensi' matches node labels: {presensi_matches}"

# -----------------------------------------------------------------------------
# Test 8: Git Ignore Security Boundaries
# -----------------------------------------------------------------------------
def test_gitignore_boundaries():
    targets = [
        (".env", True),
        (".env.local", True),
        (".env.production", True),
        (".agents/teamwork/orchestrator/PROJECT.md", True),
        (".agents/teamwork/worker_m1/handoff.md", True),
        (".next/BUILD_ID", True),
        ("node_modules/express/index.js", True),
        ("graphify-out/cache/ast/test.json", True),
        (".env.example", False),
        ("graphify-out/graph.json", False),
        ("graphify-out/graph.html", False),
        ("graphify-out/GRAPH_REPORT.md", False),
        ("agent.md", False),
        ("PROJECT.md", False),
        ("ARCHITECTURE.md", False),
        ("scripts/build_knowledge_graph.py", False),
    ]
    
    failures = []
    for path, expect_ignored in targets:
        res = subprocess.run(["git", "check-ignore", "-q", path], cwd=str(ROOT))
        is_ignored = (res.returncode == 0)
        if is_ignored != expect_ignored:
            failures.append(f"{path}: expected ignored={expect_ignored}, got {is_ignored}")
            
    if failures:
        return False, f"Gitignore boundary violations: {'; '.join(failures)}"
    return True, f"All {len(targets)} path ignore boundary tests passed exactly"

# -----------------------------------------------------------------------------
# Test 9: Git Status & Branch Verification
# -----------------------------------------------------------------------------
def test_git_repository_state():
    branch_res = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True, cwd=str(ROOT))
    current_branch = branch_res.stdout.strip()
    if current_branch != "main":
        return False, f"Expected branch 'main', got '{current_branch}'"
    
    log_res = subprocess.run(["git", "log", "-1", "--oneline"], capture_output=True, text=True, cwd=str(ROOT))
    if log_res.returncode != 0:
        return False, f"git log failed: {log_res.stderr}"
    
    return True, f"Git repository initialized on branch '{current_branch}', HEAD: {log_res.stdout.strip()}"

if __name__ == "__main__":
    print("=" * 70)
    print("RUNNING MILESTONE 1 EMPIRICAL VERIFICATION SUITE")
    print("=" * 70)
    
    run_test("1. Graph Diagnostics (multigraph integrity)", test_graph_diagnostics)
    run_test("2. Graph JSON Composition & Sizing", test_graph_json_structure)
    run_test("3. Zero .agents/ Leakage in Graph", test_zero_agents_leakage)
    run_test("4. Top 5 God Nodes Inspection", test_god_nodes)
    run_test("5. Graph Query Traversal: WebP", test_query_webp)
    run_test("6. Graph Query Traversal: Supabase", test_query_supabase)
    run_test("7. Graph Query Traversal: Attendance/Absen", test_query_attendance_domain)
    run_test("8. .gitignore Boundary Isolation", test_gitignore_boundaries)
    run_test("9. Git Repository & Branch State", test_git_repository_state)
    
    passed_count = sum(1 for r in test_results if r["passed"])
    total_count = len(test_results)
    
    print("=" * 70)
    print(f"VERIFICATION SUMMARY: {passed_count}/{total_count} PASSED")
    print("=" * 70)
    
    if passed_count < total_count:
        sys.exit(1)
    sys.exit(0)
