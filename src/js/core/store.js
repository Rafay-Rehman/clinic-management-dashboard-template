/**
 * Client-side demo store. Pages read and write records through these
 * functions only, so replacing the store with real API calls later is a
 * contained change (see README → "Connecting a backend").
 */
import { app } from '../config/navigation.js';
import { generateDemoData } from '../data/mock-data.js';
import { todayKey } from './format.js';

function load() {
  if (!app.persistDemoData) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(app.storageKey));
    if (!saved) return null;
    // A new day: keep edited records, but rebuild the visit history so
    // "today's queue" stays current.
    if (saved.seededOn !== todayKey()) {
      const fresh = generateDemoData();
      const ids = new Set(saved.patients.map((p) => p.id));
      saved.visits = fresh.visits.filter((v) => ids.has(v.patientId));
      saved.seededOn = fresh.seededOn;
    }
    return saved;
  } catch {
    return null; // Storage blocked or corrupted — fall back to fresh data.
  }
}

let state = load() ?? generateDemoData();

function save() {
  document.dispatchEvent(new CustomEvent('store:change'));
  if (!app.persistDemoData) return;
  try {
    localStorage.setItem(app.storageKey, JSON.stringify(state));
  } catch {
    // Quota or privacy mode: the demo keeps working in memory.
  }
}

const PREFIX = { patients: 'PT', doctors: 'DR', diseases: 'DS', prescriptions: 'RX', visits: 'VS' };

function nextId(collection) {
  const nums = state[collection].map((r) => Number(r.id.split('-')[1]));
  const width = state[collection][0]?.id.split('-')[1].length ?? 3;
  return `${PREFIX[collection]}-${String(Math.max(0, ...nums) + 1).padStart(width, '0')}`;
}

export const list = (collection) => state[collection];

export const get = (collection, id) => state[collection].find((r) => r.id === id);

export function create(collection, record) {
  const created = { id: nextId(collection), ...record };
  state[collection].unshift(created);
  save();
  return created;
}

export function update(collection, id, patch) {
  const record = get(collection, id);
  Object.assign(record, patch);
  save();
  return record;
}

export function remove(collection, id) {
  state[collection] = state[collection].filter((r) => r.id !== id);
  // Removing a patient also removes their visits and prescriptions.
  if (collection === 'patients') {
    state.visits = state.visits.filter((v) => v.patientId !== id);
    state.prescriptions = state.prescriptions.filter((p) => p.patientId !== id);
  }
  save();
}

export function resetDemoData() {
  try {
    localStorage.removeItem(app.storageKey);
  } catch {
    /* ignore */
  }
  state = generateDemoData();
  save();
}

/* ---------- Lookups shared by several pages ---------- */

export const patientName = (p) => (p ? `${p.firstName} ${p.lastName}` : 'Removed patient');

export const patientById = (id) => get('patients', id);
export const doctorById = (id) => get('doctors', id);
export const diseaseById = (id) => get('diseases', id);

export const todaysVisits = () => {
  const today = todayKey();
  return state.visits.filter((v) => v.date === today).sort((a, b) => a.time.localeCompare(b.time));
};

/** Display status for a doctor: live queue state overrides their roster status. */
export function doctorStatus(doctor) {
  if (doctor.availability !== 'Available') return doctor.availability;
  return todaysVisits().some((v) => v.doctorId === doctor.id && v.status === 'In consultation') ? 'In consultation' : 'Available';
}
