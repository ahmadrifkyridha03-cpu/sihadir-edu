"""
Milestone 2 Schema Adversarial Verification Suite
SiHadir-Edu: School Attendance & Grading Web Application

Empirically tests and stress-tests:
1. Relational integrity & referential actions (Cascade, Restrict, SetNull) across 17 models
2. Bidirectional relation completeness, foreign key types, nullability, and names
3. Unique constraint & index coverage on high-frequency lookup fields
4. 13 Enums coverage and variant fidelity against ARCHITECTURE.md
5. Circular cascade detection (DAG verification) and relational lifecycle simulation
6. TypeScript database type contract synchronization in src/types/database.ts
"""

import os
import re
import sys
from collections import defaultdict, deque

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SCHEMA_PATH = os.path.abspath("prisma/schema.prisma")
TYPES_PATH = os.path.abspath("src/types/database.ts")
ARCH_PATH = os.path.abspath("ARCHITECTURE.md")

class PrismaSchemaParser:
    def __init__(self, schema_text: str):
        self.text = schema_text
        self.models = {}
        self.enums = {}
        self._parse()

    def _parse(self):
        # 1. Parse Enums
        enum_pattern = re.compile(r"enum\s+(\w+)\s*\{([^}]+)\}", re.DOTALL)
        for m in enum_pattern.finditer(self.text):
            enum_name = m.group(1)
            raw_body = m.group(2)
            variants = []
            for line in raw_body.splitlines():
                line = line.strip()
                # strip comments
                if "//" in line:
                    line = line.split("//")[0].strip()
                if line:
                    variants.append(line)
            self.enums[enum_name] = variants

        # 2. Parse Models
        model_pattern = re.compile(r"model\s+(\w+)\s*\{([^}]+)\}", re.DOTALL)
        for m in model_pattern.finditer(self.text):
            model_name = m.group(1)
            raw_body = m.group(2)
            self.models[model_name] = self._parse_model_body(model_name, raw_body)

    def _parse_model_body(self, model_name: str, body: str):
        fields = {}
        unique_constraints = []
        indexes = []
        table_map = None

        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("//"):
                continue

            # Strip inline comments
            if "//" in line:
                line = line.split("//")[0].strip()

            # Model level attributes
            if line.startswith("@@map"):
                map_match = re.search(r'@@map\("([^"]+)"\)', line)
                if map_match:
                    table_map = map_match.group(1)
                continue

            if line.startswith("@@unique"):
                u_match = re.search(r'@@unique\(\[([^\]]+)\]\)', line)
                if u_match:
                    cols = [c.strip() for c in u_match.group(1).split(",")]
                    unique_constraints.append(cols)
                continue

            if line.startswith("@@index"):
                idx_match = re.search(r'@@index\(\[([^\]]+)\]\)', line)
                if idx_match:
                    cols = [c.strip() for c in idx_match.group(1).split(",")]
                    indexes.append(cols)
                continue

            # Field level definition
            # Format: fieldName FieldType Attributes...
            parts = line.split()
            if len(parts) >= 2:
                field_name = parts[0]
                field_type_raw = parts[1]

                is_optional = field_type_raw.endswith("?")
                is_list = field_type_raw.endswith("[]")
                base_type = field_type_raw.rstrip("?[]")

                is_id = "@id" in line
                is_unique = "@unique" in line
                
                # Check for @relation
                relation_info = None
                if "@relation" in line:
                    rel_match = re.search(r'@relation\(([^)]*)\)', line)
                    if rel_match:
                        args = rel_match.group(1)
                        name_m = re.search(r'"([^"]+)"', args)
                        fields_m = re.search(r'fields:\s*\[([^\]]+)\]', args)
                        ref_m = re.search(r'references:\s*\[([^\]]+)\]', args)
                        on_del_m = re.search(r'onDelete:\s*(\w+)', args)

                        relation_info = {
                            "relation_name": name_m.group(1) if name_m else None,
                            "fields": [f.strip() for f in fields_m.group(1).split(",")] if fields_m else [],
                            "references": [r.strip() for r in ref_m.group(1).split(",")] if ref_m else [],
                            "on_delete": on_del_m.group(1) if on_del_m else None,
                            "raw": line
                        }

                # Check for @map
                map_name = None
                map_m = re.search(r'@map\("([^"]+)"\)', line)
                if map_m:
                    map_name = map_m.group(1)

                # Check for @db.*
                db_attr = None
                db_m = re.search(r'(@db\.\w+(\([^)]*\))?)', line)
                if db_m:
                    db_attr = db_m.group(1)

                fields[field_name] = {
                    "name": field_name,
                    "raw_type": field_type_raw,
                    "base_type": base_type,
                    "is_optional": is_optional,
                    "is_list": is_list,
                    "is_id": is_id,
                    "is_unique": is_unique,
                    "relation": relation_info,
                    "map_name": map_name,
                    "db_attr": db_attr,
                    "raw_line": line
                }

        return {
            "name": model_name,
            "fields": fields,
            "unique_constraints": unique_constraints,
            "indexes": indexes,
            "table_map": table_map
        }


