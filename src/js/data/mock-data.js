/**
 * Fictional demo dataset.
 *
 * Every person, phone number (555-01xx), e-mail (example.com), medication
 * and record below is invented for demonstration. Nothing here is real
 * patient data or clinical guidance.
 *
 * The data is generated from a fixed seed relative to today's date, so the
 * dashboard always looks "live" while staying internally consistent:
 * summary cards, charts, tables and reports all read the same records.
 */
import { addDays, pad, todayKey } from '../core/format.js';

const SEED = 20261019;
const HISTORY_DAYS = 180;
const PATIENT_COUNT = 640;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEMALE = ['Amara', 'Chloe', 'Fatima', 'Hannah', 'Isabella', 'Jasmine', 'Keiko', 'Layla', 'Maya', 'Olivia', 'Priya', 'Rosa', 'Sara', 'Tara', 'Valentina', 'Yara', 'Zoe', 'Ingrid', 'Aisha', 'Mei', 'Lucia', 'Noor', 'Ella', 'Freya', 'Imani', 'June', 'Leila', 'Nina', 'Ava', 'Elena'];
const MALE = ['Adrian', 'Bilal', 'Carlos', 'Daniel', 'Elias', 'Felix', 'Gabriel', 'Hamza', 'Ivan', 'Jonah', 'Kenji', 'Leo', 'Marcus', 'Nikhil', 'Omar', 'Pablo', 'Rafael', 'Samir', 'Theo', 'Victor', 'Yusuf', 'Ethan', 'Kwame', 'Luca', 'Mateus', 'Arjun', 'Oscar', 'Idris', 'Hugo', 'Ben'];
const LAST = ['Abbott', 'Alvarez', 'Bauer', 'Chen', 'Costa', 'Dubois', 'Eriksen', 'Farah', 'Fischer', 'Garcia', 'Hassan', 'Ito', 'Jensen', 'Kaur', 'Kowalski', 'Laurent', 'Lim', 'Mendes', 'Moreau', 'Nakamura', 'Novak', 'Okoye', 'Olsen', 'Patel', 'Petrov', 'Quinn', 'Rahman', 'Rossi', 'Santos', 'Schmidt', 'Silva', 'Tanaka', 'Torres', 'Usman', 'Vargas', 'Walsh', 'Wong', 'Yilmaz', 'Zhang', 'Adeyemi', 'Bianchi', 'Castillo', 'Delgado', 'Ekström', 'Fontaine', 'Gupta', 'Hoang', 'Iqbal', 'Kim', 'Mensah'];

const DOCTORS = [
  ['Leah Okafor', 'General practice', 'Available', 'Room 101'],
  ['Mateo Ruiz', 'Cardiology', 'Available', 'Room 204'],
  ['Priya Raman', 'Pediatrics', 'Available', 'Room 112'],
  ['Henrik Sørensen', 'Dermatology', 'Available', 'Room 118'],
  ['Amina Yusuf', 'Endocrinology', 'Available', 'Room 206'],
  ['Samuel Achebe', 'General practice', 'Available', 'Room 102'],
  ['Hana Kobayashi', 'Neurology', 'On leave', 'Room 210'],
  ['Lucas Bernard', 'Orthopedics', 'Available', 'Room 120'],
  ['Sofia Marchetti', 'Gynecology', 'Available', 'Room 214'],
  ['Daniel Weiss', 'ENT', 'Off duty', 'Room 116'],
  ['Zara Qureshi', 'Psychiatry', 'Available', 'Room 218'],
  ['Tomás Ferreira', 'Pulmonology', 'Available', 'Room 208'],
  ['Elif Demir', 'Gastroenterology', 'Available', 'Room 212'],
  ['Grace Mensah', 'Pediatrics', 'Off duty', 'Room 114'],
];

