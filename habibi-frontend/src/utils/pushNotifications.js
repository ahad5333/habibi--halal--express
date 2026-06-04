// Push notification utility — Firebase Cloud Messaging (web)
// Gracefully no-ops when Firebase credentials are not configured.

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Returns true only when all required Firebase env vars are set
export const isFirebaseConfigured = () =>
  Object.values(FIREBASE_CONFIG).every(v => v && v !== 'REPLACE_ME') && VAPID_KEY;

// Returns current Notification permission: 'default' | 'granted' | 'denied'
export const getPermissionStatus = () =>
  'Notification' in window ? Notification.permission : 'unsupported';

// Requests notification permission, initialises Firebase, gets the FCM token,
// and registers it with the backend.  Returns { ok, token?, reason? }.
export const requestPushPermission = async () => {
  if (!('Notification' in window)) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!isFirebaseConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  try {
    // Lazy-load Firebase to avoid adding it to the critical bundle
    const { initializeApp, getApps }         = await import('firebase/app');
    const { getMessaging, getToken }          = await import('firebase/messaging');

    const app = getApps().length
      ? getApps()[0]
      : initializeApp(FIREBASE_CONFIG);

    const messaging = getMessaging(app);
    const fcmToken  = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });

    if (!fcmToken) return { ok: false, reason: 'no_token' };

    // Send token to backend
    const authToken = localStorage.getItem('habibi_token');
    if (authToken) {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/me/notifications/device-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: fcmToken, platform: 'web' }),
      });
    }

    localStorage.setItem('habibi_fcm_token', fcmToken);
    return { ok: true, token: fcmToken };
  } catch (err) {
    console.error('[Push] FCM error:', err.message);
    return { ok: false, reason: 'error', message: err.message };
  }
};

// Removes the stored FCM token from the backend (call on logout)
export const unregisterPushToken = async () => {
  const fcmToken  = localStorage.getItem('habibi_fcm_token');
  const authToken = localStorage.getItem('habibi_token');
  if (!fcmToken || !authToken) return;
  try {
    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/me/notifications/device-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: fcmToken }),
    });
    localStorage.removeItem('habibi_fcm_token');
  } catch (_) {}
};
