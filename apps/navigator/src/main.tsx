import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Navigator from '@/pages/Navigator';
import Resources from '@/pages/Resources';
import './index.css';

// GitHub Pages SPA redirect handling
(function () {
  const redirect = sessionStorage.getItem('redirect');
  if (redirect) {
    sessionStorage.removeItem('redirect');
    window.history.replaceState(null, '', redirect);
  }
})();

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/emergency-response-navigator/sw.js').catch(() => {
      // SW registration failed, app works fine without it
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/emergency-response-navigator">
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/navigator" element={<Navigator />} />
          <Route path="/navigator/:sectorId" element={<Navigator />} />
          <Route path="/resources" element={<Resources />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>,
);