// Codes follow the public ICD-10 pattern for realism only. This sample list is
// not a complete or clinically authoritative reference.
const DISEASES = [
  ['I10', 'Essential hypertension', 'Cardiovascular', 'Persistently raised blood pressure without an identified secondary cause.', 'Cardiology'],
  ['E78.5', 'Hyperlipidaemia', 'Cardiovascular', 'Raised blood lipid levels, typically identified on routine screening.', 'Cardiology'],
  ['E11.9', 'Type 2 diabetes mellitus', 'Endocrine', 'Chronic condition affecting how the body regulates blood glucose.', 'Endocrinology'],
  ['E03.9', 'Hypothyroidism', 'Endocrine', 'Underactive thyroid gland producing too little thyroid hormone.', 'Endocrinology'],
  ['E55.9', 'Vitamin D deficiency', 'Endocrine', 'Low vitamin D levels found on blood testing.', 'General practice'],
  ['J06.9', 'Upper respiratory infection', 'Respiratory', 'Acute infection of the nose, sinuses or throat.', 'General practice'],
  ['J45.9', 'Asthma', 'Respiratory', 'Chronic airway inflammation causing episodes of wheeze and breathlessness.', 'Pulmonology'],
  ['J11.1', 'Influenza', 'Respiratory', 'Seasonal viral infection with fever, aches and respiratory symptoms.', 'General practice'],
  ['J30.9', 'Allergic rhinitis', 'Respiratory', 'Nasal inflammation triggered by airborne allergens.', 'ENT'],
  ['G43.9', 'Migraine', 'Neurological', 'Recurrent headaches, often one-sided and with sensitivity to light.', 'Neurology'],
  ['G47.0', 'Insomnia', 'Neurological', 'Persistent difficulty falling or staying asleep.', 'Psychiatry'],
  ['K21.9', 'Gastro-oesophageal reflux', 'Digestive', 'Stomach acid flowing back into the oesophagus causing heartburn.', 'Gastroenterology'],
  ['A09', 'Gastroenteritis', 'Digestive', 'Inflammation of the stomach and intestines, usually infectious.', 'General practice'],
  ['K58.9', 'Irritable bowel syndrome', 'Digestive', 'Functional bowel disorder with recurring abdominal discomfort.', 'Gastroenterology'],
  ['M54.5', 'Low back pain', 'Musculoskeletal', 'Pain in the lower back, commonly mechanical in origin.', 'Orthopedics'],
  ['M17.9', 'Osteoarthritis of knee', 'Musculoskeletal', 'Degenerative joint condition causing knee pain and stiffness.', 'Orthopedics'],
  ['F41.1', 'Generalised anxiety disorder', 'Mental health', 'Persistent, excessive worry affecting daily functioning.', 'Psychiatry'],
  ['F32.9', 'Depressive episode', 'Mental health', 'Low mood and loss of interest lasting two weeks or more.', 'Psychiatry'],
  ['L20.9', 'Atopic dermatitis', 'Dermatology', 'Chronic itchy inflammation of the skin, often starting in childhood.', 'Dermatology'],
  ['L70.0', 'Acne vulgaris', 'Dermatology', 'Common skin condition involving blocked and inflamed hair follicles.', 'Dermatology'],
  ['H66.9', 'Otitis media', 'ENT & eye', 'Middle ear infection, most frequent in young children.', 'Pediatrics'],
  ['H10.9', 'Conjunctivitis', 'ENT & eye', 'Inflammation of the conjunctiva causing red, irritated eyes.', 'General practice'],
  ['D50.9', 'Iron deficiency anaemia', 'Haematology', 'Reduced red blood cells due to insufficient iron.', 'General practice'],
  ['N39.0', 'Urinary tract infection', 'Urinary', 'Bacterial infection of the urinary tract.', 'Gynecology'],
  ['B34.9', 'Viral syndrome, unspecified', 'Infectious', 'General viral illness without a more specific diagnosis.', 'General practice'],
];

