import { AnimatePresence, motion } from "framer-motion";
import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Skeleton } from "../components/ui";
import Home from "../pages/Home";
import Layout from "./Layout";

const Watch = lazy(() => import("../pages/Watch"));
const WatchNew = lazy(() => import("../pages/WatchNew"));
const PlantDetail = lazy(() => import("../pages/PlantDetail"));
const AddVisit = lazy(() => import("../pages/AddVisit"));
const Scan = lazy(() => import("../pages/Scan"));
const Risk = lazy(() => import("../pages/Risk"));
const Radar = lazy(() => import("../pages/Radar"));
const Expert = lazy(() => import("../pages/Expert"));
const Admin = lazy(() => import("../pages/Admin"));
const Settings = lazy(() => import("../pages/Settings"));
const About = lazy(() => import("../pages/About"));
const History = lazy(() => import("../pages/History"));
const Diseases = lazy(() => import("../pages/Diseases"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Privacy = lazy(() => import("../pages/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("../pages/Legal").then((m) => ({ default: m.Terms })));
const Methodology = lazy(() => import("../pages/Legal").then((m) => ({ default: m.Methodology })));
const NotFound = lazy(() => import("../pages/NotFound"));
const HubLogin = lazy(() => import("../hub/pages/HubLogin"));
const HubDashboard = lazy(() => import("../hub/pages/HubDashboard"));
const KisanVani = lazy(() => import("../hub/pages/KisanVani"));
const HubScanner = lazy(() => import("../hub/pages/HubScanner"));
const Mandi = lazy(() => import("../hub/pages/Mandi"));
const Labs = lazy(() => import("../hub/pages/Labs"));
const HubWeather = lazy(() => import("../hub/pages/Weather"));
const Schemes = lazy(() => import("../hub/pages/Schemes"));
const NpkCalc = lazy(() => import("../hub/pages/NpkCalc"));

const Loading = () => (
  <div className="wrap space-y-4 py-10" role="status" aria-label="Loading">
    <Skeleton className="h-10 w-2/3 opacity-60" />
    <Skeleton className="h-64 w-full opacity-60" />
  </div>
);

export default function App() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <Layout>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
          <Suspense fallback={<Loading />}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/watch" element={<Watch />} />
              <Route path="/watch/new" element={<WatchNew />} />
              <Route path="/watch/:plantId" element={<PlantDetail />} />
              <Route path="/watch/:plantId/visit" element={<AddVisit />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/risk" element={<Risk />} />
              <Route path="/radar" element={<Radar />} />
              <Route path="/expert" element={<Expert />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/how-it-works" element={<Methodology />} />
              <Route path="/history" element={<History />} />
              <Route path="/diseases" element={<Diseases />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/about" element={<About />} />
              <Route path="/hub" element={<HubDashboard />} />
              <Route path="/hub/login" element={<HubLogin />} />
              <Route path="/hub/vani" element={<KisanVani />} />
              <Route path="/hub/scan" element={<HubScanner />} />
              <Route path="/hub/mandi" element={<Mandi />} />
              <Route path="/hub/labs" element={<Labs />} />
              <Route path="/hub/weather" element={<HubWeather />} />
              <Route path="/hub/schemes" element={<Schemes />} />
              <Route path="/hub/npk" element={<NpkCalc />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
