// Firebase Cloud Messaging service worker
// Handles background push notifications for both regular users and drivers.
// Config is injected at runtime via postMessage from the main thread.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let messaging = null;

function initFirebase(config) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const { title, body, icon } = payload.notification || {};
      const data = payload.data || {};
      const notifOptions = {
        body:  body  || 'You have a new notification.',
        icon:  icon  || '/favicon.png',
        badge: '/favicon.png',
        data,
        tag:   data.tag || 'habibi-notification',
      };
      // Driver orders get a distinct sound-like vibration pattern
      if (data.type === 'new_order') {
        notifOptions.vibrate = [300, 100, 300, 100, 300];
        notifOptions.requireInteraction = true;
      }
      self.registration.showNotification(title || 'Habibi Halal Express', notifOptions);
    });
  } catch (err) {
    console.error('[SW] Firebase init error:', err.message);
  }
}

// Receive Firebase config from main thread after SW registration
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !messaging) {
    initFirebase(event.data.config);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url  = data.url || (data.type === 'new_order' ? '/driver' : '/');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
