import { ReportsMap } from '../types/report';

export const DISEASE_PRESETS: string[] = [
  'J00 โรคหวัดเฉียบพลัน (Acute Nasopharyngitis)',
  'I10 ความดันโลหิตสูง (Essential Hypertension)',
  'E11 เบาหวานชนิดที่ 2 (Type 2 Diabetes Mellitus)',
  'K30 อาการอาหารไม่ย่อย/โรคกระเพาะ (Dyspepsia)',
  'M79.1 ปวดกล้ามเนื้อ (Myalgia)',
  'E78.5 ไขมันในเลือดสูง (Hyperlipidemia)',
  'A09 อุจจาระร่วงเฉียบพลัน (Acute Diarrhea)',
  'J30.4 จมูกอักเสบจากภูมิแพ้ (Allergic Rhinitis)',
  'M54.5 ปวดหลังส่วนล่าง (Low Back Pain)',
  'R51 อาการปวดศีรษะ (Headache)',
  'L30.9 ผิวหนังอักเสบ (Dermatitis)',
  'J02.9 คออักเสบเฉียบพลัน (Acute Pharyngitis)',
];

export const PROCEDURE_PRESETS: string[] = [
  'Dressing ทำแผลทั่วไป / ล้างแผล',
  'DTX เจาะตรวจระดับน้ำตาลปลายนิ้ว',
  'Injection ฉีดยา (IM / IV / SC)',
  'Nebulizer พ่นยาขยายหลอดลม',
  'EKG ตรวจคลื่นไฟฟ้าหัวใจ 12 ลีด',
  'Suture / Off Suture เย็บแผลและตัดไหม',
  'IV Fluid ให้สารน้ำทางหลอดเลือดดำ',
  'Eye/Ear Irrigation ล้างตา / ล้างหู',
  'Vaccination ฉีดวัคซีนป้องกันโรค',
];

export const INITIAL_REPORTS_DATA: ReportsMap = {};
