// Date + number helpers. Dates are stored as local `YYYY-MM-DD` strings.

export const pad = (n) => String(n).padStart(2, '0');

export const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toDateKey(new Date());

export const addDays = (key, days) => {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

export const daysBetween = (a, b) => Math.round((fromDateKey(b) - fromDateKey(a)) / 86400000);

const dateFmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDate = (key) => (key ? dateFmt.format(fromDateKey(key)) : '—');
export const formatShortDate = (key) => shortFmt.format(fromDateKey(key));
export const formatLongDate = (key) => longFmt.format(fromDateKey(key));

export const formatTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};

export const ageFrom = (dob, today = todayKey()) => {
  const b = fromDateKey(dob);
  const t = fromDateKey(today);
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age;
};

export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n);

export const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

export const initials = (name) =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export const relativeTime = (date) => {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};
