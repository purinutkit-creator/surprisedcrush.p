import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { GiftLoader } from './visitor/components/GiftLoader';
import ConfessionPage from './visitor/pages/Confession';
import MainFlow from './visitor/MainFlow';
import VisitorShell from './visitor/VisitorShell';

// The admin bundle (rrweb replayer, drag & drop…) is only downloaded by the admin.
const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  return (
    <Routes>
      <Route
        path="/surprisedmycrush/*"
        element={
          <Suspense fallback={<GiftLoader full />}>
            <AdminApp />
          </Suspense>
        }
      />
      {/* One shell for both visitor pages so music, live connection and progress survive navigation. */}
      <Route element={<VisitorShell />}>
        <Route path="/yourmybestcrushever" element={<ConfessionPage />} />
        <Route path="*" element={<MainFlow />} />
      </Route>
    </Routes>
  );
}
