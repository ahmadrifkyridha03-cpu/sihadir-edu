# Graph Report - WEBSITE ABSENSI  (2026-11-04)

## Corpus Check
- Corpus is ~15,580 words - fits in a single context window. You may not need a graph.

## Summary
- 123 nodes · 114 edges · 12 communities
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- System Architecture & Supabase ERD
- Gate QR Scanner & Anti-Fraud Engine
- Classroom Rostering & Bolos Alerts
- Two-Tier Grading & Engagement Badges
- Documentation Feed & WebP Pipeline
- WhatsApp Gateway & Anti-Ban Queue
- Parent Portal PWA & Activity Timeline
- UI/UX Design Tokens & Typography
- Project Governance & Roadmap
- Community 9
- Community 10
- Community 11

## God Nodes (most connected - your core abstractions)
1. `SiHadir-Edu: Agent Constitution, Operational Architecture & UI/UX Governance` - 10 edges
2. `System Architecture & Technical Specification (`ARCHITECTURE.md`)` - 8 edges
3. `Product Requirements Document (PRD)` - 8 edges
4. `4. Spesifikasi Fitur Inti (Core Features Specification)` - 7 edges
5. `Project Workflow, SOP Operasional & Development Roadmap (`WORKFLOW.md`)` - 7 edges
6. `2. Analisis Mendalam: Kekurangan Ide Awal & Solusi Sistem (Gap Analysis)` - 6 edges
7. `2. Peta Jalan Pengembangan Bertahap (Development Roadmap)` - 6 edges
8. `UI/UX Design Specification & Wireframes (`DESIGN.md`)` - 6 edges
9. `3. Rancangan Tata Letak Layar Utama (Wireframes)` - 6 edges
10. `Project: School Attendance & Grading Web Application (SiHadir-Edu)` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Agent Workflow & System Invariants` --governs--> `Milestones`  [INFERRED]
  agent.md → PROJECT.md
- `Milestones` --schedules_implementation--> `13 Core ERD Tables`  [INFERRED]
  PROJECT.md → ARCHITECTURE.md
- `Signed HMAC-SHA256 QR Token` --enforces--> `Anti-Titip Absen Controls (5-Min Cooldown)`  [INFERRED]
  ARCHITECTURE.md → PRD.md
- `Client-Side WebP Compression (<180 KB)` --optimizes--> `Classroom Documentation Photo Feed`  [INFERRED]
  ARCHITECTURE.md → PRD.md
- `In-Session Bolos (Skipping) Detection` --notifies_via--> `WhatsApp Anti-Ban Queue (4-10s Jitter)`  [INFERRED]
  PRD.md → ARCHITECTURE.md

## Communities (12 total, 0 thin omitted)

### Community 0 - "System Architecture & Supabase ERD"
Cohesion: 0.12
Nodes (16): 1.1 Tabel Perbandingan Arsitektur, 1. Perbandingan & Pemilihan Tech Stack Gratis (Free Tier), 2. Diagram Arsitektur Tingkat Tinggi (High-Level Architecture), 3.1 Alur Scan QR Code Siswa & Notifikasi WhatsApp Anti-Banned, 3.2 Alur Input Jurnal, Nilai, & Kompresi Foto Dokumentasi oleh Guru, 3. Alur Sistem Utama (Sequence Diagrams), 4. Desain Skema Database & Entity Relationship Diagram (ERD), 5.1 Spesifikasi Teknis QR Code & Anti-Titip Absen (+8 more)

### Community 1 - "Gate QR Scanner & Anti-Fraud Engine"
Cohesion: 0.12
Nodes (15): 1. Executive Summary & Purpose of `agent.md`, 2.1 The Indonesian School Reality, 2.2 The Three Pillars of Transparency, 2. Project Context & Operating Environment, 3.1 Technology Matrix, 3. Core Architecture & Technical Stack, 4. Database Architecture & Schema Specification (13 Core ERD Entities), 6.1 Design Tokens & The "Swiss & Minimalist Education" Aesthetic (+7 more)

### Community 2 - "Classroom Rostering & Bolos Alerts"
Cohesion: 0.13
Nodes (14): 1. Prinsip Utama Desain (Core Design Principles), 2.1 Palet Warna Utama (Tailwind CSS Standard), 2.2 Semantic Badges (Kode Warna Status Absensi & Akademik), 2.3 Tipografi, 2. Sistem Warna & Tipografi (Color Palette & Typography), 3.1 Portal Orang Tua – Dashboard Utama (Mobile View), 3.2 Layar Guru – Input Jurnal Kelas, Absensi, Keaktifan & Dokumentasi (Mobile/Tablet), 3.3 Layar Scanner QR Code Gerbang / Kiosk (Tablet / Laptop / HP Piket) (+6 more)

### Community 3 - "Two-Tier Grading & Engagement Badges"
Cohesion: 0.13
Nodes (14): 1.1 Latar Belakang Masalah, 1.2 Solusi yang Ditawarkan, 1. Ringkasan Eksekutif (Executive Summary), 2.1 Celah "Titip Absen" Kartu QR & Bolos Jam Pelajaran, 2.2 Keterbatasan Kuota Penyimpanan Gratis (Free Tier) Akibat Foto Dokumentasi, 2.3 Risiko Guru Kewalahan Menginput Nilai Setiap Hari, 2.4 Risiko Pemblokiran (Banned) Nomor WhatsApp Sekolah, 2.5 Kompleksitas Relasi Orang Tua & Siswa (Kakak-Beradik & Kemudahan Akses) (+6 more)

### Community 4 - "Documentation Feed & WebP Pipeline"
Cohesion: 0.14
Nodes (13): Agent Workflow & System Invariants, 13 Core ERD Tables, Architecture, Code Layout, Feature Inventory, Interface Contracts, M2 (Database) <-> M3, M4, M5, M6, M3 (Attendance) <-> M5 (WhatsApp Gateway) (+5 more)

### Community 5 - "WhatsApp Gateway & Anti-Ban Queue"
Cohesion: 0.14
Nodes (13): 1. Alur Kerja Operasional Harian di Sekolah (Daily School SOP Workflow), 2. Peta Jalan Pengembangan Bertahap (Development Roadmap), 3. Panduan Konfigurasi Layanan Gratis (Zero-Cost Setup Guide), 4. Standar Git Workflow & Konvensi Kode, 5. Checklist Pengujian (Quality Assurance / Verification Checklist), Penanganan Kondisi Khusus (Edge Cases di Lapangan):, Phase 1: Foundation, Database Schema & Master Data (Minggu 1), Phase 2: Generator Kartu QR & Modul Absensi Dual-Layer (Minggu 2) (+5 more)

### Community 6 - "Parent Portal PWA & Activity Timeline"
Cohesion: 0.29
Nodes (7): 4. Spesifikasi Fitur Inti (Core Features Specification), Modul 1: Master Data & Generator Kartu QR (Admin), Modul 2: Absensi Dual-Layer (Gerbang & Kelas), Modul 3: Fitur Nilai & Bukti Mengikuti Pembelajaran (Academic & Engagement), Modul 4: Fitur Dokumentasi Pembelajaran (Proof of Activity), Modul 5: Rekapitulasi & Pelaporan Komprehensif (Recap & Analytics), Modul 6: Portal Orang Tua & Notifikasi WhatsApp

### Community 7 - "UI/UX Design Tokens & Typography"
Cohesion: 0.33
Nodes (6): 5.1 Dual-Layer Attendance Engine, 5.2 Anti-Fraud & Anti-Titip Absen Protocol, 5.3 Client-Side Photo Compression Pipeline, 5.4 Two-Tier Assessment & Grading Engine, 5.5 WhatsApp Gateway & Anti-Ban Architecture, 5. Strict Domain Rules & Business Logic Specifications

### Community 8 - "Project Governance & Roadmap"
Cohesion: 0.33
Nodes (6): Classroom Documentation Photo Feed, Emerald Primary & Slate UI Tokens, Large Face Photo Verification Pop-up, High-Contrast Kiosk QR Scanner Mode, Parent Portal PWA (Mobile-First), Client-Side WebP Compression (<180 KB)

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (5): 7.1 Parent Portal (Mobile PWA First), 7.2 Teacher & Wali Kelas Portal (Mobile / Tablet First), 7.3 Gate Kiosk Scanner Screen (High-Contrast Desktop / Tablet), 7.4 Admin & Recap Center (Desktop First), 7. Role-Based Navigation & Screen Specifications

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (5): Anti-Titip Absen Controls (5-Min Cooldown), In-Session Bolos (Skipping) Detection, Dual-Layer Attendance (Gate + Class), Signed HMAC-SHA256 QR Token, WhatsApp Anti-Ban Queue (4-10s Jitter)

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (3): Tier 1 Daily Engagement Badges (🌟, ✅, ⚠️, ❌), Tier 2 Formal Grading with KKM Mastery, Two-Tier Grading System

## Knowledge Gaps
- **8 isolated node(s):** `Supabase PostgreSQL Database`, `Signed HMAC-SHA256 QR Token`, `Client-Side WebP Compression (<180 KB)`, `WhatsApp Anti-Ban Queue (4-10s Jitter)`, `Large Face Photo Verification Pop-up` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 90 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SiHadir-Edu: Agent Constitution, Operational Architecture & UI/UX Governance` connect `Gate QR Scanner & Anti-Fraud Engine` to `Community 9`, `UI/UX Design Tokens & Typography`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `Supabase PostgreSQL Database`, `Signed HMAC-SHA256 QR Token`, `Client-Side WebP Compression (<180 KB)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `System Architecture & Supabase ERD` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `Product Requirements Document (PRD)` connect `Two-Tier Grading & Engagement Badges` to `Parent Portal PWA & Activity Timeline`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Gate QR Scanner & Anti-Fraud Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `5. Strict Domain Rules & Business Logic Specifications` connect `UI/UX Design Tokens & Typography` to `Gate QR Scanner & Anti-Fraud Engine`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `Classroom Rostering & Bolos Alerts` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._