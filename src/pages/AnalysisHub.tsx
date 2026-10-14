import { NavLink, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loading } from '../components/ui';
import { Analysis } from './Analysis';
const Relationships = lazy(() =>
  import('./Relationships').then((m) => ({ default: m.Relationships })),
);
const Prediction = lazy(() => import('./Prediction').then((m) => ({ default: m.Prediction })));
const MetricsGuide = lazy(() =>
  import('./MetricsGuide').then((m) => ({ default: m.MetricsGuide })),
);
export function AnalysisHub() {
  return (
    <>
      <nav className="analysis-tabs" aria-label="Analysis views">
        <NavLink to="/analysis" end>
          Single-metric trend
        </NavLink>
        <NavLink to="/analysis/relationships">Relationships</NavLink>
        <NavLink to="/analysis/prediction">Multivariable model</NavLink>
        <NavLink to="/analysis/metrics">Definitions & methods</NavLink>
      </nav>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<Analysis />} />
          <Route path="relationships" element={<Relationships />} />
          <Route path="prediction" element={<Prediction />} />
          <Route path="metrics" element={<MetricsGuide />} />
        </Routes>
      </Suspense>
    </>
  );
}
