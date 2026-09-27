import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for offline TV display and asset caching
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New TV display version available, auto-updating...');
  },
  onOfflineReady() {
    console.log('MHC Board is cached and ready to run offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

