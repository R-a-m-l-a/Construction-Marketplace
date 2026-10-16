import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Point API client at the production backend when the frontend is
// served from a different origin (e.g. separate Vercel project).
// Prefer VITE_API_BASE_URL env var; fall back to the known backend.
const apiBase =
  import.meta.env.VITE_API_BASE_URL ||
  'https://construction-marketplace-delta.vercel.app';

if (apiBase) {
  setBaseUrl(apiBase);
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);