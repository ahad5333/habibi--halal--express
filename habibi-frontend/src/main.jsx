import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { DineInProvider } from './context/DineInContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <DineInProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </DineInProvider>
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>,
);
