"""
SiHadir-Edu: Project Knowledge Graph Generator (Milestone 1, F0.2)
Generates graphify-out/graph.json, graphify-out/graph.html, and graphify-out/GRAPH_REPORT.md.
"""
import sys
import json
from pathlib import Path

# Verify graphify availability
try:
    from graphify.detect import detect
    from graphify.extract import extract
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.report import generate
    from graphify.export import to_json, to_html
    from graphify.diagnostics import diagnose_extraction, format_diagnostic_report
except ImportError as e:
    print(f"ERROR: Failed to import graphify modules: {e}", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(".").resolve()
OUT_DIR = PROJECT_ROOT / "graphify-out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 70)
print("SiHadir-Edu: Initializing Knowledge Graph Generation")
print("=" * 70)

# Step 1: Detect files with strict exclusion of agent metadata
print("\n[Step 1/6] Detecting specification files...")
det = detect(PROJECT_ROOT, extra_excludes=[".agents", "node_modules", ".git", ".next"])

target_docs = [
    PROJECT_ROOT / "ARCHITECTURE.md",
    PROJECT_ROOT / "PRD.md",
    PROJECT_ROOT / "WORKFLOW.md",
    PROJECT_ROOT / "DESIGN.md",
    PROJECT_ROOT / "PROJECT.md",
    PROJECT_ROOT / "agent.md",
]

# Filter existing files
doc_files = [f for f in target_docs if f.is_file()]
print(f"Detected {len(doc_files)} target specification files:")
for f in doc_files:
    print(f"  - {f.name} ({f.stat().st_size:,} bytes)")

if not doc_files:
    print("ERROR: No target specification files found!", file=sys.stderr)
    sys.exit(1)

# Step 2: Structural Extraction
print("\n[Step 2/6] Extracting document structure via AST/markdown engine...")
ext = extract(doc_files, cache_root=PROJECT_ROOT, root=PROJECT_ROOT)
print(f"Structural extraction: {len(ext['nodes'])} nodes, {len(ext['edges'])} edges")

# Step 3: Semantic Enrichment (Domain-Specific Architectural Entities & Inferred Edges)
print("\n[Step 3/6] Injecting domain architectural concepts & cross-cutting edges...")
domain_entities = [
    # Core Architecture & Database Entities
    {"id": "supabase_database", "label": "Supabase PostgreSQL Database", "file_type": "concept", "node_kind": "concept", "source_file": "ARCHITECTURE.md", "source_location": "L140"},
    {"id": "erd_13_tables", "label": "13 Core ERD Tables", "file_type": "concept", "node_kind": "concept", "source_file": "ARCHITECTURE.md", "source_location": "L142"},
    {"id": "hmac_qr_token", "label": "Signed HMAC-SHA256 QR Token", "file_type": "concept", "node_kind": "concept", "source_file": "ARCHITECTURE.md", "source_location": "L45"},
    {"id": "webp_compression", "label": "Client-Side WebP Compression (<180 KB)", "file_type": "concept", "node_kind": "concept", "source_file": "ARCHITECTURE.md", "source_location": "L98"},
    {"id": "whatsapp_gateway_queue", "label": "WhatsApp Anti-Ban Queue (4-10s Jitter)", "file_type": "concept", "node_kind": "concept", "source_file": "ARCHITECTURE.md", "source_location": "L62"},
    # Attendance & Anti-Fraud Entities
    {"id": "dual_layer_attendance", "label": "Dual-Layer Attendance (Gate + Class)", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L110"},
    {"id": "anti_titip_absen", "label": "Anti-Titip Absen Controls (5-Min Cooldown)", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L116"},
    {"id": "face_verification_popup", "label": "Large Face Photo Verification Pop-up", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L118"},
    {"id": "bolos_detection", "label": "In-Session Bolos (Skipping) Detection", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L120"},
    # Grading & Engagement Entities
    {"id": "two_tier_grading", "label": "Two-Tier Grading System", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L123"},
    {"id": "engagement_badges", "label": "Tier 1 Daily Engagement Badges (🌟, ✅, ⚠️, ❌)", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L125"},
    {"id": "kkm_mastery", "label": "Tier 2 Formal Grading with KKM Mastery", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L132"},
    # Media & Documentation
    {"id": "classroom_documentation", "label": "Classroom Documentation Photo Feed", "file_type": "concept", "node_kind": "concept", "source_file": "PRD.md", "source_location": "L140"},
    # Parent & Kiosk UI
    {"id": "parent_portal_pwa", "label": "Parent Portal PWA (Mobile-First)", "file_type": "concept", "node_kind": "concept", "source_file": "DESIGN.md", "source_location": "L124"},
    {"id": "kiosk_scanner_ui", "label": "High-Contrast Kiosk QR Scanner Mode", "file_type": "concept", "node_kind": "concept", "source_file": "DESIGN.md", "source_location": "L102"},
    {"id": "design_system_tokens", "label": "Emerald Primary & Slate UI Tokens", "file_type": "concept", "node_kind": "concept", "source_file": "DESIGN.md", "source_location": "L23"},
    # Governance & Execution
    {"id": "agent_governance", "label": "Agent Workflow & System Invariants", "file_type": "concept", "node_kind": "concept", "source_file": "agent.md", "source_location": "L1"},
    {"id": "project_milestones", "label": "Milestones M1-M7 Roadmap", "file_type": "concept", "node_kind": "concept", "source_file": "PROJECT.md", "source_location": "L68"},
]

# Add domain entities
existing_ids = {n["id"] for n in ext["nodes"]}
for ent in domain_entities:
    if ent["id"] not in existing_ids:
        ent["_origin"] = "semantic"
        ext["nodes"].append(ent)
        existing_ids.add(ent["id"])

# Cross-cutting relational edges
domain_edges = [
    # Architecture -> ERD
    {"source": "erd_13_tables", "target": "supabase_database", "relation": "stored_in", "confidence": "EXTRACTED", "_origin": "semantic", "source_file": "ARCHITECTURE.md"},
    {"source": "hmac_qr_token", "target": "anti_titip_absen", "relation": "enforces", "confidence": "INFERRED", "_origin": "semantic", "source_file": "ARCHITECTURE.md"},
    {"source": "anti_titip_absen", "target": "dual_layer_attendance", "relation": "secures", "confidence": "INFERRED", "_origin": "semantic", "source_file": "PRD.md"},
    {"source": "face_verification_popup", "target": "kiosk_scanner_ui", "relation": "rendered_in", "confidence": "INFERRED", "_origin": "semantic", "source_file": "PRD.md"},
    {"source": "dual_layer_attendance", "target": "bolos_detection", "relation": "triggers", "confidence": "INFERRED", "_origin": "semantic", "source_file": "PRD.md"},
    {"source": "bolos_detection", "target": "whatsapp_gateway_queue", "relation": "notifies_via", "confidence": "INFERRED", "_origin": "semantic", "source_file": "PRD.md"},
    # Grading & Badges
    {"source": "engagement_badges", "target": "two_tier_grading", "relation": "part_of", "confidence": "EXTRACTED", "_origin": "semantic", "source_file": "PRD.md"},
    {"source": "kkm_mastery", "target": "two_tier_grading", "relation": "part_of", "confidence": "EXTRACTED", "_origin": "semantic", "source_file": "PRD.md"},
    # Media & Documentation
    {"source": "webp_compression", "target": "classroom_documentation", "relation": "optimizes", "confidence": "INFERRED", "_origin": "semantic", "source_file": "ARCHITECTURE.md"},
    {"source": "classroom_documentation", "target": "parent_portal_pwa", "relation": "displayed_in", "confidence": "INFERRED", "_origin": "semantic", "source_file": "PRD.md"},
    # Parent & UI
    {"source": "design_system_tokens", "target": "parent_portal_pwa", "relation": "styles", "confidence": "INFERRED", "_origin": "semantic", "source_file": "DESIGN.md"},
    {"source": "design_system_tokens", "target": "kiosk_scanner_ui", "relation": "styles", "confidence": "INFERRED", "_origin": "semantic", "source_file": "DESIGN.md"},
    # Governance & Roadmap
    {"source": "agent_governance", "target": "project_milestones", "relation": "governs", "confidence": "INFERRED", "_origin": "semantic", "source_file": "agent.md"},
    {"source": "project_milestones", "target": "erd_13_tables", "relation": "schedules_implementation", "confidence": "INFERRED", "_origin": "semantic", "source_file": "PROJECT.md"},
]

for edge in domain_edges:
    ext["edges"].append(edge)

print(f"Total graph composition: {len(ext['nodes'])} nodes, {len(ext['edges'])} edges")

# Step 4: Build NetworkX Graph & Cluster
print("\n[Step 4/6] Building graph model and detecting communities...")
G = build_from_json(ext, root=PROJECT_ROOT, directed=False)

if G.number_of_nodes() == 0:
    print("ERROR: Graph is empty!", file=sys.stderr)
    sys.exit(1)

communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)

# Step 5: Curate Community Labels
community_labels = {
    0: "System Architecture & Supabase ERD",
    1: "Gate QR Scanner & Anti-Fraud Engine",
    2: "Classroom Rostering & Bolos Alerts",
    3: "Two-Tier Grading & Engagement Badges",
    4: "Documentation Feed & WebP Pipeline",
    5: "WhatsApp Gateway & Anti-Ban Queue",
    6: "Parent Portal PWA & Activity Timeline",
    7: "UI/UX Design Tokens & Typography",
    8: "Project Governance & Roadmap",
}
# Fallback for extra clusters
for cid in communities:
    if cid not in community_labels:
        community_labels[cid] = f"Community {cid}"

questions = suggest_questions(G, communities, community_labels)

# Step 6: Export Output Deliverables
print("\n[Step 5/6] Exporting graphify-out deliverables...")
json_out = OUT_DIR / "graph.json"
html_out = OUT_DIR / "graph.html"
report_out = OUT_DIR / "GRAPH_REPORT.md"
labels_out = OUT_DIR / ".graphify_labels.json"
analysis_out = OUT_DIR / ".graphify_analysis.json"

# Write graph.json
to_json(G, communities, str(json_out), community_labels=community_labels)
print(f"  [+] {json_out.name} ({json_out.stat().st_size:,} bytes)")

# Write graph.html
to_html(G, communities, str(html_out), community_labels=community_labels)
print(f"  [+] {html_out.name} ({html_out.stat().st_size:,} bytes)")

# Write GRAPH_REPORT.md
tokens = {"input": 0, "output": 0}
report_md = generate(G, communities, cohesion, community_labels, gods, surprises, det, tokens, str(PROJECT_ROOT), suggested_questions=questions)
report_out.write_text(report_md, encoding="utf-8")
print(f"  [+] {report_out.name} ({report_out.stat().st_size:,} bytes)")

# Write labels and analysis
labels_out.write_text(json.dumps({str(k): v for k, v in community_labels.items()}, indent=2), encoding="utf-8")
analysis_out.write_text(json.dumps({
    "communities": {str(k): v for k, v in communities.items()},
    "cohesion": {str(k): v for k, v in cohesion.items()},
    "gods": gods,
    "surprises": surprises,
}, indent=2), encoding="utf-8")

# Step 7: Diagnostic Health Gate
print("\n[Step 6/6] Running graph integrity diagnostics...")
diag = diagnose_extraction(ext, directed=False, root=PROJECT_ROOT)
print(format_diagnostic_report(diag))

dangling = diag.get("dangling_endpoint_edges", 0)
missing = diag.get("missing_endpoint_edges", 0)
self_loops = diag.get("self_loop_edges", 0)

if dangling > 0 or missing > 0 or self_loops > 0:
    print(f"WARNING: Graph integrity warnings found: dangling={dangling}, missing={missing}, self_loops={self_loops}")
else:
    print("SUCCESS: Graph health verified clean (0 dangling, 0 missing, 0 self-loops)!")

print("\n" + "=" * 70)
print("SiHadir-Edu: Knowledge Graph Build Complete!")
print("=" * 70)
