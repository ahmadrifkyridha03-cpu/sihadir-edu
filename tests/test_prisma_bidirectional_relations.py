"""
Adversarial Stress Test: Bidirectional Relation & Reference Integrity
Checks that all Prisma model relations in agent.md have exact reciprocal definitions,
valid foreign keys, matching target types, and consistent relation names.
"""

import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

AGENT_MD = "d:/WEBSITE ABSENSI/agent.md"

def test_relations():
    with open(AGENT_MD, "r", encoding="utf-8") as f:
        content = f.read()

    schema_match = re.search(r"```prisma\s*(.*?)\s*```", content, re.DOTALL)
    if not schema_match:
        print("[FAIL] No prisma code block found")
        sys.exit(1)
        
    schema = schema_match.group(1)
    
    # Extract models
    models = {}
    model_regex = re.compile(r"model\s+(\w+)\s*\{([^}]+)\}", re.DOTALL)
    for m in model_regex.finditer(schema):
        name = m.group(1)
        body = m.group(2)
        models[name] = body

    print(f"[INFO] Found {len(models)} models.")
    
    # Parse relations with @relation
    # Example:
    # user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    # homeroomTeacher Teacher? @relation("HomeroomTeacher", fields: [homeroomTeacherId], references: [id], onDelete: SetNull)
    # approvedLeaves LeaveRequest[] @relation("ApprovedByTeacher")
    
    relation_attr_regex = re.compile(
        r"(\w+)\s+(\w+)(\?|\[\])?\s+@relation\(([^)]*)\)"
    )
    
    all_relations = []
    for model_name, body in models.items():
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            match = relation_attr_regex.search(line)
            if match:
                field_name = match.group(1)
                target_model = match.group(2)
                cardinality = match.group(3) or "1" # '?', '[]', or '1'
                args = match.group(4)
                
                # Extract relation name if present
                rel_name_match = re.search(r'"([^"]+)"', args)
                rel_name = rel_name_match.group(1) if rel_name_match else None
                
                # Extract fields and references
                fields_match = re.search(r'fields:\s*\[([^\]]+)\]', args)
                ref_match = re.search(r'references:\s*\[([^\]]+)\]', args)
                on_delete_match = re.search(r'onDelete:\s*(\w+)', args)
                
                all_relations.append({
                    "source_model": model_name,
                    "field_name": field_name,
                    "target_model": target_model,
                    "cardinality": cardinality,
                    "rel_name": rel_name,
                    "fields": [f.strip() for f in fields_match.group(1).split(",")] if fields_match else None,
                    "references": [r.strip() for r in ref_match.group(1).split(",")] if ref_match else None,
                    "on_delete": on_delete_match.group(1) if on_delete_match else None,
                    "raw": line
                })

    print(f"[INFO] Extracted {len(all_relations)} @relation definitions across all models.")
    
    errors = []
    # Check 1: Target model must exist
    for r in all_relations:
        if r["target_model"] not in models:
            errors.append(f"Target model '{r['target_model']}' in {r['source_model']}.{r['field_name']} does not exist")

    # Check 2: If relation has fields & references, check that fields exist in source and references exist in target
    for r in all_relations:
        if r["fields"]:
            source_body = models[r["source_model"]]
            for f in r["fields"]:
                if not re.search(rf"\b{f}\b", source_body):
                    errors.append(f"Field '{f}' specified in @relation of {r['source_model']}.{r['field_name']} not declared in {r['source_model']}")
        if r["references"]:
            target_body = models[r["target_model"]]
            for ref in r["references"]:
                if not re.search(rf"\b{ref}\b", target_body):
                    errors.append(f"Reference '{ref}' specified in @relation of {r['source_model']}.{r['field_name']} not declared in target {r['target_model']}")

    # Check 3: Check reciprocity (bidirectional reverse relation exists in target_model)
    for r in all_relations:
        target_model = r["target_model"]
        target_body = models[target_model]
        source_model = r["source_model"]
        rel_name = r["rel_name"]
        
        # Look for reverse relation in target_model pointing back to source_model
        reverse_found = False
        for line in target_body.splitlines():
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            # Look for field pointing to source_model
            if re.search(rf"\b{source_model}(\?|\[\])?\b", line):
                # If named relation, check name matches
                if rel_name:
                    if f'"{rel_name}"' in line:
                        reverse_found = True
                        break
                else:
                    reverse_found = True
                    break
        if not reverse_found:
            errors.append(f"No reverse relation in {target_model} pointing back to {source_model} (rel_name: {rel_name})")

    if errors:
        print(f"[FAIL] {len(errors)} relation integrity errors found:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("[PASS] All relations are bidirectionally consistent, fields & references exist, and relation names match!")

if __name__ == "__main__":
    test_relations()
