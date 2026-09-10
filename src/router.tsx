import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Landing from './screens/Landing';
import RoleSelect from './screens/RoleSelect';
import Conversation from './screens/Conversation';

import SeekerOverview from './screens/seeker/Overview';
import CreateRequest from './screens/seeker/CreateRequest';
import Matching from './screens/seeker/Matching';
import MatchResults from './screens/seeker/MatchResults';
import DonorDetail from './screens/seeker/DonorDetail';
import RequestSent from './screens/seeker/RequestSent';
import MyRequests from './screens/seeker/MyRequests';

import DonorOverview from './screens/donor/Overview';
import IncomingRequests from './screens/donor/IncomingRequests';

import BankOverview from './screens/bank/Overview';
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
      { path: '/seeker', element: <SeekerOverview /> },
      { path: '/seeker/request/new', element: <CreateRequest /> },
      { path: '/seeker/request/:id/matching', element: <Matching /> },
      { path: '/seeker/request/:id/matches', element: <MatchResults /> },
      { path: '/seeker/request/:id/donor/:donorId', element: <DonorDetail /> },
      { path: '/seeker/request/:id/sent/:donorId', element: <RequestSent /> },
      { path: '/seeker/request/:id/conversation/:donorId', element: <Conversation viewer="seeker" /> },
      { path: '/seeker/requests', element: <MyRequests /> },

      { path: '/donor', element: <DonorOverview /> },
      { path: '/donor/requests', element: <IncomingRequests /> },
      { path: '/donor/requests/:id/conversation', element: <Conversation viewer="donor" /> },

      { path: '/bank', element: <BankOverview /> },
      { path: '/bank/demand', element: <DemandForecast /> },
      { path: '/bank/planning', element: <Planning /> },
      { path: '/bank/outreach', element: <Outreach /> },
      { path: '/bank/coordination', element: <Coordination /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