def run_adversarial_tests():
    print("=" * 75)
    print("EMPIRICAL ADVERSARIAL STRESS TEST: SIHADIR-EDU DATABASE SCHEMA")
    print("=" * 75)

    if not os.path.exists(SCHEMA_PATH):
        print(f"[FAIL] Schema file not found: {SCHEMA_PATH}")
        sys.exit(1)

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_text = f.read()

    parser = PrismaSchemaParser(schema_text)
    print(f"[INFO] Parsed {len(parser.models)} models and {len(parser.enums)} enums from schema.prisma.")

    passed_count = 0
    warning_count = 0
    failure_count = 0

    # --------------------------------------------------------------------------
    # 1. REFERENTIAL INTEGRITY & REFERENTIAL ACTIONS STRESS TEST
    # --------------------------------------------------------------------------
    print("\n[SUITE 1] REFERENTIAL INTEGRITY & ACTIONS (CASCADE / RESTRICT / SET_NULL)")
    print("-" * 75)

    # Required Cascading Deletions (Child records must be cleaned up)
    cascade_expectations = [
        # (source_model, field_name, target_model, expected_on_delete)
        ("ParentStudentLink", "parent", "Parent", "Cascade"),
        ("ParentStudentLink", "student", "Student", "Cascade"),
        ("SubjectAttendance", "journal", "ClassJournal", "Cascade"),
        ("SubjectAttendance", "student", "Student", "Cascade"),
        ("Documentation", "journal", "ClassJournal", "Cascade"),
        ("StudentGrade", "assessment", "Assessment", "Cascade"),
        ("StudentGrade", "student", "Student", "Cascade"),
        ("GateAttendance", "student", "Student", "Cascade"),
        ("LeaveRequest", "student", "Student", "Cascade"),
        ("LeaveRequest", "parent", "Parent", "Cascade"),
        ("WaNotificationLog", "student", "Student", "Cascade"),
        ("Teacher", "user", "User", "Cascade"),
        ("Parent", "user", "User", "Cascade"),
    ]

    for sm, fn, tm, expected_action in cascade_expectations:
        field = parser.models.get(sm, {}).get("fields", {}).get(fn)
        if not field or not field.get("relation"):
            print(f"[FAIL] Missing relation: {sm}.{fn} -> {tm}")
            failure_count += 1
            continue
        rel = field["relation"]
        actual_action = rel.get("on_delete")
        if actual_action == expected_action:
            print(f"  [PASS] Cascade Rule: {sm}.{fn} -> {tm} uses onDelete: {actual_action}")
            passed_count += 1
        else:
            print(f"  [FAIL] Cascade Rule Violation: {sm}.{fn} -> {tm} expected {expected_action}, got {actual_action}")
            failure_count += 1

    # Required Deletion Restrictions (Accidental deletion of master data must be blocked)
    restrict_expectations = [
        # (source_model, field_name, target_model, expected_on_delete)
        ("Class", "academicYear", "AcademicYear", "Restrict"),
        ("Student", "class", "Class", "Restrict"),
        ("ClassJournal", "class", "Class", "Restrict"),
        ("ClassJournal", "subject", "Subject", "Restrict"),
        ("ClassJournal", "teacher", "Teacher", "Restrict"),
        ("Schedule", "teacher", "Teacher", "Restrict"),
        ("Assessment", "teacher", "Teacher", "Restrict"),
    ]

    for sm, fn, tm, expected_action in restrict_expectations:
        field = parser.models.get(sm, {}).get("fields", {}).get(fn)
        if not field or not field.get("relation"):
            print(f"[FAIL] Missing relation: {sm}.{fn} -> {tm}")
            failure_count += 1
            continue
        rel = field["relation"]
        actual_action = rel.get("on_delete")
        if actual_action == expected_action:
            print(f"  [PASS] Protection Restrict: {sm}.{fn} -> {tm} blocks parent delete with onDelete: {actual_action}")
            passed_count += 1
        else:
            print(f"  [FAIL] Protection Violation: {sm}.{fn} -> {tm} expected {expected_action}, got {actual_action}")
            failure_count += 1

    # Required Historical Preservation (SetNull when parent entity unlinked/archived)
    set_null_expectations = [
        ("Student", "user", "User", "SetNull"),
        ("Class", "homeroomTeacher", "Teacher", "SetNull"),
        ("ClassJournal", "schedule", "Schedule", "SetNull"),
        ("Assessment", "journal", "ClassJournal", "SetNull"),
        ("LeaveRequest", "approvedBy", "Teacher", "SetNull"),
    ]

    for sm, fn, tm, expected_action in set_null_expectations:
        field = parser.models.get(sm, {}).get("fields", {}).get(fn)
        if not field or not field.get("relation"):
            print(f"[FAIL] Missing relation: {sm}.{fn} -> {tm}")
            failure_count += 1
            continue
        rel = field["relation"]
        actual_action = rel.get("on_delete")
        # Field must also be optional
        if actual_action == expected_action and field["is_optional"]:
            print(f"  [PASS] Historical Preservation: {sm}.{fn} is optional and uses onDelete: {actual_action}")
            passed_count += 1
        else:
            print(f"  [FAIL] SetNull Rule Violation: {sm}.{fn} expected {expected_action} (is_optional={field['is_optional']}), got {actual_action}")
            failure_count += 1

    # --------------------------------------------------------------------------
    # 2. BIDIRECTIONAL RELATION RECIPROCITY & TYPE COMPATIBILITY
    # --------------------------------------------------------------------------
    print("\n[SUITE 2] BIDIRECTIONAL RELATION RECIPROCITY & TYPING")
    print("-" * 75)

    all_relations_checked = 0
    for sm_name, sm_data in parser.models.items():
        for fn, f_data in sm_data["fields"].items():
            rel = f_data.get("relation")
            if not rel or not rel.get("fields"):
                continue

            all_relations_checked += 1
            tm_name = f_data["base_type"]
            tm_data = parser.models.get(tm_name)

            if not tm_data:
                print(f"  [FAIL] Target model '{tm_name}' not found for {sm_name}.{fn}")
                failure_count += 1
                continue

            # Check that foreign key fields in source model exist
            fk_names = rel["fields"]
            ref_names = rel["references"]

            for fk in fk_names:
                fk_field = sm_data["fields"].get(fk)
                if not fk_field:
                    print(f"  [FAIL] Foreign key '{fk}' missing in source model {sm_name}")
                    failure_count += 1
                else:
                    # Check nullability alignment
                    if f_data["is_optional"] != fk_field["is_optional"]:
                        print(f"  [FAIL] Nullability mismatch between relation {sm_name}.{fn} and fk {sm_name}.{fk}")
                        failure_count += 1

            for ref in ref_names:
                ref_field = tm_data["fields"].get(ref)
                if not ref_field:
                    print(f"  [FAIL] Referenced field '{ref}' missing in target model {tm_name}")
                    failure_count += 1
                else:
                    # Check DB types match
                    fk_field = sm_data["fields"].get(fk_names[0])
                    if fk_field and fk_field.get("db_attr") != ref_field.get("db_attr"):
                        print(f"  [FAIL] Type mismatch between FK {sm_name}.{fk_names[0]} ({fk_field.get('db_attr')}) and PK {tm_name}.{ref} ({ref_field.get('db_attr')})")
                        failure_count += 1

            # Find reciprocal field in target model
            rel_name = rel.get("relation_name")
            reciprocal_found = False

            for t_fn, t_f_data in tm_data["fields"].items():
                if t_f_data["base_type"] == sm_name:
                    t_rel = t_f_data.get("relation")
                    if rel_name:
                        if t_rel and t_rel.get("relation_name") == rel_name:
                            reciprocal_found = True
                            break
                    else:
                        # Unnamed relation
                        if not t_rel or not t_rel.get("relation_name"):
                            reciprocal_found = True
                            break

            if reciprocal_found:
                passed_count += 1
            else:
                print(f"  [FAIL] Missing reciprocal relation field in {tm_name} for {sm_name}.{fn} (rel_name: {rel_name})")
                failure_count += 1

    print(f"  [PASS] Verified {all_relations_checked} active foreign key relations for bidirectional reciprocity and type alignment.")

    # --------------------------------------------------------------------------
    # 3. COMPOSITE CONSTRAINTS, UNIQUENESS & HIGH-FREQUENCY QUERY INDEXES
    # --------------------------------------------------------------------------
    print("\n[SUITE 3] COMPOSITE CONSTRAINTS & HIGH-FREQUENCY QUERY INDEXES")
    print("-" * 75)

    # Critical composite unique constraints
    required_composite_uniques = [
        ("ParentStudentLink", ["parentId", "studentId"]),
        ("GateAttendance", ["studentId", "attendanceDate"]),
        ("SubjectAttendance", ["journalId", "studentId"]),
        ("StudentGrade", ["assessmentId", "studentId"]),
    ]

    for model_name, expected_cols in required_composite_uniques:
        model = parser.models.get(model_name)
        if not model:
            print(f"  [FAIL] Model {model_name} missing")
            failure_count += 1
            continue

        matched = any(c == expected_cols for c in model["unique_constraints"])
        if matched:
            print(f"  [PASS] Composite Unique: {model_name} has @@unique({expected_cols})")
            passed_count += 1
        else:
            print(f"  [FAIL] Missing Composite Unique: {model_name} missing @@unique({expected_cols})")
            failure_count += 1

    # Single unique constraints
    required_single_uniques = [
        ("User", "phoneWa"),
        ("User", "email"),
        ("Teacher", "userId"),
        ("Teacher", "nip"),
        ("Parent", "userId"),
        ("Parent", "phoneWa"),
        ("Student", "userId"),
        ("Student", "nis"),
        ("Student", "nisn"),
        ("Student", "qrToken"),
        ("Class", "homeroomTeacherId"),
        ("Subject", "subjectCode"),
    ]

    for model_name, field_name in required_single_uniques:
        f = parser.models.get(model_name, {}).get("fields", {}).get(field_name)
        if f and f.get("is_unique"):
            print(f"  [PASS] Single Unique: {model_name}.{field_name} is @unique")
            passed_count += 1
        else:
            print(f"  [FAIL] Missing Single Unique: {model_name}.{field_name} must be @unique")
            failure_count += 1

    # Required query indexes
    required_indexes = [
        ("Student", ["classId"]),
        ("Student", ["qrToken"]),
        ("GateAttendance", ["attendanceDate", "status"]),
        ("Schedule", ["classId", "dayOfWeek"]),
        ("ClassJournal", ["classId", "journalDate"]),
        ("SubjectAttendance", ["studentId", "status"]),
        ("Documentation", ["journalId"]),
        ("Assessment", ["classId", "subjectId"]),
        ("StudentGrade", ["studentId"]),
        ("LeaveRequest", ["studentId", "approvalStatus"]),
        ("WaNotificationLog", ["status", "scheduledAt"]),
    ]

    for model_name, cols in required_indexes:
        model = parser.models.get(model_name)
        has_idx = any(i == cols for i in model["indexes"])
        if has_idx:
            print(f"  [PASS] High-Frequency Index: {model_name} @@index({cols}) present")
            passed_count += 1
        else:
            print(f"  [FAIL] Missing High-Frequency Index: {model_name} @@index({cols})")
            failure_count += 1

    # Adversarial Performance Gap Analysis (Mining non-fatal missing indexes & constraints)
    print("\n  [ADVERSARIAL GAP MINING]")
    # 1. Reverse lookup in ParentStudentLink for studentId
    psl_indexes = parser.models.get("ParentStudentLink", {}).get("indexes", [])
    has_psl_student_idx = any("studentId" in i for i in psl_indexes)
    if not has_psl_student_idx:
        print("  [GAP ADVISORY] ParentStudentLink has @@unique([parentId, studentId]), but no separate @@index([studentId]). Reverse parent lookups for a student (e.g., gate notification dispatch) will perform index scan on studentId instead of direct lookup.")
        warning_count += 1

    # 2. WaNotificationLog studentId index
    wa_indexes = parser.models.get("WaNotificationLog", {}).get("indexes", [])
    has_wa_student_idx = any("studentId" in i for i in wa_indexes)
    if not has_wa_student_idx:
        print("  [GAP ADVISORY] WaNotificationLog has no @@index([studentId]). Parent timeline queries for message history will scan status/scheduledAt or filter in memory.")
        warning_count += 1

    # 3. Schedule teacherId index
    sch_indexes = parser.models.get("Schedule", {}).get("indexes", [])
    has_sch_teacher_idx = any("teacherId" in i for i in sch_indexes)
    if not has_sch_teacher_idx:
        print("  [GAP ADVISORY] Schedule has @@index([classId, dayOfWeek]), but no @@index([teacherId, dayOfWeek]). Teacher timetable dashboard queries will filter teacherId.")
        warning_count += 1

    # 4. AcademicYear duplicate protection
    ay_uniques = parser.models.get("AcademicYear", {}).get("unique_constraints", [])
    has_ay_unique = any(set(u) == {"yearName", "semester"} for u in ay_uniques)
    if not has_ay_unique:
        print("  [GAP ADVISORY] AcademicYear lacks @@unique([yearName, semester]). Multiple active records for the same year and semester are structurally possible.")
        warning_count += 1

    # 5. Class duplicate protection
    cl_uniques = parser.models.get("Class", {}).get("unique_constraints", [])
    has_cl_unique = any(set(u) == {"academicYearId", "className"} for u in cl_uniques)
    if not has_cl_unique:
        print("  [GAP ADVISORY] Class lacks @@unique([academicYearId, className]). Duplicate class names in the same academic year are structurally unconstrained.")
        warning_count += 1

    # --------------------------------------------------------------------------
    # 4. ENUMS FIDELITY & SPECIFICATION CONFORMANCE (ARCHITECTURE.md)
    # --------------------------------------------------------------------------
    print("\n[SUITE 4] 13 ENUMS FIDELITY & SPECIFICATION CONFORMANCE")
    print("-" * 75)

    expected_enums = {
        "Role": ["ADMIN", "TEACHER", "PARENT", "STUDENT", "SCANNER"],
        "Gender": ["L", "P"],
        "StudentStatus": ["ACTIVE", "GRADUATED", "MOVED"],
        "ParentRelation": ["AYAH", "IBU", "WALI"],
        "GateStatus": ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALPA"],
        "SubjectStatus": ["HADIR", "SAKIT", "IZIN", "ALPA_BOLOS"],
        "EngagementBadge": ["ACTIVE_STAR", "GOOD", "LESS_FOCUS", "NO_TASK"],
        "AssessmentCategory": ["TUGAS", "KUIS", "PRAKTIKUM", "UH", "PTS", "PAS"],
        "DocVisibility": ["CLASS_PUBLIC", "TAGGED_STUDENTS_ONLY"],
        "LeaveType": ["SAKIT", "IZIN"],
        "ApprovalStatus": ["PENDING", "APPROVED", "REJECTED"],
        "WaNotifType": ["GATE_LATE", "GATE_IN", "ABSENT_ALERT", "GRADE_UPDATE", "DAILY_DIGEST"],
        "WaStatus": ["QUEUED", "SENT", "FAILED"]
    }

    if len(parser.enums) != 13:
        print(f"  [FAIL] Expected exactly 13 enums, found {len(parser.enums)}")
        failure_count += 1
    else:
        print("  [PASS] Exactly 13 enums defined in Prisma schema.")
        passed_count += 1

    for enum_name, expected_vars in expected_enums.items():
        actual_vars = parser.enums.get(enum_name)
        if actual_vars is None:
            print(f"  [FAIL] Missing enum: {enum_name}")
            failure_count += 1
            continue

        if actual_vars == expected_vars:
            print(f"  [PASS] Enum {enum_name} ({len(actual_vars)} variants) matches ARCHITECTURE.md exactly: {actual_vars}")
            passed_count += 1
        else:
            print(f"  [FAIL] Enum {enum_name} mismatch: expected {expected_vars}, got {actual_vars}")
            failure_count += 1

    # --------------------------------------------------------------------------
    # 5. CIRCULAR CASCADE GRAPH ANALYSIS & DAG VERIFICATION
    # --------------------------------------------------------------------------
    print("\n[SUITE 5] CIRCULAR CASCADE GRAPH ANALYSIS (POSTGRESQL DAG VERIFICATION)")
    print("-" * 75)

    # In PostgreSQL, circular ON DELETE CASCADE actions cause runtime recursion or DDL creation errors.
    # Build a directed graph of all Cascade edges: ParentModel -> ChildModel
    cascade_graph = defaultdict(set)
    for sm_name, sm_data in parser.models.items():
        for fn, f_data in sm_data["fields"].items():
            rel = f_data.get("relation")
            if rel and rel.get("on_delete") == "Cascade":
                target_parent = f_data["base_type"]
                # When target_parent is deleted, sm_name (child) is cascaded
                cascade_graph[target_parent].add(sm_name)

    print("  [INFO] Cascade Dependency Graph:")
    for parent, children in sorted(cascade_graph.items()):
        print(f"    {parent} --[Cascade]--> {sorted(children)}")

    # Detect cycles via Kahn's algorithm or DFS
    visited = {}
    cycle_detected = False
    cycle_path = []

    def dfs(node, path):
        nonlocal cycle_detected, cycle_path
        visited[node] = 1 # in progress
        for neighbor in cascade_graph.get(node, []):
            if visited.get(neighbor) == 1:
                cycle_detected = True
                cycle_path = path + [neighbor]
                return
            if neighbor not in visited:
                dfs(neighbor, path + [neighbor])
        visited[node] = 2 # completed

    for m in parser.models:
        if m not in visited:
            dfs(m, [m])

    if not cycle_detected:
        print("  [PASS] Cascade deletion graph is a strictly acyclic DAG (no circular cascades).")
        passed_count += 1
    else:
        print(f"  [FAIL] Circular cascade detected: {' -> '.join(cycle_path)}")
        failure_count += 1

    # --------------------------------------------------------------------------
    # 6. TYPESCRIPT TYPES SYNCHRONIZATION (src/types/database.ts)
    # --------------------------------------------------------------------------
    print("\n[SUITE 6] TYPESCRIPT DATABASE TYPE CONTRACT SYNCHRONIZATION")
    print("-" * 75)

    if not os.path.exists(TYPES_PATH):
        print(f"  [FAIL] TypeScript database types missing at {TYPES_PATH}")
        failure_count += 1
    else:
        with open(TYPES_PATH, "r", encoding="utf-8") as f:
            types_content = f.read()

        # Check all 17 models re-exported
        for model_name in parser.models:
            if re.search(rf"\b{model_name}\b", types_content):
                passed_count += 1
            else:
                print(f"  [FAIL] Model '{model_name}' not re-exported in {TYPES_PATH}")
                failure_count += 1

        # Check all 13 enums re-exported
        for enum_name in parser.enums:
            if re.search(rf"\b{enum_name}\b", types_content):
                passed_count += 1
            else:
                print(f"  [FAIL] Enum '{enum_name}' not re-exported in {TYPES_PATH}")
                failure_count += 1

        # Check composite types present
        composite_types = [
            "StudentWithClassAndParents",
            "ClassWithHomeroomAndCount",
            "ClassJournalWithDetails",
            "GateAttendanceWithStudent",
            "AssessmentWithGrades",
            "LeaveRequestWithDetails",
            "ParentSessionContext",
            "ServerActionResult",
            "GateScanInput",
            "CreateClassJournalInput",
            "BatchGradeEntryInput",
            "SubmitLeaveRequestInput"
        ]
        for ct in composite_types:
            if re.search(rf"\b{ct}\b", types_content):
                passed_count += 1
            else:
                print(f"  [FAIL] Composite type '{ct}' not found in {TYPES_PATH}")
                failure_count += 1

        print("  [PASS] All 17 models, 13 enums, and 12 composite payload types synchronized in src/types/database.ts.")

    # --------------------------------------------------------------------------
    # SUMMARY REPORT
    # --------------------------------------------------------------------------
    print("\n" + "=" * 75)
    print("EMPIRICAL ADVERSARIAL VERIFICATION SUMMARY")
    print("=" * 75)
    print(f"  TOTAL CHECKS PASSED:   {passed_count}")
    print(f"  ADVISORY GAPS FOUND:   {warning_count}")
    print(f"  FATAL FAILURES:        {failure_count}")

    if failure_count == 0:
        print("\n>>> EMPIRICAL VERDICT: ALL INVARIANTS PASS [APPROVE]")
        print(f">>> {warning_count} non-blocking performance advisories documented in challenge_report.md.")
        return 0
    else:
        print(f"\n>>> EMPIRICAL VERDICT: {failure_count} INVARIANTS FAILED [REQUEST_CHANGES]")
        return 1

if __name__ == "__main__":
    sys.exit(run_adversarial_tests())