// Invented medication names — swap for your own formulary.
export const MEDICATIONS = [
  'Velmora 500 mg tablet', 'Cindrel 10 mg tablet', 'Ostravin 250 mg capsule', 'Palucet 500 mg tablet',
  'Norvexa 20 mg tablet', 'Tamiril 5 mg tablet', 'Quenzol 40 mg capsule', 'Lorabine 10 mg tablet',
  'Zentrocin 250 mg tablet', 'Dovanex cream 0.1%', 'Selvira 50 mg tablet', 'Brenolin inhaler 100 mcg',
  'Aurexol syrup 5 mg/5 ml', 'Kelvane 1000 IU capsule', 'Miradol eye drops',
];
export const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'At bedtime', 'As needed'];
export const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '30 days', '90 days'];
const INSTRUCTIONS = ['Take after meals', 'Take with water', 'Avoid alcohol', 'Apply a thin layer', 'Take in the morning', ''];
// A dosage that matches the medication's form.
const dosageFor = (medication) =>
  [['tablet', '1 tablet'], ['capsule', '1 capsule'], ['cream', 'Thin layer'], ['inhaler', '2 puffs'], ['syrup', '5 ml'], ['drops', '1 drop']]
    .find(([form]) => medication.includes(form))?.[1] ?? '1 dose';
const VISIT_REASONS = ['General consultation', 'Follow-up', 'Annual check-up', 'Lab review', 'Prescription renewal', 'Vaccination'];

/**
 * The clinic's "current time". Inside opening hours (08:30–17:30) it is the
 * real clock. Outside them the demo pins the clock to 11:40 so the queue
 * always shows a working day; the UI labels this as demo time.
 */
export function clinicClock() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = minutes >= 8 * 60 + 30 && minutes <= 17 * 60 + 30;
  return { minutes: open ? minutes : 11 * 60 + 40, simulated: !open };
}

// "Tomás Ferreira" -> "tomas.ferreira"
const slug = (name) => name.replace(/ø/g, 'o').normalize('NFD').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.');

