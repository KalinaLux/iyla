import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CycleHistory from './pages/CycleHistory';
import Labs from './pages/Labs';
import Supplements from './pages/Supplements';
import Charts from './pages/Charts';
import TWWCompanion from './pages/TWWCompanion';
import Insights from './pages/Insights';
import IVFModule from './pages/IVFModule';
import Breathwork from './pages/Breathwork';
import SleepAnalysis from './pages/SleepAnalysis';
import ProviderReport from './pages/ProviderReport';
import LossSupport from './pages/LossSupport';
import DocumentVault from './pages/DocumentVault';
import PartnerDashboard from './pages/PartnerDashboard';
import Privacy from './pages/Privacy';
import PartnerPairing from './pages/PartnerPairing';
import TTCDictionary from './pages/TTCDictionary';
import Reconnect from './pages/Reconnect';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tww" element={<TWWCompanion />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/cycle" element={<CycleHistory />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/supplements" element={<Supplements />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/ivf" element={<IVFModule />} />
          <Route path="/breathwork" element={<Breathwork />} />
          <Route path="/sleep" element={<SleepAnalysis />} />
          <Route path="/report" element={<ProviderReport />} />
          <Route path="/loss-support" element={<LossSupport />} />
          <Route path="/vault" element={<DocumentVault />} />
          <Route path="/partner" element={<PartnerDashboard />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/pairing" element={<PartnerPairing />} />
          <Route path="/dictionary" element={<TTCDictionary />} />
          <Route path="/reconnect" element={<Reconnect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
