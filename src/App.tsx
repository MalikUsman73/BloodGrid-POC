import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { homeFor } from './auth/roles';
import type { Role } from './auth/types';
import { Home as DonorHome } from './screens/donor/Home';
import { History as DonorHistory } from './screens/donor/History';
import { Profile as DonorProfile } from './screens/donor/Profile';
import { BankSoon } from './screens/public/BankSoon';
import { Landing } from './screens/public/Landing';
import { Login } from './screens/public/Login';
import { Signup } from './screens/public/Signup';
import { Dashboard } from './screens/recipient/Dashboard';
import { HowItWorks } from './screens/recipient/HowItWorks';
import { NewRequest } from './screens/recipient/NewRequest';
import { Patients } from './screens/recipient/Patients';
import { RequestDetail } from './screens/recipient/RequestDetail';
import { Requests } from './screens/recipient/Requests';
import { AppProvider, useApp } from './state/AppContext';
import { SessionProvider, useSession } from './state/Session';
import { AppShell, type NavItem } from './ui/AppShell';
import { IconBook, IconHome, IconList, IconPlus, IconUser, IconUsers } from './ui/icons';
import { ToastProvider } from './ui/Toast';

const DONOR_NAV: NavItem[] = [
  { to: '/donor', label: 'Home', icon: IconHome, end: true },
  { to: '/donor/history', label: 'History', icon: IconList },
  { to: '/donor/profile', label: 'Profile', icon: IconUser },
];

const RECIPIENT_NAV: NavItem[] = [
  { to: '/recipient', label: 'Overview', icon: IconHome, end: true },
  { to: '/recipient/new', label: 'New request', icon: IconPlus },
  { to: '/recipient/requests', label: 'Requests', icon: IconList },
  { to: '/recipient/patients', label: 'Patients', icon: IconUsers },
  { to: '/recipient/how-it-works', label: 'How it works', icon: IconBook },
];

/** Keeps each area to the role that owns it. The database enforces the same rule; this only routes. */
function RequireRole({ role }: { role: Role }) {
  const { ready } = useApp();
  const { profile, loading } = useSession();
  if (!ready || loading) {
    return <div className="state" style={{ minHeight: '100vh', alignContent: 'center' }} aria-busy="true">Loading…</div>;
  }
  if (!profile) return <Navigate to={`/login?role=${role}`} replace />;
  if (profile.role !== role) return <Navigate to={homeFor(profile.role)} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AppProvider>
      <SessionProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              <Route index element={<Landing />} />
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />
              <Route path="bank" element={<BankSoon />} />

              <Route element={<RequireRole role="donor" />}>
                <Route path="donor" element={<AppShell items={DONOR_NAV} roleLabel="Donor" />}>
                  <Route index element={<DonorHome />} />
                  <Route path="history" element={<DonorHistory />} />
                  <Route path="profile" element={<DonorProfile />} />
                </Route>
              </Route>

              <Route element={<RequireRole role="recipient" />}>
                <Route path="recipient" element={<AppShell items={RECIPIENT_NAV} roleLabel="Recipient" />}>
                  <Route index element={<Dashboard />} />
                  <Route path="new" element={<NewRequest />} />
                  <Route path="requests" element={<Requests />} />
                  <Route path="requests/:id" element={<RequestDetail />} />
                  <Route path="patients" element={<Patients />} />
                  <Route path="how-it-works" element={<HowItWorks />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </ToastProvider>
      </SessionProvider>
    </AppProvider>
  );
}
