/**
 * Icon registry. Icons come from Lucide (ISC licence, see README) and are
 * tree-shaken at build time — import only what you register here.
 *
 * Usage: icon('users')  or  icon('users', 'size-5')
 */
import {
  Activity, ArrowDown, ArrowUp, ArrowUpDown, Bell, Calendar, ChartColumn, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, CircleCheck, CircleSlash, ClipboardPlus, Clock, DoorOpen, Download, Eye, FileText,
  Hourglass, Info, ListFilter, Mail, Menu, Microscope, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Pencil,
  Phone, Pill, Play, Plus, Printer, RotateCcw, Save, Search, SearchX, Stethoscope, Sun, Trash2, TriangleAlert,
  UserCheck, UserPlus, Users, X,
} from 'lucide';
import { raw } from './dom.js';

// Custom mark for the Clinic module (stands in for the host ERP's Clinic.svg).
const Clinic = [
  ['path', { d: 'M4 21V8.5a1 1 0 0 1 .55-.9l7-3.5a1 1 0 0 1 .9 0l7 3.5a1 1 0 0 1 .55.9V21' }],
  ['path', { d: 'M2 21h20' }],
  ['path', { d: 'M12 9v6' }],
  ['path', { d: 'M9 12h6' }],
];

const registry = {
  activity: Activity,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  sort: ArrowUpDown,
  bell: Bell,
  calendar: Calendar,
  chart: ChartColumn,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  alert: CircleAlert,
  success: CircleCheck,
  'no-show': CircleSlash,
  clinic: Clinic,
  clipboard: ClipboardPlus,
  clock: Clock,
  door: DoorOpen,
  download: Download,
  eye: Eye,
  file: FileText,
  waiting: Hourglass,
  info: Info,
  filter: ListFilter,
  mail: Mail,
  menu: Menu,
  microscope: Microscope,
  monitor: Monitor,
  moon: Moon,
  'panel-close': PanelLeftClose,
  'panel-open': PanelLeftOpen,
  pencil: Pencil,
  phone: Phone,
  pill: Pill,
  play: Play,
  plus: Plus,
  printer: Printer,
  reset: RotateCcw,
  save: Save,
  search: Search,
  'search-empty': SearchX,
  stethoscope: Stethoscope,
  sun: Sun,
  trash: Trash2,
  warning: TriangleAlert,
  'user-check': UserCheck,
  'user-plus': UserPlus,
  users: Users,
  close: X,
};

const toMarkup = (node) =>
  node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');

const cache = new Map();

export function icon(name, className = 'icon') {
  const node = registry[name];
  if (!node) throw new Error(`Unknown icon "${name}"`);
  if (!cache.has(name)) cache.set(name, toMarkup(node));
  return raw(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true" focusable="false">${cache.get(name)}</svg>`,
  );
}
