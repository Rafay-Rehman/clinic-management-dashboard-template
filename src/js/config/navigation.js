/**
 * Navigation + app configuration.
 *
 * `href`  — the page inside this template (relative to /pages).
 * `route` — the matching route in a host application. Swap `href` for `route`
 *           when you wire the template into a real backend.
 */
export const app = {
  name: 'Pinewell',
  tagline: 'Clinic administration',
  // Keep demo edits in localStorage between reloads. Set to false for a
  // fresh dataset on every page load. Only fictional demo data is stored.
  persistDemoData: true,
  storageKey: 'pinewell-demo-state-v1',
};

export const currentUser = {
  name: 'Nadia Haddad',
  role: 'Clinic administrator',
  email: 'nadia.haddad@example.com',
};

export const navigation = [
  {
    id: 'clinic',
    label: 'Clinic',
    icon: 'clinic',
    items: [
      { id: 'patient-desk', label: 'Patient Desk', icon: 'clipboard', href: 'patient-desk.html', route: '/admin/clinic/patient_desk' },
      { id: 'patients', label: 'Patients', icon: 'users', href: 'patients.html', route: '/admin/clinic/patients' },
      { id: 'diseases', label: 'Diseases', icon: 'microscope', href: 'diseases.html', route: '/admin/clinic/diseases' },
      { id: 'doctors', label: 'Doctors', icon: 'stethoscope', href: 'doctors.html', route: '/admin/clinic/doctors' },
      { id: 'prescriptions', label: 'Prescriptions', icon: 'pill', href: 'prescriptions.html', route: '/admin/clinic/prescriptions' },
      { id: 'reports', label: 'Reports', icon: 'chart', href: 'reports.html', route: '/admin/clinic/reports' },
    ],
  },
];

export const findNavItem = (id) => navigation.flatMap((g) => g.items).find((i) => i.id === id);
