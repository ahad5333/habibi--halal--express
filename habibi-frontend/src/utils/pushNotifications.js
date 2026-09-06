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
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    // Inject Firebase config into the SW so it can handle background pushes
    const target = swReg.installing || swReg.waiting || swReg.active;
    if (target) target.postMessage({ type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG });
    const fcmToken  = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!fcmToken) return { ok: false, reason: 'no_token' };

    // Send token to backend — auth via httpOnly cookie
    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/me/notifications/device-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fcmToken, platform: 'web' }),
    }).catch(() => {});

    localStorage.setItem('habibi_fcm_token', fcmToken);
    return { ok: true, token: fcmToken };
  } catch (err) {
    console.error('[Push] FCM error:', err.message);
    return { ok: false, reason: 'error', message: err.message };
  }
};

// Driver-specific: request permission, get FCM token, register with driver endpoint
// driverId + hmacToken come from the URL params after PIN login.
export const registerDriverPush = async (driverId, hmacToken) => {
  if (!('Notification' in window) || !isFirebaseConfigured()) return { ok: false };
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const target = swReg.installing || swReg.waiting || swReg.active;
    if (target) target.postMessage({ type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG });
    const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!fcmToken) return { ok: false, reason: 'no_token' };

    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/dispatch/driver/fcm-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Driver-Token': hmacToken },
      body: JSON.stringify({ driver_id: driverId, fcm_token: fcmToken }),
    }).catch(() => {});

    return { ok: true, token: fcmToken };
  } catch (err) {
    console.error('[Push] Driver FCM error:', err.message);
    return { ok: false, reason: 'error' };
  }
};

// Staff order-queue login (kitchen/manager/cashier/server) -- same shape as
// registerDriverPush, but hits the staff-scoped endpoint with the staff
// session's X-Staff-Id/X-Staff-Token headers instead of X-Driver-Token.
export const registerStaffPush = async (staffId, hmacToken) => {
  if (!('Notification' in window) || !isFirebaseConfigured()) return { ok: false };
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const target = swReg.installing || swReg.waiting || swReg.active;
    if (target) target.postMessage({ type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG });
    const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!fcmToken) return { ok: false, reason: 'no_token' };

    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/staff/fcm-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Staff-Id': staffId, 'X-Staff-Token': hmacToken },
      body: JSON.stringify({ fcm_token: fcmToken }),
    }).catch(() => {});

    return { ok: true, token: fcmToken };
  } catch (err) {
    console.error('[Push] Staff FCM error:', err.message);
    return { ok: false, reason: 'error' };
  }
};

// Removes the stored FCM token from the backend (call on logout)
export const unregisterPushToken = async () => {
  const fcmToken = localStorage.getItem('habibi_fcm_token');
  if (!fcmToken) return;
  try {
    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/me/notifications/device-token`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fcmToken }),
    });
    localStorage.removeItem('habibi_fcm_token');
  } catch (_) {}
};
