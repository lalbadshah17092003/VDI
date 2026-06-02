import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
const isSecureContext = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

if (!isSecureContext) {
  console.warn("⚠️ Warning: MSAL requires HTTPS for full functionality. Some features may not work properly.");
}

root.render(
  <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
  </React.StrictMode>
);
reportWebVitals();
