import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import PublicPortfolio from '@/pages/public/PublicPortfolio';
import './index.css';

/**
 * Shadow Matrix route table — Blueprint § 2.
 *   /                 public portfolio (visitors)
 *   /vip/:companyId   dynamic pitch page (recruiters)
 *   /matrix-admin     command center (protected)
 *
 * The admin console and the Supabase auth client are lazy-loaded: a visitor
 * reading the portfolio should never pay to download the operator tooling.
 */
const VipPitchPage = lazy(() => import('@/pages/pitch/VipPitchPage'));
const CommandCenter = lazy(() => import('@/pages/admin/CommandCenter'));
const ProtectedRoute = lazy(() => import('@/pages/admin/ProtectedRoute'));
// Only the console is wrapped: the public portfolio manages its own
// language in component state and must not inherit the operator's choice.
const LanguageProvider = lazy(() =>
  import('@/i18n').then((m) => ({ default: m.LanguageProvider })),
);

function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#07080c] flex items-center justify-center">
      <span className="font-mono text-sm text-zinc-600">Loading…</span>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<PublicPortfolio />} />
          <Route path="/vip/:companyId" element={<VipPitchPage />} />
          <Route
            path="/matrix-admin"
            element={
              <LanguageProvider>
                <ProtectedRoute>
                  <CommandCenter />
                </ProtectedRoute>
              </LanguageProvider>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
