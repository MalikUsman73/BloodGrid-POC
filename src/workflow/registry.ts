/** A hospital that can issue blood prescriptions. Synthetic: names are fictional, sectors are real. */
export interface Hospital {
  id: string;
  name: string;
  sector: string;
}

/** A doctor on the synthetic registry sample, standing in for the PMDC register. */
export interface RegisteredDoctor {
  pmdc: string;
  name: string;
  hospitalId: string;
}

export type BankKind = 'Government' | 'Non-profit' | 'Hospital';

/** A registered blood bank. Seekers are shown the ones nearby when a request is critical, to contact directly. */
export interface BloodBank {
  id: string;
  name: string;
  sector: string;
  kind: BankKind;
}

export const HOSPITALS: Hospital[] = [
  { id: 'H-CGH', name: 'Capital General Hospital', sector: 'G-8' },
  { id: 'H-FMC', name: 'Federal Medical Complex', sector: 'G-6' },
  { id: 'H-NCH', name: 'North City Hospital', sector: 'F-8' },
  { id: 'H-EMC', name: 'E-11 Medical Centre', sector: 'E-11' },
  { id: 'H-MCH', name: 'Margalla Children’s Hospital', sector: 'H-8' },
  { id: 'H-SWH', name: 'Southwest Hospital', sector: 'I-10' },
  { id: 'H-WMC', name: 'West Medical Centre', sector: 'G-11' },
];

export const DOCTORS: RegisteredDoctor[] = [
  { pmdc: '10234-P', name: 'Dr. Sana Malik', hospitalId: 'H-CGH' },
  { pmdc: '20871-P', name: 'Dr. Imran Qureshi', hospitalId: 'H-CGH' },
  { pmdc: '31455-F', name: 'Dr. Ayesha Khan', hospitalId: 'H-FMC' },
  { pmdc: '44120-F', name: 'Dr. Bilal Ahmed', hospitalId: 'H-FMC' },
  { pmdc: '52309-P', name: 'Dr. Hira Javed', hospitalId: 'H-NCH' },
  { pmdc: '60117-K', name: 'Dr. Usama Raza', hospitalId: 'H-EMC' },
  { pmdc: '71842-P', name: 'Dr. Mehwish Tariq', hospitalId: 'H-MCH' },
  { pmdc: '83306-S', name: 'Dr. Faisal Iqbal', hospitalId: 'H-SWH' },
  { pmdc: '94518-P', name: 'Dr. Nadia Hussain', hospitalId: 'H-WMC' },
  { pmdc: '15562-B', name: 'Dr. Kamran Shah', hospitalId: 'H-WMC' },
];

export const BLOOD_BANKS: BloodBank[] = [
  { id: 'BB-CRBC', name: 'Central Regional Blood Centre', sector: 'G-7', kind: 'Government' },
  { id: 'BB-NBT', name: 'Northern Blood Trust', sector: 'F-7', kind: 'Non-profit' },
  { id: 'BB-CGH', name: 'Capital General Hospital Blood Bank', sector: 'G-8', kind: 'Hospital' },
  { id: 'BB-SBS', name: 'Southern Blood Services', sector: 'I-9', kind: 'Non-profit' },
];

const hospitalById = new Map(HOSPITALS.map((h) => [h.id, h]));
const bankById = new Map(BLOOD_BANKS.map((b) => [b.id, b]));
const doctorByPmdc = new Map(DOCTORS.map((d) => [d.pmdc, d]));

export const findHospital = (id: string): Hospital | undefined => hospitalById.get(id);
export const findBank = (id: string): BloodBank | undefined => bankById.get(id);
export const findDoctor = (pmdc: string): RegisteredDoctor | undefined => doctorByPmdc.get(pmdc.trim().toUpperCase());
