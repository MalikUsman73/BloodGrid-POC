import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './ui/Layout';
import { Method } from './screens/Method';
import { NewRequest } from './screens/NewRequest';
import { RequestDetail } from './screens/RequestDetail';
import { Requests } from './screens/Requests';
import { AppProvider } from './state/AppContext';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/new" replace />} />
            <Route path="new" element={<NewRequest />} />
            <Route path="requests" element={<Requests />} />
            <Route path="requests/:id" element={<RequestDetail />} />
            <Route path="method" element={<Method />} />
            <Route path="*" element={<Navigate to="/new" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
