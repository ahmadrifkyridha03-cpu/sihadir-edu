/**
 * School Administrative Profile Configuration for Official Indonesian Reports & Documents.
 * Adheres to Permendikbud & Pergub Tata Naskah Dinas Pendidikan.
 */

export interface SchoolProfileConfig {
  governingBody: string; // e.g. "PEMERINTAH DAERAH PROVINSI JAWA BARAT"
  educationDepartment: string; // e.g. "DINAS PENDIDIKAN"
  regionalBranch: string; // e.g. "CABANG DINAS PENDIDIKAN WILAYAH VII"
  schoolName: string; // e.g. "SMA NEGERI 1 HARAPAN BANGSA"
  npsn: string; // e.g. "20219876"
  address: string; // e.g. "Jalan Pendidikan No. 45, Sukajadi, Kota Bandung"
  city: string; // e.g. "Kota Bandung"
  postalCode: string; // e.g. "40162"
  phone: string; // e.g. "(022) 2031234"
  email: string; // e.g. "info@sman1harapanbangsa.sch.id"
  website: string; // e.g. "https://sman1harapanbangsa.sch.id"
  principalName: string; // e.g. "Dr. H. Ahmad Sanusi, M.Pd."
  principalNip: string; // e.g. "19680315 199203 1 004"
  logoUrl?: string;
  regionalLogoUrl?: string;
}

export const DEFAULT_SCHOOL_PROFILE: SchoolProfileConfig = {
  governingBody:
    process.env.SCHOOL_GOVERNING_BODY || 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
  educationDepartment:
    process.env.SCHOOL_EDUCATION_DEPT || 'DINAS PENDIDIKAN',
  regionalBranch:
    process.env.SCHOOL_REGIONAL_BRANCH || 'CABANG DINAS PENDIDIKAN WILAYAH VII',
  schoolName:
    process.env.SCHOOL_NAME || 'SMA NEGERI 1 HARAPAN BANGSA',
  npsn: process.env.SCHOOL_NPSN || '20219876',
  address:
    process.env.SCHOOL_ADDRESS || 'Jalan Pendidikan No. 45, Sukajadi, Kota Bandung',
  city: process.env.SCHOOL_CITY || 'Kota Bandung',
  postalCode: process.env.SCHOOL_POSTAL_CODE || '40162',
  phone: process.env.SCHOOL_PHONE || '(022) 2031234',
  email: process.env.SCHOOL_EMAIL || 'info@sman1harapanbangsa.sch.id',
  website: process.env.SCHOOL_WEBSITE || 'https://sman1harapanbangsa.sch.id',
  principalName:
    process.env.SCHOOL_PRINCIPAL_NAME || 'Dr. H. Ahmad Sanusi, M.Pd.',
  principalNip:
    process.env.SCHOOL_PRINCIPAL_NIP || '19680315 199203 1 004',
};

export function getSchoolProfile(): SchoolProfileConfig {
  return { ...DEFAULT_SCHOOL_PROFILE };
}
