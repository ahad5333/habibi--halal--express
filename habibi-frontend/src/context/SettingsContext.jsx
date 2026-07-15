import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsAPI } from '../services/api';

const DEFAULTS = {
  phone_main:       '(718) 400-0443',
  phone_tollfree:   '(888) 887-5571',
  phone_fax:        '(718) 400-0442',
  email_contact:    'admin@habibihe.com',
  email_orders:     'orders@habibihe.com',
  address_street:   '2974 Jerome Ave',
  address_city:     'Bronx',
  address_state:    'NY',
  address_zip:      '10468',
  social_instagram: 'https://instagram.com/habibihalalexpress',
  social_facebook:  'https://facebook.com/habibihalalexpress',
  social_twitter:   '',
  social_tiktok:    'https://tiktok.com/@habibihalalexpress',
};

const SettingsContext = createContext(DEFAULTS);

let _cached = null;
let _fetchedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(_cached || DEFAULTS);

  useEffect(() => {
    if (_cached && Date.now() - _fetchedAt < CACHE_MS) {
      setSettings(_cached);
      return;
    }
    settingsAPI.getSite().then(data => {
      if (data && data.phone_main) {
        const merged = { ...DEFAULTS, ...data };
        _cached = merged;
        _fetchedAt = Date.now();
        setSettings(merged);
      }
    });
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
