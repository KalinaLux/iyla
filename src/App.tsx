import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

// Everything except Dashboard is lazy-loaded to cut initial bundle size
// (tesseract, jspdf, html2canvas, recharts, etc. all live in route-level chunks now).
const CycleHistory = lazy(() => import('./pages/CycleHistory'));
const Labs = lazy(() => import('./pages/Labs'));
const Supplements = lazy(() => import('./pages/Supplements'));
const Charts = lazy(() => import('./pages/Charts'));
const TWWCompanion = lazy(() => import('./pages/TWWCompanion'));
const Insights = lazy(() => import('./pages/Insights'));
const IVFModule = lazy(() => import('./pages/IVFModule'));
const Breathwork = lazy(() => import('./pages/Breathwork'));
const SleepAnalysis = lazy(() => import('./pages/SleepAnalysis'));
const ProviderReport = lazy(() => import('./pages/ProviderReport'));
const LossSupport = lazy(() => import('./pages/LossSupport'));
const DocumentVault = lazy(() => import('./pages/DocumentVault'));
const PartnerDashboard = lazy(() => import('./pages/PartnerDashboard'));
const Privacy = lazy(() => import('./pages/Privacy'));
const PartnerPairing = lazy(() => import('./pages/PartnerPairing'));
const TTCDictionary = lazy(() => import('./pages/TTCDictionary'));
const Reconnect = lazy(() => import('./pages/Reconnect'));
const Reminders = lazy(() => import('./pages/Reminders'));
const Journal = lazy(() => import('./pages/Journal'));
const Pregnancy = lazy(() => import('./pages/Pregnancy'));
const Medications = lazy(() => import('./pages/Medications'));
const Achievements = lazy(() => import('./pages/Achievements'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3 text-warm-500">
        <div className="w-10 h-10 rounded-full border-2 border-warm-200 border-t-warm-700 animate-spin" />
        <div className="text-sm">Loading...</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/*"
            element={
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="tww" element={<TWWCompanion />} />
                  <Route path="insights" element={<Insights />} />
                  <Route path="cycle" element={<CycleHistory />} />
                  <Route path="labs" element={<Labs />} />
                  <Route path="supplements" element={<Supplements />} />
                  <Route path="reminders" element={<Reminders />} />
                  <Route path="charts" element={<Charts />} />
                  <Route path="ivf" element={<IVFModule />} />
                  <Route path="breathwork" element={<Breathwork />} />
                  <Route path="sleep" element={<SleepAnalysis />} />
                  <Route path="report" element={<ProviderReport />} />
                  <Route path="loss-support" element={<LossSupport />} />
                  <Route path="vault" element={<DocumentVault />} />
                  <Route path="partner" element={<PartnerDashboard />} />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="pairing" element={<PartnerPairing />} />
                  <Route path="dictionary" element={<TTCDictionary />} />
                  <Route path="reconnect" element={<Reconnect />} />
                  <Route path="journal" element={<Journal />} />
                  <Route path="pregnancy" element={<Pregnancy />} />
                  <Route path="medications" element={<Medications />} />
                  <Route path="achievements" element={<Achievements />} />
                </Routes>
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