export function generateDemoData(today = todayKey()) {
  const rand = mulberry32(SEED);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const phone = () => `+1 555-01${pad(int(0, 99))}`;

  const doctors = DOCTORS.map(([name, specialty, availability, room], i) => ({
    id: `DR-${String(i + 1).padStart(3, '0')}`,
    name: `Dr. ${name}`,
    specialty,
    availability,
    room,
    phone: phone(),
    email: `${slug(name)}@pinewell.example.com`,
    joinedOn: addDays(today, -int(200, 2800)),
  }));

  const diseases = DISEASES.map(([code, name, category, description, specialty], i) => ({
    id: `DS-${String(i + 1).padStart(3, '0')}`,
    code,
    name,
    category,
    description,
    specialty,
    status: i === 24 ? 'Archived' : 'Active',
  }));

  const AGE_BANDS = [[1, 12, 12], [13, 17, 6], [18, 34, 28], [35, 49, 24], [50, 64, 18], [65, 88, 12]];
  const weightedAge = () => {
    let r = rand() * 100;
    for (const [min, max, w] of AGE_BANDS) {
      if ((r -= w) <= 0) return int(min, max);
    }
    return 40;
  };

  const patients = Array.from({ length: PATIENT_COUNT }, (_, i) => {
    const gender = rand() < 0.52 ? 'Female' : 'Male';
    const first = pick(gender === 'Female' ? FEMALE : MALE);
    const last = pick(LAST);
    const age = weightedAge();
    const dob = addDays(today, -(age * 365 + int(10, 350)));
    // ~45% registered more than a year ago, the rest spread over the last year.
    const registeredOn = rand() < 0.45 ? addDays(today, -int(366, 1100)) : addDays(today, -int(0, 365));
    return {
      id: `PT-${10001 + i}`,
      firstName: first,
      lastName: last,
      dob,
      gender,
      phone: phone(),
      email: `${slug(`${first} ${last}`)}${int(1, 99)}@example.com`,
      registeredOn,
      status: 'Active',
    };
  });

  // Visits — daily volume with a weekly rhythm and a gentle upward trend.
  const activeDoctors = doctors.filter((d) => d.availability === 'Available');
  const visits = [];
  let visitSeq = 1;
  const nowMins = clinicClock().minutes;

  for (let offset = -HISTORY_DAYS; offset <= 0; offset++) {
    const date = addDays(today, offset);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const base = 19 + (offset + HISTORY_DAYS) * 0.03;
    const factor = weekday === 0 ? 0.45 : weekday === 6 ? 0.7 : 1;
    const count = offset === 0 ? 24 : Math.max(4, Math.round(base * factor + (rand() - 0.5) * 8));
    const eligible = patients.filter((p) => p.registeredOn <= date);
    const doctorPool = offset === 0 ? activeDoctors : doctors;

    for (let n = 0; n < count; n++) {
      const slot = 8 * 60 + 30 + Math.floor((n / count) * 9 * 60) + int(0, 2) * 5;
      const time = `${pad(Math.floor(slot / 60))}:${pad(slot % 60)}`;
      const doctor = pick(doctorPool);
      const related = diseases.filter((d) => d.specialty === doctor.specialty && d.status === 'Active');
      const diagnosis = related.length && rand() < 0.7 ? pick(related) : null;

      let status = 'Completed';
      if (offset < 0) {
        const r = rand();
        status = r < 0.06 ? 'No-show' : r < 0.1 ? 'Cancelled' : 'Completed';
      } else if (slot <= nowMins - 30) {
        status = rand() < 0.08 ? 'No-show' : 'Completed';
      } else if (slot <= nowMins) {
        status = visits.some((v) => v.date === date && v.doctorId === doctor.id && v.status === 'In consultation') ? 'Waiting' : 'In consultation';
      } else {
        status = slot <= nowMins + 45 && rand() < 0.6 ? 'Waiting' : 'Scheduled';
      }

      visits.push({
        id: `VS-${String(visitSeq++).padStart(5, '0')}`,
        patientId: pick(eligible).id,
        doctorId: doctor.id,
        date,
        time,
        reason: diagnosis ? diagnosis.name : pick(VISIT_REASONS),
        diagnosisId: diagnosis?.id ?? null,
        status,
      });
    }
  }

  // Patient status follows their visit history.
  const lastVisit = new Map();
  for (const v of visits) if (v.status === 'Completed') lastVisit.set(v.patientId, v.date);
  for (const p of patients) {
    const last = lastVisit.get(p.id);
    if (p.registeredOn < addDays(today, -365) && (!last || last < addDays(today, -90))) p.status = 'Inactive';
    else if (last && last >= addDays(today, -14) && rand() < 0.3) p.status = 'Follow-up';
  }

  // Prescriptions — issued at roughly a third of completed visits in the last 120 days.
  const prescriptions = [];
  let rxSeq = 24001;
  for (const v of visits) {
    if (v.status !== 'Completed' || v.date < addDays(today, -120) || rand() > 0.33) continue;
    const age = Math.round((new Date(`${today}T12:00:00`) - new Date(`${v.date}T12:00:00`)) / 86400000);
    const r = rand();
    let status = 'Completed';
    if (age <= 2 && r < 0.5) status = 'Draft';
    else if (age <= 10) status = 'Issued';
    else if (r < 0.04) status = 'Cancelled';
    prescriptions.push({
      id: `RX-${rxSeq++}`,
      patientId: v.patientId,
      doctorId: v.doctorId,
      diagnosisId: v.diagnosisId,
      date: v.date,
      status,
      items: Array.from({ length: int(1, 3) }, () => pick(MEDICATIONS)).map((medication) => ({
        medication,
        dosage: dosageFor(medication),
        frequency: pick(FREQUENCIES),
        duration: pick(DURATIONS),
        instructions: pick(INSTRUCTIONS),
      })),
      notes: '',
    });
  }

  return {
    seededOn: today,
    patients,
    doctors,
    diseases,
    visits,
    prescriptions,
  };
}
