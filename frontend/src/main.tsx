import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle unauthorized events globally
window.addEventListener('unauthorized', () => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
