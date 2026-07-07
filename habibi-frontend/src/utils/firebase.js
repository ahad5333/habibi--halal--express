// Shared Firebase app initializer — used by both push notifications and Auth.
// Lazy-loaded so it never appears in the critical bundle.

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = () =>
  Object.values(FIREBASE_CONFIG).every(v => v && v !== 'REPLACE_ME');

// Returns an initialized Firebase App (singleton)
export async function getFirebaseApp() {
  const { initializeApp, getApps } = await import('firebase/app');
  return getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
}

// Returns Firebase Auth instance
export async function getFirebaseAuth() {
  const app = await getFirebaseApp();
  const { getAuth } = await import('firebase/auth');
  return getAuth(app);
}
