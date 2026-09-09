import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Landing from './screens/Landing';
import RoleSelect from './screens/RoleSelect';

import SeekerDashboard from './screens/seeker/Dashboard';
import CreateRequest from './screens/seeker/CreateRequest';
import Matching from './screens/seeker/Matching';
import MatchResults from './screens/seeker/MatchResults';
import DonorDetail from './screens/seeker/DonorDetail';
import Confirmation from './screens/seeker/Confirmation';
import MyRequests from './screens/seeker/MyRequests';

import DonorDashboard from './screens/donor/Dashboard';
import IncomingRequests from './screens/donor/IncomingRequests';

import BankDashboard from './screens/bank/Dashboard';
import DemandForecast from './screens/bank/DemandForecast';
import Planning from './screens/bank/Planning';
import Outreach from './screens/bank/Outreach';
import Coordination from './screens/bank/Coordination';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/enter', element: <RoleSelect /> },
  {
    element: <AppShell />,
    children: [
      // Individual — blood seeker
      { path: '/seeker', element: <SeekerDashboard /> },
      { path: '/seeker/request/new', element: <CreateRequest /> },
      { path: '/seeker/request/:id/matching', element: <Matching /> },
      { path: '/seeker/request/:id/matches', element: <MatchResults /> },
      { path: '/seeker/request/:id/donor/:donorId', element: <DonorDetail /> },
      { path: '/seeker/request/:id/sent', element: <Confirmation /> },
      { path: '/seeker/requests', element: <MyRequests /> },

      // Individual — donor (Tier 2)
      { path: '/donor', element: <DonorDashboard /> },
      { path: '/donor/requests', element: <IncomingRequests /> },

      // Blood bank
      { path: '/bank', element: <BankDashboard /> },
      { path: '/bank/demand', element: <DemandForecast /> },
      { path: '/bank/planning', element: <Planning /> },
      { path: '/bank/outreach', element: <Outreach /> },
      { path: '/bank/coordination', element: <Coordination /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
