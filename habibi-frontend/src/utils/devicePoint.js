// The device's position, but only when the browser already allows it -- this
// never shows a permission prompt. Resolves null when unknown.
export function getGrantedDevicePoint() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) {
      resolve(null);
      return;
    }
    navigator.permissions.query({ name: 'geolocation' })
      .then((result) => {
        if (result.state !== 'granted') { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 8000, maximumAge: 300000 }
        );
      })
      .catch(() => resolve(null));
  });
}
