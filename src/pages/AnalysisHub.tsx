import { NavLink, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Network,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import { Loading } from '../components/ui';
import { Analysis } from './Analysis';
const Relationships = lazy(() =>
  import('./Relationships').then((m) => ({ default: m.Relationships })),
);
const Prediction = lazy(() => import('./Prediction').then((m) => ({ default: m.Prediction })));
const MetricsGuide = lazy(() =>
  import('./MetricsGuide').then((m) => ({ default: m.MetricsGuide })),
);
const views = [
  {
    id: 'trend',
    to: '/analysis',
    label: 'Single-metric trend',
    description: 'Follow one measure over time',
    icon: TrendingUp,
  },
  {
    id: 'relationships',
    to: '/analysis/relationships',
    label: 'Relationships',
    description: 'Explore connections between measures',
    icon: Network,
  },
  {
    id: 'prediction',
    to: '/analysis/prediction',
    label: 'Multivariable model',
    description: 'Predict with multiple inputs',
    icon: SlidersHorizontal,
  },
  {
    id: 'metrics',
    to: '/analysis/metrics',
    label: 'Definitions & methods',
    description: 'Understand the metrics and mathematics',
    icon: BookOpen,
  },
];
export function AnalysisHub() {
  return (
    <>
      <nav className="analysis-navigation" aria-label="Analysis views">
        <p className="analysis-nav-label">Explore your data</p>
        <div className="analysis-tabs">
          {views.map(({ id, to, label, description, icon: Icon }) => (
            <NavLink
              key={id}
              to={to}
              end={id === 'trend'}
              aria-labelledby={`analysis-${id}-title`}
              aria-describedby={`analysis-${id}-description`}
            >
              {({ isActive }) => (
                <>
                  <Icon className="analysis-nav-icon" size={20} aria-hidden="true" />
                  <span className="analysis-nav-title" id={`analysis-${id}-title`}>
                    {label}
                  </span>
                  {isActive ? (
                    <Check className="analysis-nav-indicator" size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight className="analysis-nav-indicator" size={16} aria-hidden="true" />
                  )}
                  <span className="analysis-nav-description" id={`analysis-${id}-description`}>
                    {description}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
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
