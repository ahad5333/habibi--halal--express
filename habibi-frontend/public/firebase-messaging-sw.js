// Firebase Cloud Messaging service worker
// Enables push notifications when the browser tab is closed or in background.
// Replace the firebaseConfig values with your real project config from:
//   console.firebase.google.com → Project Settings → Your Apps → Web → Config

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            self.__FIREBASE_API_KEY__            || 'REPLACE_ME',
  authDomain:        self.__FIREBASE_AUTH_DOMAIN__        || 'REPLACE_ME',
  projectId:         self.__FIREBASE_PROJECT_ID__         || 'REPLACE_ME',
  storageBucket:     self.__FIREBASE_STORAGE_BUCKET__     || 'REPLACE_ME',
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || 'REPLACE_ME',
  appId:             self.__FIREBASE_APP_ID__             || 'REPLACE_ME',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Habibi Halal Express', {
    body:  body  || 'You have a new notification.',
    icon:  icon  || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data:  payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
