import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import PublicPortfolio from '@/pages/public/PublicPortfolio';
import VipPitchPage from '@/pages/pitch/VipPitchPage';
import CommandCenter from '@/pages/admin/CommandCenter';
import ProtectedRoute from '@/pages/admin/ProtectedRoute';
import './index.css';

/**
 * Shadow Matrix route table — Blueprint § 2.
 *   /                 public portfolio (visitors)
 *   /vip/:companyId   dynamic pitch page (recruiters)
 *   /matrix-admin     command center (protected)
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicPortfolio />} />
        <Route path="/vip/:companyId" element={<VipPitchPage />} />
        <Route
          path="/matrix-admin"
          element={
            <ProtectedRoute>
              <CommandCenter />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
